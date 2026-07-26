import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { ADMIN_CSS, ADMIN_HTML, ADMIN_JS, ADMIN_USERNAME } from "./admin-web.js";
import type { BridgeConfig } from "./config.js";
import { FOOD_ANALYSIS_BODY_LIMIT_BYTES } from "./food-image-analyzer.js";
import { allowsLocalBrowserConnection, isLoopbackSocketAddress } from "./local-request-policy.js";
import { bearerToken, hashSecret, safeSecretEqual } from "./security.js";
import { BridgeError, BridgeService, LOCAL_WEB_DEVICE_ID } from "./service.js";
import type { AuthenticatedDevice, BridgeEvent } from "./types.js";

class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly windowMs: number, private readonly maximum: number) {}

  take(key: string): { allowed: boolean; retryAfter: number } {
    const current = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (this.buckets.size > 10_000) {
      for (const [entryKey, entry] of this.buckets) if (entry.resetAt <= current) this.buckets.delete(entryKey);
    }
    return { allowed: bucket.count <= this.maximum, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - current) / 1_000)) };
  }
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

function sendText(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

function applyAdminSecurityHeaders(res: ServerResponse): void {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
}

function sendAdminUnauthorized(res: ServerResponse): void {
  res.setHeader("WWW-Authenticate", 'Basic realm="Orbit Admin", charset="UTF-8"');
  sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Orbit 관리자 로그인이 필요합니다." } });
}

function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

async function readJson(req: IncomingMessage, limit: number, requireContentType = false): Promise<Record<string, unknown>> {
  const contentLength = Number.parseInt(header(req, "content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > limit) throw new BridgeError(413, "BODY_TOO_LARGE", "요청 본문이 너무 큽니다.");
  const contentType = header(req, "content-type") || "";
  const jsonContentType = /^application\/json(?:\s*;|$)/i.test(contentType);
  if ((contentLength > 0 || requireContentType) && !jsonContentType) {
    throw new BridgeError(415, "JSON_REQUIRED", "application/json 요청만 허용됩니다.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const raw of req) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > limit) throw new BridgeError(413, "BODY_TOO_LARGE", "요청 본문이 너무 큽니다.");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as Record<string, unknown>;
  } catch {
    throw new BridgeError(400, "INVALID_JSON", "JSON 요청 본문이 올바르지 않습니다.");
  }
}

function errorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof BridgeError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Bridge 요청 처리 중 오류가 발생했습니다." } } };
}

function writeSse(res: ServerResponse, event: BridgeEvent): void {
  res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export interface BridgeHttpServer {
  server: Server;
  listen(): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
}

export function createBridgeHttpServer(service: BridgeService, config: BridgeConfig): BridgeHttpServer {
  const limiter = new RateLimiter(config.rateLimitWindowMs, config.rateLimitMax);
  const pairLimiter = new RateLimiter(config.rateLimitWindowMs, Math.min(config.rateLimitMax, 20));
  const foodLimiter = new RateLimiter(config.rateLimitWindowMs, Math.min(config.rateLimitMax, 10));
  const server = createServer(async (req, res) => {
    applySecurityHeaders(res);
    const remoteAddress = req.socket.remoteAddress;
    const method = req.method || "GET";
    let url: URL;
    try {
      url = new URL(req.url || "/", "http://lifehub.local");
    } catch {
      sendJson(res, 400, { error: { code: "INVALID_URL", message: "요청 URL이 올바르지 않습니다." } });
      return;
    }

    const adminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
    const localConnectPath = url.pathname === "/api/local/connect";
    const directLocalBrowserRequest = allowsLocalBrowserConnection({
      remoteAddress,
      host: header(req, "host"),
      origin: header(req, "origin"),
      hasForwardedHeaders: ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"]
        .some((name) => Boolean(header(req, name))),
    });
    const localBrowserConnectionAllowed = localConnectPath && directLocalBrowserRequest;

    const origin = header(req, "origin");
    if (origin) {
      const forwardedProtocol = header(req, "x-forwarded-proto")?.split(",", 1)[0]?.trim();
      const forwardedHost = header(req, "x-forwarded-host")?.split(",", 1)[0]?.trim();
      const requestHost = forwardedHost || header(req, "host");
      const requestProtocol = forwardedProtocol === "https" ? "https" : "http";
      const sameOriginAdmin = adminPath && Boolean(requestHost) && origin === `${requestProtocol}://${requestHost}`;
      if (!sameOriginAdmin && !directLocalBrowserRequest && !config.allowedOrigins.has(origin)) {
        sendJson(res, 403, { error: { code: "ORIGIN_DENIED", message: "허용되지 않은 Origin입니다." } });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Last-Event-ID, X-LifeHub-Admin-Token");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const rateKey = remoteAddress || "unknown";
    const rate = limiter.take(rateKey);
    if (!rate.allowed) {
      res.setHeader("Retry-After", rate.retryAfter);
      sendJson(res, 429, { error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." } });
      return;
    }
    if (url.pathname.startsWith("/api/pair/") || localConnectPath) {
      const pairRate = pairLimiter.take(rateKey);
      if (!pairRate.allowed) {
        res.setHeader("Retry-After", pairRate.retryAfter);
        sendJson(res, 429, { error: { code: "PAIR_RATE_LIMITED", message: "페어링 요청이 너무 많습니다. 잠시 후 다시 시도하세요." } });
        return;
      }
    }

    try {
      const isAdmin = await adminAuthorized(req, service, remoteAddress);

      if (method === "GET" && url.pathname === "/admin") {
        res.statusCode = 308;
        res.setHeader("Location", "/admin/");
        res.end();
        return;
      }
      if (url.pathname.startsWith("/admin/")) {
        applyAdminSecurityHeaders(res);
        if (!isAdmin) {
          sendAdminUnauthorized(res);
          return;
        }
        if (method === "GET" && url.pathname === "/admin/") {
          sendText(res, 200, "text/html; charset=utf-8", ADMIN_HTML);
          return;
        }
        if (method === "GET" && url.pathname === "/admin/admin.css") {
          sendText(res, 200, "text/css; charset=utf-8", ADMIN_CSS);
          return;
        }
        if (method === "GET" && url.pathname === "/admin/admin.js") {
          sendText(res, 200, "text/javascript; charset=utf-8", ADMIN_JS);
          return;
        }
        if (method === "GET" && url.pathname === "/admin/api/status") {
          sendJson(res, 200, await service.adminStatus());
          return;
        }
        if (method === "POST" && url.pathname === "/admin/api/pair-code") {
          await readJson(req, config.bodyLimitBytes, true);
          sendJson(res, 201, await service.createPairCode());
          return;
        }
        if (method === "POST" && url.pathname === "/admin/api/pair/approve") {
          const body = await readJson(req, config.bodyLimitBytes, true);
          const requestId = typeof body.requestId === "string" ? body.requestId : "";
          sendJson(res, 200, await service.approvePairingAsAdmin(requestId, body.permissions));
          return;
        }
        if (method === "POST" && url.pathname === "/admin/api/pair/reject") {
          const body = await readJson(req, config.bodyLimitBytes, true);
          const requestId = typeof body.requestId === "string" ? body.requestId : "";
          await service.rejectPairingAsAdmin(requestId);
          sendJson(res, 200, { requestId, status: "rejected" });
          return;
        }
        if (method === "POST" && url.pathname === "/admin/api/device/revoke") {
          const body = await readJson(req, config.bodyLimitBytes, true);
          const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
          await service.revokeDevice(undefined, deviceId);
          sendJson(res, 200, { deviceId, revoked: true });
          return;
        }
        throw new BridgeError(404, "ADMIN_NOT_FOUND", "관리자 경로를 찾을 수 없습니다.");
      }

      if (method === "POST" && localConnectPath) {
        if (!localBrowserConnectionAllowed) {
          throw new BridgeError(403, "LOCAL_CONNECT_DENIED", "직접 연 로컬 브라우저에서만 연결할 수 있습니다.");
        }
        const body = await readJson(req, config.bodyLimitBytes, true);
        sendJson(res, 200, await service.connectLocalWebDevice(body.deviceName));
        return;
      }

      if (method === "POST" && url.pathname === "/api/pair/request") {
        sendJson(res, 202, await service.requestPairing(await readJson(req, config.bodyLimitBytes)));
        return;
      }
      if (method === "POST" && url.pathname === "/api/pair/approve") {
        const body = await readJson(req, config.bodyLimitBytes);
        if (isAdmin) {
          const requestId = typeof body.requestId === "string" ? body.requestId : "";
          if (body.decision === "reject") {
            await service.rejectPairingAsAdmin(requestId);
            sendJson(res, 200, { requestId, status: "rejected" });
          } else {
            sendJson(res, 200, await service.approvePairingAsAdmin(requestId, body.permissions));
          }
        } else {
          const result = await service.claimPairing(body);
          sendJson(res, result.status === "pending" ? 202 : 200, result);
        }
        return;
      }
      if (method === "POST" && url.pathname === "/api/pair/revoke") {
        const body = await readJson(req, config.bodyLimitBytes);
        if (isAdmin) {
          await service.revokeDevice(undefined, typeof body.deviceId === "string" ? body.deviceId : undefined);
        } else {
          const actor = await authenticate(req, service);
          await service.revokeDevice(actor);
        }
        sendJson(res, 200, { revoked: true });
        return;
      }

      if (method === "POST" && url.pathname === "/api/projects/register") {
        if (!isAdmin) throw new BridgeError(403, "ADMIN_REQUIRED", "로컬 PC 관리자 인증이 필요합니다.");
        const body = await readJson(req, config.bodyLimitBytes);
        const path = typeof body.path === "string" ? body.path : "";
        const name = typeof body.name === "string" ? body.name : undefined;
        sendJson(res, 201, { project: await service.registerProject(path, name) });
        return;
      }

      const device = await authenticate(req, service);
      if (method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true, service: "lifehub-bridge", version: 1 });
        return;
      }
      if (method === "GET" && url.pathname === "/api/device/status") {
        sendJson(res, 200, await service.deviceStatus(device));
        return;
      }
      if (method === "POST" && url.pathname === "/api/food/analyze") {
        const foodRate = foodLimiter.take(device.id);
        if (!foodRate.allowed) {
          res.setHeader("Retry-After", foodRate.retryAfter);
          sendJson(res, 429, { error: { code: "FOOD_ANALYSIS_RATE_LIMITED", message: "음식 사진 분석 요청이 너무 많습니다. 잠시 후 다시 시도하세요." } });
          return;
        }
        const requestController = new AbortController();
        const cancelOnDisconnect = () => {
          if (!res.writableEnded) requestController.abort();
        };
        res.once("close", cancelOnDisconnect);
        try {
          const body = await readJson(req, FOOD_ANALYSIS_BODY_LIMIT_BYTES, true);
          const result = await service.analyzeFood(device, body, requestController.signal);
          if (!res.destroyed) sendJson(res, 200, result);
        } finally {
          res.off("close", cancelOnDisconnect);
        }
        return;
      }
      if (method === "GET" && url.pathname === "/api/projects") {
        sendJson(res, 200, await service.listProjects(device));
        return;
      }
      const commandMatch = /^\/api\/projects\/([A-Za-z0-9_-]+)\/commands\/(prepare|execute)$/.exec(url.pathname);
      if (method === "POST" && commandMatch) {
        const projectId = commandMatch[1]!;
        const action = commandMatch[2]!;
        const body = await readJson(req, config.bodyLimitBytes, true);
        if (action === "prepare") {
          sendJson(res, 200, await service.prepareRemoteCommand(device, projectId, body));
          return;
        }
        const requestController = new AbortController();
        const cancelOnDisconnect = () => {
          if (!res.writableEnded) requestController.abort();
        };
        res.once("close", cancelOnDisconnect);
        try {
          const result = await service.executePreparedRemoteCommand(device, projectId, body, requestController.signal);
          if (!res.destroyed) sendJson(res, 200, result);
        } finally {
          res.off("close", cancelOnDisconnect);
        }
        return;
      }
      if (method === "GET" && url.pathname === "/api/threads") {
        sendJson(res, 200, await service.listThreads(device, url.searchParams.get("mode") || undefined));
        return;
      }
      if (method === "POST" && url.pathname === "/api/threads") {
        sendJson(res, 201, { thread: await service.createThread(device, await readJson(req, config.bodyLimitBytes)) });
        return;
      }

      const match = /^\/api\/threads\/([A-Za-z0-9_-]+)(?:\/(messages|cancel|events|changes|approve|reject))?$/.exec(url.pathname);
      if (match) {
        const threadId = match[1]!;
        const action = match[2];
        if (method === "GET" && !action) {
          sendJson(res, 200, { thread: await service.getThreadDetail(device, threadId) });
          return;
        }
        if (method === "POST" && action === "messages") {
          const body = await readJson(req, config.bodyLimitBytes);
          if (body.localWorkspaceAccess === true && !directLocalBrowserRequest) {
            throw new BridgeError(403, "LOCAL_WORKSPACE_REQUEST_DENIED", "직접 연 로컬 브라우저의 작업 요청만 전체 작업공간 권한을 사용할 수 있습니다.");
          }
          const result = await service.postMessage(device, threadId, body);
          sendJson(res, result.pendingApproval ? 202 : 202, result);
          return;
        }
        if (method === "POST" && action === "cancel") {
          sendJson(res, 200, await service.cancel(device, threadId));
          return;
        }
        if (method === "GET" && action === "changes") {
          sendJson(res, 200, await service.changes(device, threadId));
          return;
        }
        if (method === "POST" && action === "approve") {
          if (device.id === LOCAL_WEB_DEVICE_ID && !directLocalBrowserRequest) {
            throw new BridgeError(403, "LOCAL_WORKSPACE_REQUEST_DENIED", "직접 연 로컬 브라우저에서만 위험 작업을 최종 승인할 수 있습니다.");
          }
          sendJson(res, 200, await service.approve(device, threadId, await readJson(req, config.bodyLimitBytes)));
          return;
        }
        if (method === "POST" && action === "reject") {
          sendJson(res, 200, await service.reject(device, threadId, await readJson(req, config.bodyLimitBytes)));
          return;
        }
        if (method === "GET" && action === "events") {
          await streamEvents(req, res, service, device, threadId, url);
          return;
        }
      }

      throw new BridgeError(404, "NOT_FOUND", "API 경로를 찾을 수 없습니다.");
    } catch (error) {
      if (res.headersSent || res.destroyed) {
        if (!res.writableEnded) res.end();
        return;
      }
      const response = errorResponse(error);
      sendJson(res, response.status, response.body);
    }
  });

  return {
    server,
    listen: () => new Promise((resolvePromise, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, () => {
        server.off("error", reject);
        const address = server.address() as AddressInfo;
        resolvePromise({ host: address.address, port: address.port });
      });
    }),
    close: () => new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())),
  };
}

async function authenticate(req: IncomingMessage, service: BridgeService): Promise<AuthenticatedDevice> {
  return service.authenticate(bearerToken(header(req, "authorization")));
}

async function adminAuthorized(req: IncomingMessage, service: BridgeService, remoteAddress: string | undefined): Promise<boolean> {
  if (!isLoopbackSocketAddress(remoteAddress)) return false;
  const expected = await service.store.readAdminToken();
  const supplied = header(req, "x-lifehub-admin-token");
  if (supplied && safeSecretEqual(supplied, hashSecret(expected))) return true;

  const authorization = header(req, "authorization");
  const match = authorization && /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (!match) return false;
  try {
    const decoded = Buffer.from(match[1]!, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0 || decoded.slice(0, separator) !== ADMIN_USERNAME) return false;
    return safeSecretEqual(decoded.slice(separator + 1), hashSecret(expected));
  } catch {
    return false;
  }
}

async function streamEvents(
  req: IncomingMessage,
  res: ServerResponse,
  service: BridgeService,
  device: AuthenticatedDevice,
  threadId: string,
  url: URL,
): Promise<void> {
  const afterHeader = Number.parseInt(header(req, "last-event-id") || url.searchParams.get("after") || "0", 10);
  const after = Number.isSafeInteger(afterHeader) && afterHeader >= 0 ? afterHeader : 0;
  await service.getThread(device, threadId);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let replaying = true;
  const queued: BridgeEvent[] = [];
  const unsubscribe = service.subscribe(threadId, (event) => {
    if (replaying) queued.push(event);
    else {
      writeSse(res, event);
      if (event.type === "device.revoked") res.end();
    }
  });
  const replay = await service.events(device, threadId, after);
  let last = after;
  for (const event of replay) {
    writeSse(res, event);
    last = Math.max(last, event.id);
  }
  replaying = false;
  for (const event of queued) {
    if (event.id <= last) continue;
    writeSse(res, event);
    if (event.type === "device.revoked") {
      unsubscribe();
      res.end();
      return;
    }
  }
  res.write(": connected\n\n");

  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 15_000);
  const cleanup = () => {
    clearInterval(keepAlive);
    unsubscribe();
  };
  req.once("close", cleanup);
  res.once("close", cleanup);
}
