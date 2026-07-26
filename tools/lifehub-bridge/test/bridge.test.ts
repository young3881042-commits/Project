import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { promisify } from "node:util";
import type { ThreadEvent } from "@openai/codex-sdk";
import { loadConfig, type BridgeConfig } from "../src/config.js";
import { createCodexEnvironment, OfficialCodexAdapter, shellToolsEnabledFor, threadOptionsFor, type CodexAdapter, type CodexRunRequest } from "../src/codex-adapter.js";
import { createBridgeHttpServer, type BridgeHttpServer } from "../src/http-server.js";
import { resolveAllowedProjectPath } from "../src/projects.js";
import { BridgeError, BridgeService, canonicalCommandForApproval } from "../src/service.js";
import { JsonStore } from "../src/store.js";
import { DEVICE_PERMISSIONS, type AuthenticatedDevice, type DevicePermission } from "../src/types.js";

class MockCodexAdapter implements CodexAdapter {
  readonly runs: Array<Omit<CodexRunRequest, "signal">> = [];
  loggedIn = true;

  async *run(request: CodexRunRequest): AsyncIterable<ThreadEvent> {
    const { signal: _signal, ...captured } = request;
    this.runs.push(captured);
    if (!request.sdkThreadId) yield { type: "thread.started", thread_id: "sdk-persisted-1" };
    yield { type: "turn.started" };
    if (request.content === "slow") {
      if (request.signal.aborted) throw new DOMException("aborted", "AbortError");
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 5_000);
        request.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      });
    }
    if (request.content === "usage limit") throw new Error("Your workspace is out of credits; private-detail-must-not-leak");
    if (request.content === "unsafe command") {
      yield {
        type: "item.started",
        item: { id: "unsafe", type: "command_execution", command: "python3 -c 'print(1)'", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "unsafe traversal command") {
      yield {
        type: "item.started",
        item: { id: "unsafe-traversal", type: "command_execution", command: "cat foo/../../.codex/auth.json", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "unsafe compound command") {
      yield {
        type: "item.started",
        item: { id: "unsafe-compound", type: "command_execution", command: "cat x; cat y", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "read symlink") {
      yield {
        type: "item.started",
        item: { id: "read-symlink", type: "command_execution", command: "cat escape/secret.txt", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run mismatched command") {
      yield {
        type: "item.started",
        item: { id: "mismatch", type: "command_execution", command: "echo mismatch", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run approved command") {
      yield {
        type: "item.started",
        item: { id: "approved-command", type: "command_execution", command: "echo approved", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run safe local sequence") {
      yield {
        type: "item.started",
        item: { id: "safe-local-sequence", type: "command_execution", command: "/bin/bash -lc \"sed -n '1,3p' src/a && npm test\"", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run wrapped command") {
      yield {
        type: "item.started",
        item: { id: "wrapped-command", type: "command_execution", command: "/bin/bash -c 'uname -s'", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run external path") {
      yield {
        type: "item.started",
        item: { id: "external-path", type: "command_execution", command: "cat /etc/passwd", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run critical command") {
      yield {
        type: "item.started",
        item: { id: "critical-command", type: "command_execution", command: "rm src/old.txt", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "run unapproved build") {
      yield {
        type: "item.started",
        item: { id: "unapproved-build", type: "command_execution", command: "npm test", aggregated_output: "", status: "in_progress" },
      };
    }
    if (request.content === "use mcp") {
      yield {
        type: "item.started",
        item: { id: "mcp", type: "mcp_tool_call", server: "example", tool: "read", arguments: {}, status: "in_progress" },
      };
    }
    if (request.content === "use web search") {
      yield { type: "item.completed", item: { id: "web", type: "web_search", query: "secret" } };
    }
    if (request.content === "edit approved file") {
      yield {
        type: "item.completed",
        item: { id: "file-ok", type: "file_change", changes: [{ path: join(request.workingDirectory, "src/new.txt"), kind: "add" }], status: "completed" },
      };
    }
    if (request.content === "edit file unexpectedly") {
      yield {
        type: "item.completed",
        item: { id: "unexpected-delete", type: "file_change", changes: [{ path: join(request.workingDirectory, "src/new.txt"), kind: "delete" }], status: "completed" },
      };
    }
    if (request.content === "edit outside symlink") {
      yield {
        type: "item.completed",
        item: { id: "file-outside", type: "file_change", changes: [{ path: join(request.workingDirectory, "escape/secret.txt"), kind: "add" }], status: "completed" },
      };
    }
    if (request.content === "edit task file") {
      yield {
        type: "item.completed",
        item: { id: "task-file", type: "file_change", changes: [{ path: join(request.workingDirectory, "src/task.txt"), kind: "update" }], status: "completed" },
      };
    }
    yield { type: "item.updated", item: { id: "answer", type: "agent_message", text: `reply:${request.content}` } };
    yield {
      type: "turn.completed",
      usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 },
    };
  }

  async loginStatus(): Promise<{ loggedIn: boolean; status: "logged-in" | "not-logged-in" }> {
    return { loggedIn: this.loggedIn, status: this.loggedIn ? "logged-in" : "not-logged-in" };
  }
}

test("Codex 자식 프로세스 환경에서 API 키와 토큰을 상속하지 않는다", () => {
  assert.deepEqual(createCodexEnvironment({
    HOME: "/home/test",
    PATH: "/usr/bin",
    CODEX_HOME: "/home/test/.codex",
    OPENAI_API_KEY: "must-not-pass",
    CODEX_API_KEY: "must-not-pass",
    ACCESS_TOKEN: "must-not-pass",
    RANDOM_SECRET: "must-not-pass",
  }), {
    HOME: "/home/test",
    PATH: "/usr/bin",
    CODEX_HOME: "/home/test/.codex",
  });
  assert.deepEqual(threadOptionsFor({ mode: "codex", workingDirectory: "/project", permissions: ["command:execute"] }), {
    workingDirectory: "/project",
    skipGitRepoCheck: false,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    additionalDirectories: [],
  });
  assert.equal(threadOptionsFor({ mode: "codex", workingDirectory: "/project", permissions: ["file:write"] }).sandboxMode, "workspace-write");
  assert.equal(threadOptionsFor({ mode: "codex", workingDirectory: "/project", permissions: [] }).approvalPolicy, "untrusted");
  assert.equal(shellToolsEnabledFor({ mode: "general", permissions: ["command:execute"] }), false);
  assert.equal(shellToolsEnabledFor({ mode: "codex", permissions: ["file:write"] }), false);
  assert.equal(shellToolsEnabledFor({ mode: "codex", permissions: ["command:execute"] }), true);
  assert.equal(canonicalCommandForApproval("/bin/bash -c 'uname -s'"), "uname -s");
  assert.equal(canonicalCommandForApproval("/bin/bash -lc \"npm test\""), "npm test");
  assert.notEqual(canonicalCommandForApproval("/bin/bash -c 'uname -s' trailing"), "uname -s");
});

interface Fixture {
  config: BridgeConfig;
  store: JsonStore;
  adapter: MockCodexAdapter;
  service: BridgeService;
}

const servers: BridgeHttpServer[] = [];
const execFileAsync = promisify(execFile);
afterEach(async () => {
  while (servers.length) await servers.pop()!.close().catch(() => undefined);
});

async function fixture(): Promise<Fixture> {
  const dataDir = await mkdtemp(join(tmpdir(), "lifehub-bridge-test-"));
  const config = loadConfig({
    HOME: dataDir,
    LIFEHUB_BRIDGE_DATA_DIR: join(dataDir, "data"),
    LIFEHUB_PAIR_CODE_TTL_MS: "1000",
    LIFEHUB_PAIR_REQUEST_TTL_MS: "1000",
  });
  config.port = 0;
  config.rateLimitMax = 1_000;
  const store = new JsonStore(config);
  const adapter = new MockCodexAdapter();
  const service = new BridgeService(config, store, adapter);
  await service.init();
  return { config, store, adapter, service };
}

async function pair(f: Fixture, permissions: DevicePermission[] = ["chat"]): Promise<{ token: string; device: AuthenticatedDevice }> {
  const { code } = await f.service.createPairCode();
  const requested = await f.service.requestPairing({ code, deviceName: "test-phone", requestedPermissions: permissions });
  await f.service.approvePairingAsAdmin(requested.requestId as string, permissions);
  const claimed = await f.service.claimPairing({ requestId: requested.requestId, requestSecret: requested.requestSecret });
  const token = claimed.token as string;
  return { token, device: await f.service.authenticate(token) };
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition timeout");
}

test("잘못된 코드와 만료된 페어링 코드를 거부한다", async () => {
  const f = await fixture();
  await assert.rejects(
    f.service.requestPairing({ code: "999999", deviceName: "phone" }),
    (error: unknown) => error instanceof BridgeError && error.code === "INVALID_PAIR_CODE",
  );

  const { code } = await f.service.createPairCode();
  await f.store.update((state) => { state.pairCodes.at(-1)!.expiresAt = new Date(Date.now() - 1).toISOString(); });
  await assert.rejects(
    f.service.requestPairing({ code, deviceName: "phone" }),
    (error: unknown) => error instanceof BridgeError && error.code === "EXPIRED_PAIR_CODE",
  );
});

test("명시 승인 뒤 기기별 해시 토큰을 발급하고 폐기한다", async () => {
  const f = await fixture();
  const { code } = await f.service.createPairCode();
  const request = await f.service.requestPairing({ code, deviceName: "Pixel", requestedPermissions: ["chat", "project:read"] });
  const pending = await f.service.claimPairing({ requestId: request.requestId, requestSecret: request.requestSecret });
  assert.equal(pending.status, "pending");
  await f.service.approvePairingAsAdmin(request.requestId as string, ["chat", "project:read"]);
  const [claimed, recovered] = await Promise.all([
    f.service.claimPairing({ requestId: request.requestId, requestSecret: request.requestSecret }),
    f.service.claimPairing({ requestId: request.requestId, requestSecret: request.requestSecret }),
  ]);
  assert.deepEqual(recovered, claimed);
  const token = claimed.token as string;
  const device = await f.service.authenticate(token);
  assert.deepEqual(device.permissions, ["chat", "project:read"]);
  assert.deepEqual(claimed.bridge, { id: (await f.store.read()).bridgeId, name: f.config.bridgeName });
  const state = await f.store.read();
  assert.equal(state.devices.length, 1);
  assert.equal(state.pairRequests[0]!.claimedDeviceId, device.id);
  assert.notEqual(state.devices[0]!.tokenHash, token);
  assert.notEqual(state.pairRequests[0]!.requestSecretHash, request.requestSecret);
  assert.equal(JSON.stringify(state).includes(token), false);
  assert.equal(JSON.stringify(state).includes(request.requestSecret as string), false);
  await f.store.update((next) => {
    next.pairRequests[0]!.expiresAt = new Date(Date.now() - 1).toISOString();
  });
  const recoveredAfterRequestExpiry = await f.service.claimPairing({
    requestId: request.requestId,
    requestSecret: request.requestSecret,
  });
  assert.equal(recoveredAfterRequestExpiry.token, claimed.token);
  assert.equal(
    (recoveredAfterRequestExpiry.device as { id: string }).id,
    (claimed.device as { id: string }).id,
  );
  await f.store.update((next) => {
    next.pairRequests[0]!.expiresAt = new Date(Date.now() + 60_000).toISOString();
    next.pairRequests[0]!.claimedAt = new Date(Date.now() - 61_000).toISOString();
  });
  await assert.rejects(
    f.service.claimPairing({ requestId: request.requestId, requestSecret: request.requestSecret }),
    (error: unknown) => error instanceof BridgeError && error.code === "PAIR_ALREADY_CLAIMED",
  );
  await f.store.update((next) => {
    next.pairRequests[0]!.claimedAt = new Date().toISOString();
  });
  const runningThread = await f.service.createThread(device, { mode: "general" });
  await f.service.postMessage(device, runningThread.id, { content: "slow" });
  await waitFor(async () => (await f.service.getThread(device, runningThread.id)).status === "running");
  await f.service.revokeDevice(device);
  await waitFor(async () => (await f.service.getThread(device, runningThread.id)).status === "idle");
  assert.ok((await f.service.events(device, runningThread.id)).some((event) => event.type === "device.revoked"));
  await assert.rejects(f.service.authenticate(token), (error: unknown) => error instanceof BridgeError && error.code === "INVALID_DEVICE_TOKEN");
  await f.store.update((next) => {
    next.pairRequests[0]!.expiresAt = new Date(Date.now() + 60_000).toISOString();
  });
  await assert.rejects(
    f.service.claimPairing({ requestId: request.requestId, requestSecret: request.requestSecret }),
    (error: unknown) => error instanceof BridgeError && error.code === "PAIR_CLAIM_REVOKED",
  );
});

test("traversal과 프로젝트 밖 심볼릭 링크를 차단한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "lifehub-project-"));
  const outside = await mkdtemp(join(tmpdir(), "lifehub-outside-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "ok.txt"), "ok");
  await symlink(outside, join(root, "escape"));
  assert.equal(await resolveAllowedProjectPath(root, "src/ok.txt"), join(root, "src", "ok.txt"));
  await assert.rejects(resolveAllowedProjectPath(root, "../secret"), /상위 경로/);
  await assert.rejects(resolveAllowedProjectPath(root, "escape/secret"), /심볼릭 링크/);

  const originalRoot = `${root}-original`;
  await rename(root, originalRoot);
  await symlink(outside, root);
  await assert.rejects(resolveAllowedProjectPath(root, "secret"), /프로젝트 루트/);
});

test("스트리밍, SDK thread 영속 재개, 쓰기 승인/거부 및 취소를 처리한다", async () => {
  const f = await fixture();
  const { device } = await pair(f, ["chat", "project:read", "file:write", "command:execute"]);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-codex-project-"));
  const project = await f.service.registerProject(projectRoot, "sample");
  const thread = await f.service.createThread(device, { mode: "codex", projectId: project.id });

  await f.service.postMessage(device, thread.id, { content: "first" });
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");
  const firstThread = await f.service.getThread(device, thread.id);
  assert.equal(firstThread.sdkThreadId, "sdk-persisted-1");
  assert.equal(firstThread.title, "first");
  const summary = (await f.service.listThreads(device)).threads[0]!;
  assert.equal(summary.title, "first");
  assert.equal("messages" in summary, false);
  assert.ok(Array.isArray((await f.service.getThreadDetail(device, thread.id)).messages));
  assert.equal(f.adapter.runs[0]!.sdkThreadId, undefined);
  assert.ok((await f.service.events(device, thread.id)).some((event) => event.type === "message.delta"));

  const resumedService = new BridgeService(f.config, f.store, f.adapter);
  await resumedService.init();
  await resumedService.postMessage(device, thread.id, { content: "second" });
  await waitFor(async () => (await resumedService.getThread(device, thread.id)).status === "idle");
  assert.equal(f.adapter.runs[1]!.sdkThreadId, "sdk-persisted-1");

  const gated = await resumedService.postMessage(device, thread.id, {
    content: "edit file",
    requestedPermissions: ["file:write"],
    approvalContext: { description: "edit", files: ["new.txt"] },
  });
  assert.equal(gated.pendingApproval, true);
  assert.equal(f.adapter.runs.length, 2);
  const approvalId = (gated.approval as { id: string }).id;
  await resumedService.approve(device, thread.id, { approvalId, scope: "once" });
  await waitFor(async () => (await resumedService.getThread(device, thread.id)).status === "idle");
  assert.deepEqual(f.adapter.runs[2]!.permissions, ["file:write"]);
  assert.deepEqual(f.adapter.runs[2]!.approvedFiles, ["new.txt"]);

  const rejected = await resumedService.postMessage(device, thread.id, {
    content: "run command",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["echo hello"] },
  });
  await resumedService.reject(device, thread.id, { approvalId: (rejected.approval as { id: string }).id });
  assert.equal(f.adapter.runs.length, 3);

  await resumedService.postMessage(device, thread.id, { content: "slow" });
  await waitFor(async () => (await resumedService.getThread(device, thread.id)).status === "running");
  assert.equal((await resumedService.cancel(device, thread.id)).cancelled, true);
  await waitFor(async () => (await resumedService.getThread(device, thread.id)).status === "idle");
  assert.ok((await resumedService.events(device, thread.id)).some((event) => event.type === "turn.cancelled"));
});

test("승인 대기 중에는 새 메시지와 중복 승인 요청을 만들지 않는다", async () => {
  const f = await fixture();
  const { device } = await pair(f, ["chat", "project:read", "file:write"]);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-awaiting-approval-project-"));
  const project = await f.service.registerProject(projectRoot, "awaiting-approval");
  const thread = await f.service.createThread(device, { mode: "codex", projectId: project.id });

  const pending = await f.service.postMessage(device, thread.id, {
    content: "edit approved file",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/new.txt"] },
  });
  assert.equal(pending.pendingApproval, true);
  await assert.rejects(
    f.service.postMessage(device, thread.id, { content: "new message while awaiting approval" }),
    (error: unknown) => error instanceof BridgeError && error.status === 409 && error.code === "THREAD_BUSY",
  );

  const state = await f.store.read();
  const storedThread = state.threads.find((entry) => entry.id === thread.id)!;
  assert.equal(storedThread.status, "awaiting-approval");
  assert.equal(storedThread.messages.length, 1);
  assert.equal(state.approvals.filter((entry) => entry.threadId === thread.id && entry.status === "pending").length, 1);
  assert.equal(f.adapter.runs.length, 0);
});

test("최신 대기 작업이 아닌 오래된 승인과 거부는 실행 상태를 바꾸지 않는다", async () => {
  const f = await fixture();
  const { device } = await pair(f, ["chat", "project:read", "file:write"]);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-stale-approval-project-"));
  const project = await f.service.registerProject(projectRoot, "stale-approval");
  const thread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const stale = await f.service.postMessage(device, thread.id, {
    content: "edit approved file",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/old.txt"] },
  });
  const staleApprovalId = (stale.approval as { id: string }).id;
  const latestMessageId = "message-latest-approval-test";
  const latestApprovalId = "approval-latest-test";

  await f.store.update((state) => {
    const storedThread = state.threads.find((entry) => entry.id === thread.id)!;
    const staleApproval = state.approvals.find((entry) => entry.id === staleApprovalId)!;
    const createdAt = new Date().toISOString();
    storedThread.messages.push({
      id: latestMessageId,
      role: "user",
      content: "slow",
      status: "awaiting-approval",
      requestedPermissions: ["file:write"],
      createdAt,
      updatedAt: createdAt,
    });
    state.approvals.push({
      ...staleApproval,
      id: latestApprovalId,
      messageId: latestMessageId,
      description: "latest approval",
      files: ["src/latest.txt"],
      createdAt,
    });
  });

  await assert.rejects(
    f.service.approve(device, thread.id, { approvalId: staleApprovalId }),
    (error: unknown) => error instanceof BridgeError && error.status === 409 && error.code === "APPROVAL_STALE",
  );
  const decisions = await Promise.allSettled([
    f.service.approve(device, thread.id, { approvalId: latestApprovalId }),
    f.service.reject(device, thread.id, { approvalId: staleApprovalId }),
  ]);
  assert.equal(decisions[0]!.status, "fulfilled");
  assert.equal(decisions[1]!.status, "rejected");
  assert.ok(
    decisions[1]!.status === "rejected"
      && decisions[1].reason instanceof BridgeError
      && decisions[1].reason.code === "APPROVAL_STALE",
  );
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "running");
  await waitFor(async () => f.adapter.runs.length === 1);
  assert.equal(f.adapter.runs.length, 1);
  assert.equal(f.adapter.runs[0]!.content, "slow");
  assert.equal((await f.service.getThread(device, thread.id)).status, "running");
  assert.equal((await f.service.cancel(device, thread.id)).cancelled, true);
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");
});

test("기기 권한 전체를 turn 권한으로 승격하지 않고 요청 의도만 최소 승인한다", async () => {
  const f = await fixture();
  const { device } = await pair(f, ["chat", "project:read", "file:write", "command:execute", "build:execute", "git"]);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-minimum-project-"));
  const project = await f.service.registerProject(projectRoot, "minimum");

  const explain = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const accepted = await f.service.postMessage(device, explain.id, {
    content: "Explain the architecture",
    requestedPermissions: ["file:write", "command:execute", "build:execute", "git"],
  });
  assert.deepEqual(accepted.turnPermissions, []);
  await waitFor(async () => (await f.service.getThread(device, explain.id)).status === "idle");
  assert.deepEqual(f.adapter.runs[0]!.permissions, []);

  const edit = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  await assert.rejects(f.service.postMessage(device, edit.id, {
    content: "Fix the layout bug", requestedPermissions: ["file:write"],
  }), (error: unknown) => error instanceof BridgeError && error.code === "APPROVAL_SCOPE_REQUIRED");
  const pending = await f.service.postMessage(device, edit.id, {
    content: "Fix the layout bug",
    requestedPermissions: ["file:write", "command:execute", "build:execute", "git"],
    approvalContext: { files: ["src/Layout.jsx"] },
  });
  assert.equal(pending.pendingApproval, true);
  assert.deepEqual(pending.turnPermissions, ["file:write"]);
  assert.deepEqual((pending.approval as { permissions: string[] }).permissions, ["file:write"]);

  const critical = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const dangerous = await f.service.postMessage(device, critical.id, {
    content: "run rm dist/old.txt",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["rm dist/old.txt"] },
  });
  const approval = dangerous.approval as { id: string; risk: string };
  assert.equal(approval.risk, "critical");
  assert.equal((await f.service.approve(device, critical.id, { approvalId: approval.id, scope: "task" })).scope, "once");
  await waitFor(async () => (await f.service.getThread(device, critical.id)).status === "idle");
});

test("로컬 웹 Codex 작업은 명시한 전체 권한으로 승인 대기 없이 실행하되 기존 안전 경계를 유지한다", async () => {
  const f = await fixture();
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-local-workspace-project-"));
  await mkdir(join(projectRoot, "src"));
  await mkdir(join(projectRoot, "docs"));
  const outside = await mkdtemp(join(tmpdir(), "lifehub-local-workspace-outside-"));
  await writeFile(join(outside, "secret.txt"), "secret");
  await symlink(outside, join(projectRoot, "escape"));
  const project = await f.service.registerProject(projectRoot, "local-workspace");
  const connected = await f.service.connectLocalWebDevice();
  const localDevice = await f.service.authenticate(connected.token as string);
  const requestedPermissions: DevicePermission[] = ["file:write", "command:execute", "build:execute", "git"];

  const general = await f.service.createThread(localDevice, { mode: "general" });
  await assert.rejects(
    f.service.postMessage(localDevice, general.id, { content: "hello", localWorkspaceAccess: true }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 403
      && error.code === "LOCAL_WORKSPACE_ACCESS_FORBIDDEN",
  );

  const { device: pairedDevice } = await pair(f, ["chat", "project:read", ...requestedPermissions]);
  const pairedThread = await f.service.createThread(pairedDevice, { mode: "codex", projectId: project.id });
  await assert.rejects(
    f.service.postMessage(pairedDevice, pairedThread.id, {
      content: "Fix the app",
      requestedPermissions,
      approvalContext: { files: ["src"] },
      localWorkspaceAccess: true,
    }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 403
      && error.code === "LOCAL_WORKSPACE_ACCESS_FORBIDDEN",
  );

  const invalidFlag = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  await assert.rejects(
    f.service.postMessage(localDevice, invalidFlag.id, {
      content: "Fix the app",
      localWorkspaceAccess: "true",
    }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 400
      && error.code === "INVALID_LOCAL_WORKSPACE_ACCESS",
  );

  const missingFiles = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  await assert.rejects(
    f.service.postMessage(localDevice, missingFiles.id, {
      content: "Fix the app",
      requestedPermissions,
      localWorkspaceAccess: true,
    }),
    (error: unknown) => error instanceof BridgeError && error.code === "APPROVAL_SCOPE_REQUIRED",
  );

  const broadCommand = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  const accepted = await f.service.postMessage(localDevice, broadCommand.id, {
    content: "run mismatched command",
    requestedPermissions,
    approvalContext: { files: ["."], commands: ["echo approved"] },
    localWorkspaceAccess: true,
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.pendingApproval, false);
  assert.equal(accepted.localWorkspaceAccess, true);
  assert.deepEqual(accepted.turnPermissions, requestedPermissions);
  await waitFor(async () => (await f.service.getThread(localDevice, broadCommand.id)).status === "idle");
  assert.equal((await f.store.read()).approvals.some((approval) => approval.threadId === broadCommand.id), false);
  assert.deepEqual(f.adapter.runs.at(-1)!.permissions, requestedPermissions);
  assert.deepEqual(f.adapter.runs.at(-1)!.approvedFiles, ["."]);
  assert.deepEqual(f.adapter.runs.at(-1)!.approvedCommands, ["echo approved"]);
  assert.equal(f.adapter.runs.at(-1)!.localWorkspaceAccess, true);
  assert.equal((await f.service.events(localDevice, broadCommand.id)).some((event) => event.type === "security.violation"), false);

  const commandWithoutList = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  const commandWithoutListResult = await f.service.postMessage(localDevice, commandWithoutList.id, {
    content: "run approved command",
    requestedPermissions: ["command:execute"],
    localWorkspaceAccess: true,
  });
  assert.equal(commandWithoutListResult.pendingApproval, false);
  await waitFor(async () => (await f.service.getThread(localDevice, commandWithoutList.id)).status === "idle");

  const safeSequence = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  await f.service.postMessage(localDevice, safeSequence.id, {
    content: "run safe local sequence",
    requestedPermissions,
    approvalContext: { files: ["."] },
    localWorkspaceAccess: true,
  });
  await waitFor(async () => (await f.service.getThread(localDevice, safeSequence.id)).status === "idle");
  assert.equal((await f.service.events(localDevice, safeSequence.id)).some((event) => event.type === "security.violation"), false);

  const missingBuildCapability = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  await f.service.postMessage(localDevice, missingBuildCapability.id, {
    content: "run unapproved build",
    requestedPermissions: ["command:execute"],
    localWorkspaceAccess: true,
  });
  await waitFor(async () => (await f.service.getThread(localDevice, missingBuildCapability.id)).status === "failed");
  assert.ok((await f.service.events(localDevice, missingBuildCapability.id)).some((event) => event.type === "security.violation"));

  const outOfScopeFile = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  await assert.rejects(
    f.service.postMessage(localDevice, outOfScopeFile.id, {
      content: "edit approved file",
      requestedPermissions,
      approvalContext: { files: ["docs"] },
      localWorkspaceAccess: true,
    }),
    (error: unknown) => error instanceof BridgeError && error.code === "APPROVAL_SCOPE_REQUIRED",
  );

  for (const content of ["read symlink", "run external path", "edit file unexpectedly", "edit outside symlink", "unsafe command", "unsafe compound command"]) {
    const guarded = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
    await f.service.postMessage(localDevice, guarded.id, {
      content,
      requestedPermissions,
      approvalContext: { files: ["."] },
      localWorkspaceAccess: true,
    });
    await waitFor(async () => (await f.service.getThread(localDevice, guarded.id)).status === "failed");
    assert.ok((await f.service.events(localDevice, guarded.id)).some((event) => event.type === "security.violation"));
  }

  const critical = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  const criticalRequest = await f.service.postMessage(localDevice, critical.id, {
    content: "run critical command",
    requestedPermissions,
    approvalContext: { files: ["."], commands: ["rm src/old.txt"] },
    localWorkspaceAccess: true,
  });
  assert.equal(criticalRequest.pendingApproval, true);
  assert.equal((criticalRequest.approval as { risk: string; localWorkspaceAccess: boolean }).risk, "critical");
  assert.equal((criticalRequest.approval as { risk: string; localWorkspaceAccess: boolean }).localWorkspaceAccess, true);
  const criticalApproval = criticalRequest.approval as { id: string };
  const criticalDecision = await f.service.approve(localDevice, critical.id, { approvalId: criticalApproval.id, scope: "task" });
  assert.equal(criticalDecision.scope, "once");
  await waitFor(async () => (await f.service.getThread(localDevice, critical.id)).status === "idle");
  assert.equal(f.adapter.runs.at(-1)!.localWorkspaceAccess, true);
  assert.equal(f.adapter.runs.at(-1)!.criticalApproval, true);
});

test("SDK runtime event가 승인 범위를 벗어나면 중단하고 보안 이벤트를 남긴다", async () => {
  const f = await fixture();
  const { device } = await pair(f, ["chat", "project:read", "file:write", "command:execute"]);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-policy-project-"));
  await mkdir(join(projectRoot, "src"));
  const outside = await mkdtemp(join(tmpdir(), "lifehub-policy-outside-"));
  await symlink(outside, join(projectRoot, "escape"));
  const project = await f.service.registerProject(projectRoot, "policy");

  const commandThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  await f.service.postMessage(device, commandThread.id, { content: "unsafe command" });
  await waitFor(async () => (await f.service.getThread(device, commandThread.id)).status === "failed");
  assert.ok((await f.service.events(device, commandThread.id)).some((event) => event.type === "security.violation"));

  await assert.rejects(f.service.postMessage(device, commandThread.id, {
    content: "run cat",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["cat escape/secret.txt"] },
  }), (error: unknown) => error instanceof BridgeError && error.code === "PATH_OUTSIDE_PROJECT");

  const readSymlink = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  await f.service.postMessage(device, readSymlink.id, { content: "read symlink" });
  await waitFor(async () => (await f.service.getThread(device, readSymlink.id)).status === "failed");
  assert.ok((await f.service.events(device, readSymlink.id)).some((event) => event.type === "security.violation"));

  for (const content of ["unsafe traversal command", "unsafe compound command", "run external path", "use mcp", "use web search"]) {
    const unsafeRead = await f.service.createThread(device, { mode: "codex", projectId: project.id });
    await f.service.postMessage(device, unsafeRead.id, { content });
    await waitFor(async () => (await f.service.getThread(device, unsafeRead.id)).status === "failed");
    assert.ok((await f.service.events(device, unsafeRead.id)).some((event) => event.type === "security.violation"));
  }

  const mismatchThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const mismatch = await f.service.postMessage(device, mismatchThread.id, {
    content: "run mismatched command",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["echo approved"] },
  });
  await f.service.approve(device, mismatchThread.id, { approvalId: (mismatch.approval as { id: string }).id });
  await waitFor(async () => (await f.service.getThread(device, mismatchThread.id)).status === "failed");

  const wrappedThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const wrapped = await f.service.postMessage(device, wrappedThread.id, {
    content: "run wrapped command",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["uname -s"] },
  });
  await f.service.approve(device, wrappedThread.id, { approvalId: (wrapped.approval as { id: string }).id });
  await waitFor(async () => (await f.service.getThread(device, wrappedThread.id)).status === "idle");
  assert.equal((await f.service.events(device, wrappedThread.id)).some((event) => event.type === "security.violation"), false);

  const allowedFileThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const allowedFile = await f.service.postMessage(device, allowedFileThread.id, {
    content: "edit approved file",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/new.txt"] },
  });
  await f.service.approve(device, allowedFileThread.id, { approvalId: (allowedFile.approval as { id: string }).id });
  await waitFor(async () => (await f.service.getThread(device, allowedFileThread.id)).status === "idle");
  assert.ok((await f.service.events(device, allowedFileThread.id)).some((event) => event.type === "file.changed"));

  const deleteThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const unexpectedDelete = await f.service.postMessage(device, deleteThread.id, {
    content: "edit file unexpectedly",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/new.txt"] },
  });
  await f.service.approve(device, deleteThread.id, { approvalId: (unexpectedDelete.approval as { id: string }).id });
  await waitFor(async () => (await f.service.getThread(device, deleteThread.id)).status === "failed");
  assert.ok((await f.service.events(device, deleteThread.id)).some((event) => event.type === "security.violation"));

  const outsideThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const outsideFile = await f.service.postMessage(device, outsideThread.id, {
    content: "edit outside symlink",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/new.txt"] },
  });
  await f.service.approve(device, outsideThread.id, { approvalId: (outsideFile.approval as { id: string }).id });
  await waitFor(async () => (await f.service.getThread(device, outsideThread.id)).status === "failed");
  assert.ok((await f.service.events(device, outsideThread.id)).some((event) => event.type === "security.violation"));
});

test("task 승인은 정확히 승인한 파일과 명령 범위의 부분집합에서만 재사용한다", async () => {
  const f = await fixture();
  const { device } = await pair(f, ["chat", "project:read", "file:write", "command:execute"]);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-task-scope-project-"));
  await mkdir(join(projectRoot, "src"));
  const project = await f.service.registerProject(projectRoot, "task-scope");
  const thread = await f.service.createThread(device, { mode: "codex", projectId: project.id });

  const first = await f.service.postMessage(device, thread.id, {
    content: "edit task file",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/task.txt"] },
  });
  await f.service.approve(device, thread.id, { approvalId: (first.approval as { id: string }).id, scope: "task" });
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");
  const runCount = f.adapter.runs.length;

  const sameScope = await f.service.postMessage(device, thread.id, {
    content: "edit task file",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/task.txt"] },
  });
  assert.equal(sameScope.pendingApproval, false);
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");
  assert.equal(f.adapter.runs.length, runCount + 1);
  assert.deepEqual(f.adapter.runs.at(-1)!.approvedFiles, ["src/task.txt"]);

  const expanded = await f.service.postMessage(device, thread.id, {
    content: "edit other file",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["src/other.txt"] },
  });
  assert.equal(expanded.pendingApproval, true);
  assert.equal(f.adapter.runs.length, runCount + 1);

  const commandThread = await f.service.createThread(device, { mode: "codex", projectId: project.id });
  const commandFirst = await f.service.postMessage(device, commandThread.id, {
    content: "run approved command",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["echo approved"] },
  });
  await f.service.approve(device, commandThread.id, { approvalId: (commandFirst.approval as { id: string }).id, scope: "task" });
  await waitFor(async () => (await f.service.getThread(device, commandThread.id)).status === "idle");
  const repeated = await f.service.postMessage(device, commandThread.id, {
    content: "run approved command",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["echo approved"] },
  });
  assert.equal(repeated.pendingApproval, false);
  await waitFor(async () => (await f.service.getThread(device, commandThread.id)).status === "idle");
  const differentCommand = await f.service.postMessage(device, commandThread.id, {
    content: "run another command",
    requestedPermissions: ["command:execute"],
    approvalContext: { commands: ["echo other"] },
  });
  assert.equal(differentCommand.pendingApproval, true);
});

test("보호 경로 등록을 막고 Bridge 재시작 시 중단된 turn을 복구한다", async () => {
  const f = await fixture();
  await mkdir(f.config.codexHome, { recursive: true });
  await assert.rejects(
    f.service.registerProject(f.config.codexHome, "secrets"),
    (error: unknown) => error instanceof BridgeError && error.code === "PROTECTED_PROJECT_PATH",
  );

  const { device } = await pair(f, ["chat", "project:read"]);
  const stableRoot = await mkdtemp(join(tmpdir(), "lifehub-root-swap-"));
  const swappedOutside = await mkdtemp(join(tmpdir(), "lifehub-root-swap-outside-"));
  const registered = await f.service.registerProject(stableRoot, "root-swap");
  const swappedThread = await f.service.createThread(device, { mode: "codex", projectId: registered.id });
  await rename(stableRoot, `${stableRoot}-original`);
  await symlink(swappedOutside, stableRoot);
  await assert.rejects(
    f.service.changes(device, swappedThread.id),
    (error: unknown) => error instanceof BridgeError && error.code === "PROJECT_ROOT_CHANGED",
  );
  await f.service.postMessage(device, swappedThread.id, { content: "Explain the project" });
  await waitFor(async () => (await f.service.getThread(device, swappedThread.id)).status === "failed");

  const thread = await f.service.createThread(device, { mode: "general" });
  await f.store.update((state) => {
    const target = state.threads.find((entry) => entry.id === thread.id)!;
    target.status = "running";
    target.taskGrants = ["file:write"] as unknown as typeof target.taskGrants;
    target.messages.push({
      id: "interrupted", role: "assistant", content: "partial", status: "streaming",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  });
  const restarted = new BridgeService(f.config, new JsonStore(f.config), f.adapter);
  await restarted.init();
  const recovered = await restarted.getThread(device, thread.id);
  assert.equal(recovered.status, "failed");
  assert.equal(recovered.messages.at(-1)!.status, "failed");
  assert.deepEqual(recovered.taskGrants, []);

  await f.store.update((state) => {
    const target = state.threads.find((entry) => entry.id === thread.id)!;
    for (let index = 0; index < 220; index += 1) {
      target.messages.push({
        id: `history-${index}`, role: "assistant", content: "x".repeat(5_000), status: "completed",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
  });
  const bounded = await restarted.getThreadDetail(device, thread.id);
  assert.ok((bounded.messages as unknown[]).length < 220);
  assert.equal((bounded.truncated as { messages: boolean }).messages, true);
});

test("일반 AI를 read-only로 분리하고 미로그인 상태를 안전하게 알린다", async () => {
  const f = await fixture();
  const { device } = await pair(f);
  await assert.rejects(
    f.service.listProjects(device),
    (error: unknown) => error instanceof BridgeError && error.code === "PERMISSION_DENIED",
  );
  const thread = await f.service.createThread(device, { mode: "general" });
  await assert.rejects(
    f.service.postMessage(device, thread.id, { content: "write", requestedPermissions: ["file:write"] }),
    (error: unknown) => error instanceof BridgeError && error.code === "GENERAL_MODE_READ_ONLY",
  );
  await f.service.postMessage(device, thread.id, { content: "hello" });
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");
  assert.equal(f.adapter.runs[0]!.mode, "general");
  assert.deepEqual(f.adapter.runs[0]!.permissions, []);

  const limited = await f.service.createThread(device, { mode: "general" });
  await f.service.postMessage(device, limited.id, { content: "usage limit" });
  await waitFor(async () => (await f.service.getThread(device, limited.id)).status === "failed");
  const limitedThread = await f.service.getThread(device, limited.id);
  assert.match(limitedThread.messages.at(-1)!.error || "", /사용량 한도/);
  assert.doesNotMatch(limitedThread.messages.at(-1)!.error || "", /private-detail/);
  assert.ok((await f.service.events(device, limited.id)).some((event) => event.type === "turn.failed" && event.data.code === "CODEX_USAGE_LIMIT"));

  f.adapter.loggedIn = false;
  await assert.rejects(
    f.service.postMessage(device, thread.id, { content: "offline" }),
    (error: unknown) => error instanceof BridgeError && error.code === "CODEX_LOGIN_REQUIRED" && error.status === 503,
  );
  assert.equal(f.adapter.runs.length, 2);
  assert.deepEqual((await f.service.deviceStatus(device)).codex, { loggedIn: false, status: "not-logged-in" });
});

test("HTTP 인증/CORS/요청 크기와 SSE 재연결 replay를 적용한다", async () => {
  const f = await fixture();
  f.config.bodyLimitBytes = 1_024;
  const { token, device } = await pair(f);
  const thread = await f.service.createThread(device, { mode: "general" });
  await f.service.postMessage(device, thread.id, { content: "stream" });
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");

  const http = createBridgeHttpServer(f.service, f.config);
  servers.push(http);
  const address = await http.listen();
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/api/health`)).status, 401);
  assert.equal((await fetch(`${base}/api/health`, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${base}/api/projects`, { headers: { Authorization: `Bearer ${token}`, Origin: "https://evil.example" } })).status, 403);
  const listResponse = await fetch(`${base}/api/threads`, { headers: { Authorization: `Bearer ${token}` } });
  const listed = await listResponse.json() as { threads: Array<Record<string, unknown>> };
  assert.equal("messages" in listed.threads[0]!, false);
  const detailResponse = await fetch(`${base}/api/threads/${thread.id}`, { headers: { Authorization: `Bearer ${token}` } });
  const detailed = await detailResponse.json() as { thread: { messages: unknown[] } };
  assert.ok(detailed.thread.messages.length >= 2);
  assert.equal((await fetch(`${base}/api/threads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x".repeat(2_000) }),
  })).status, 413);

  const first = await fetch(`${base}/api/threads/${thread.id}/events?after=0`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(first.status, 200);
  const firstReader = first.body!.getReader();
  const firstChunk = new TextDecoder().decode((await firstReader.read()).value);
  assert.match(firstChunk, /message\.delta/);
  await firstReader.cancel();

  const lastEvent = (await f.service.events(device, thread.id)).at(-1)!.id;
  await f.service.postMessage(device, thread.id, { content: "reconnected" });
  await waitFor(async () => (await f.service.getThread(device, thread.id)).status === "idle");
  const second = await fetch(`${base}/api/threads/${thread.id}/events`, {
    headers: { Authorization: `Bearer ${token}`, "Last-Event-ID": String(lastEvent) },
  });
  const secondReader = second.body!.getReader();
  const secondChunk = new TextDecoder().decode((await secondReader.read()).value);
  assert.match(secondChunk, /reconnected/);
  await secondReader.cancel();
});

test("필수 HTTP API 전체가 페어링, 프로젝트, thread, 승인, 취소, 폐기를 연결한다", async () => {
  const f = await fixture();
  const http = createBridgeHttpServer(f.service, f.config);
  servers.push(http);
  const address = await http.listen();
  const base = `http://127.0.0.1:${address.port}`;
  const jsonHeaders = { "Content-Type": "application/json" };
  const { code } = await f.service.createPairCode();

  const pairResponse = await fetch(`${base}/api/pair/request`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({
      code, deviceName: "http-phone",
      requestedPermissions: ["chat", "project:read", "file:write", "command:execute", "build:execute", "git"],
    }),
  });
  assert.equal(pairResponse.status, 202);
  const pairRequest = await pairResponse.json() as { requestId: string; requestSecret: string };
  assert.equal((await fetch(`${base}/api/pair/approve`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify(pairRequest),
  })).status, 202);

  const adminToken = await f.store.readAdminToken();
  assert.equal((await fetch(`${base}/api/pair/approve`, {
    method: "POST",
    headers: { ...jsonHeaders, "X-LifeHub-Admin-Token": adminToken },
    body: JSON.stringify({ requestId: pairRequest.requestId, permissions: ["chat", "project:read", "file:write", "command:execute"] }),
  })).status, 200);
  const claimResponse = await fetch(`${base}/api/pair/approve`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify(pairRequest),
  });
  assert.equal(claimResponse.status, 200);
  const claim = await claimResponse.json() as { token: string; bridge: { id: string; name: string } };
  const recoveredClaimResponse = await fetch(`${base}/api/pair/approve`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify(pairRequest),
  });
  assert.equal(recoveredClaimResponse.status, 200);
  const recoveredClaim = await recoveredClaimResponse.json() as { token: string; bridge: { id: string; name: string } };
  assert.deepEqual(recoveredClaim, claim);
  assert.ok(claim.bridge.id && claim.bridge.name);
  assert.equal("host" in claim.bridge, false);
  const authHeaders = { ...jsonHeaders, Authorization: `Bearer ${claim.token}` };

  assert.equal((await fetch(`${base}/api/health`, { headers: authHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/device/status`, { headers: authHeaders })).status, 200);
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-http-project-"));
  const registerResponse = await fetch(`${base}/api/projects/register`, {
    method: "POST",
    headers: { ...jsonHeaders, "X-LifeHub-Admin-Token": adminToken },
    body: JSON.stringify({ path: projectRoot, name: "http-project" }),
  });
  assert.equal(registerResponse.status, 201);
  const registered = await registerResponse.json() as { project: { id: string; name: string } };
  assert.equal((await fetch(`${base}/api/projects`, { headers: authHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/threads`, { headers: authHeaders })).status, 200);

  const createGeneral = await fetch(`${base}/api/threads`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ mode: "general" }),
  });
  const general = (await createGeneral.json() as { thread: { id: string } }).thread;
  assert.equal((await fetch(`${base}/api/threads/${general.id}`, { headers: authHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/threads/${general.id}/messages`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ content: "hello" }),
  })).status, 202);

  const createSlow = await fetch(`${base}/api/threads`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ mode: "general" }),
  });
  const slow = (await createSlow.json() as { thread: { id: string } }).thread;
  await fetch(`${base}/api/threads/${slow.id}/messages`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ content: "slow" }),
  });
  const device = await f.service.authenticate(claim.token);
  await waitFor(async () => (await f.service.getThread(device, slow.id)).status === "running");
  assert.equal((await fetch(`${base}/api/threads/${slow.id}/cancel`, {
    method: "POST", headers: authHeaders, body: "{}",
  })).status, 200);
  await waitFor(async () => (await f.service.getThread(device, slow.id)).status === "idle");

  const createCodex = await fetch(`${base}/api/threads`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({ mode: "codex", projectId: registered.project.id }),
  });
  const codex = (await createCodex.json() as { thread: { id: string } }).thread;
  const rejectedMessage = await fetch(`${base}/api/threads/${codex.id}/messages`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({
      content: "edit file", requestedPermissions: ["file:write"], approvalContext: { files: ["new.txt"] },
    }),
  });
  const rejectedPayload = await rejectedMessage.json() as { approval: { id: string } };
  assert.equal((await fetch(`${base}/api/threads/${codex.id}/reject`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({ approvalId: rejectedPayload.approval.id }),
  })).status, 200);

  const approvedMessage = await fetch(`${base}/api/threads/${codex.id}/messages`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({
      content: "edit file", requestedPermissions: ["file:write"], approvalContext: { files: ["new.txt"] },
    }),
  });
  const approvedPayload = await approvedMessage.json() as { approval: { id: string } };
  assert.equal((await fetch(`${base}/api/threads/${codex.id}/approve`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({ approvalId: approvedPayload.approval.id, scope: "once" }),
  })).status, 200);
  await waitFor(async () => (await f.service.getThread(device, codex.id)).status === "idle");
  assert.equal((await fetch(`${base}/api/threads/${codex.id}/changes`, { headers: authHeaders })).status, 200);

  assert.equal((await fetch(`${base}/api/pair/revoke`, {
    method: "POST", headers: authHeaders, body: "{}",
  })).status, 200);
  assert.equal((await fetch(`${base}/api/health`, { headers: authHeaders })).status, 401);
});

test("원격 명령 API가 opt-in, 프로젝트·기기 권한, 일회성 확인을 강제한다", async () => {
  const f = await fixture();
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-remote-command-project-"));
  const project = await f.service.registerProject(projectRoot, "remote-sample");
  const { token } = await pair(f, ["chat", "project:read", "file:write", "command:execute", "build:execute", "git"]);
  const http = createBridgeHttpServer(f.service, f.config);
  servers.push(http);
  const address = await http.listen();
  const base = `http://127.0.0.1:${address.port}`;
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const disabledStatus = await fetch(`${base}/api/device/status`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await disabledStatus.json() as { capabilities: { remoteCommands: boolean } }).capabilities.remoteCommands, false);
  assert.equal((await fetch(`${base}/api/projects/${project.id}/commands/prepare`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ command: "pwd" }),
  })).status, 403);

  f.config.remoteCommandsEnabled = true;
  const enabledStatus = await fetch(`${base}/api/device/status`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await enabledStatus.json() as { capabilities: { remoteCommands: boolean } }).capabilities.remoteCommands, true);
  assert.equal((await fetch(`${base}/api/projects/${project.id}/commands/prepare`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: "{}",
  })).status, 415);

  const prepareResponse = await fetch(`${base}/api/projects/${project.id}/commands/prepare`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ command: "touch changed.txt" }),
  });
  assert.equal(prepareResponse.status, 200);
  const prepared = await prepareResponse.json() as {
    approval: { id: string; command: string; permissions: string[]; project: { id: string; name: string }; expiresAt: string };
  };
  assert.equal(prepared.approval.command, "touch changed.txt");
  assert.deepEqual(prepared.approval.permissions, ["command:execute", "file:write"]);
  assert.deepEqual(prepared.approval.project, { id: project.id, name: "remote-sample" });
  assert.ok(Date.parse(prepared.approval.expiresAt) > Date.now());
  await assert.rejects(access(join(projectRoot, "changed.txt")));

  const executeResponse = await fetch(`${base}/api/projects/${project.id}/commands/execute`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ approvalId: prepared.approval.id }),
  });
  assert.equal(executeResponse.status, 200);
  const executed = await executeResponse.json() as {
    result: { command: string; exitCode: number; timedOut: boolean; project: { id: string; name: string } };
  };
  assert.equal(executed.result.command, "touch changed.txt");
  assert.equal(executed.result.exitCode, 0);
  assert.equal(executed.result.timedOut, false);
  assert.deepEqual(executed.result.project, { id: project.id, name: "remote-sample" });
  await access(join(projectRoot, "changed.txt"));

  const replay = await fetch(`${base}/api/projects/${project.id}/commands/execute`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ approvalId: prepared.approval.id }),
  });
  assert.equal(replay.status, 404);

  const parallelReplayPrepare = await fetch(`${base}/api/projects/${project.id}/commands/prepare`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ command: "touch replay-once.txt" }),
  });
  assert.equal(parallelReplayPrepare.status, 200);
  const parallelApprovalId = ((await parallelReplayPrepare.json()) as { approval: { id: string } }).approval.id;
  const parallelReplayResults = await Promise.all([1, 2].map(() => (
    fetch(`${base}/api/projects/${project.id}/commands/execute`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ approvalId: parallelApprovalId }),
    })
  )));
  assert.deepEqual(parallelReplayResults.map((response) => response.status).sort(), [200, 404]);
  await access(join(projectRoot, "replay-once.txt"));

  await writeFile(join(projectRoot, "wait.mjs"), "setTimeout(() => {}, 300);\n", "utf8");
  const prepareWaitCommand = async (): Promise<string> => {
    const response = await fetch(`${base}/api/projects/${project.id}/commands/prepare`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ command: "node wait.mjs" }),
    });
    assert.equal(response.status, 200);
    return ((await response.json()) as { approval: { id: string } }).approval.id;
  };
  const [firstApprovalId, secondApprovalId] = await Promise.all([prepareWaitCommand(), prepareWaitCommand()]);
  const concurrentResults = await Promise.all([firstApprovalId, secondApprovalId].map((approvalId) => (
    fetch(`${base}/api/projects/${project.id}/commands/execute`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ approvalId }),
    })
  )));
  assert.deepEqual(concurrentResults.map((response) => response.status).sort(), [200, 409]);

  const revokePrepare = await fetch(`${base}/api/projects/${project.id}/commands/prepare`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ command: "touch revoked-must-not-run.txt" }),
  });
  assert.equal(revokePrepare.status, 200);
  const revokeApprovalId = ((await revokePrepare.json()) as { approval: { id: string } }).approval.id;
  const originalRead = f.store.read.bind(f.store);
  let releaseDelayedRead!: () => void;
  let signalReadStarted!: () => void;
  const delayedRead = new Promise<void>((resolve) => { releaseDelayedRead = resolve; });
  const readStarted = new Promise<void>((resolve) => { signalReadStarted = resolve; });
  let delayNextRead = true;
  f.store.read = async () => {
    if (delayNextRead) {
      delayNextRead = false;
      signalReadStarted();
      await delayedRead;
    }
    return originalRead();
  };
  try {
    const execution = fetch(`${base}/api/projects/${project.id}/commands/execute`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ approvalId: revokeApprovalId }),
    });
    await readStarted;
    const revoke = await fetch(`${base}/api/pair/revoke`, {
      method: "POST", headers: authHeaders, body: "{}",
    });
    assert.equal(revoke.status, 200);
    releaseDelayedRead();
    assert.equal((await execution).status, 499);
    await assert.rejects(access(join(projectRoot, "revoked-must-not-run.txt")));
  } finally {
    releaseDelayedRead();
    f.store.read = originalRead;
  }
});

test("직접 연 로컬 브라우저는 코드 없이 전용 기기 토큰을 안전하게 발급·회전한다", async () => {
  const f = await fixture();
  const projectRoot = await mkdtemp(join(tmpdir(), "lifehub-local-browser-project-"));
  await mkdir(join(projectRoot, "src"));
  const project = await f.service.registerProject(projectRoot, "local-browser-project");
  const http = createBridgeHttpServer(f.service, f.config);
  servers.push(http);
  const address = await http.listen();
  const base = `http://127.0.0.1:${address.port}`;
  const origin = "http://localhost:5173";
  const jsonHeaders = { Origin: origin, "Content-Type": "application/json" };

  const preflight = await fetch(`${base}/api/local/connect`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);

  const firstResponse = await fetch(`${base}/api/local/connect`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ deviceName: "로컬 브라우저 A" }),
  });
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.headers.get("access-control-allow-origin"), origin);
  const first = await firstResponse.json() as {
    status: string;
    token: string;
    bridge: { id: string; name: string };
    device: AuthenticatedDevice & { createdAt: string };
  };
  assert.equal(first.status, "connected");
  assert.match(first.token, /^lhb_device_local_web\.[A-Za-z0-9_-]+$/);
  assert.ok(first.bridge.id && first.bridge.name);
  assert.equal(first.device.name, "로컬 브라우저 A");
  assert.deepEqual(first.device.permissions, [...DEVICE_PERMISSIONS]);
  assert.deepEqual((await f.service.authenticate(first.token)).permissions, [...DEVICE_PERMISSIONS]);
  const localStatus = await fetch(`${base}/api/device/status`, {
    headers: { Origin: origin, Authorization: `Bearer ${first.token}` },
  });
  assert.equal(localStatus.status, 200);
  assert.equal(localStatus.headers.get("access-control-allow-origin"), origin);
  assert.equal((await fetch(`${base}/api/device/status`, {
    headers: { Origin: "https://evil.example", Authorization: `Bearer ${first.token}` },
  })).status, 403);

  const firstState = await f.store.read();
  const stored = firstState.devices.find((device) => device.id === first.device.id)!;
  assert.ok(stored);
  assert.notEqual(stored.tokenHash, first.token);

  const secondResponse = await fetch(`${base}/api/local/connect`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ deviceName: "로컬 브라우저 B" }),
  });
  assert.equal(secondResponse.status, 200);
  const second = await secondResponse.json() as { token: string; device: AuthenticatedDevice & { createdAt: string } };
  assert.equal(second.device.id, first.device.id);
  assert.equal(second.device.createdAt, first.device.createdAt);
  assert.equal(second.device.name, "로컬 브라우저 B");
  assert.notEqual(second.token, first.token);
  await assert.rejects(
    f.service.authenticate(first.token),
    (error: unknown) => error instanceof BridgeError && error.code === "INVALID_DEVICE_TOKEN",
  );
  assert.equal((await f.service.authenticate(second.token)).id, first.device.id);
  assert.equal((await f.store.read()).devices.filter((device) => device.id === first.device.id).length, 1);

  const restarted = new BridgeService(f.config, f.store, f.adapter);
  await restarted.init();
  assert.equal((await restarted.authenticate(second.token)).id, first.device.id);

  const localDevice = await f.service.authenticate(second.token);
  const localThread = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  const localWorkspaceResponse = await fetch(`${base}/api/threads/${localThread.id}/messages`, {
    method: "POST",
    headers: { ...jsonHeaders, Authorization: `Bearer ${second.token}` },
    body: JSON.stringify({
      content: "trusted local workspace turn",
      requestedPermissions: ["command:execute"],
      localWorkspaceAccess: true,
    }),
  });
  assert.equal(localWorkspaceResponse.status, 202);
  assert.equal((await localWorkspaceResponse.json() as { localWorkspaceAccess: boolean }).localWorkspaceAccess, true);
  await waitFor(async () => (await f.service.getThread(localDevice, localThread.id)).status === "idle");

  const criticalThread = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  const criticalResponse = await fetch(`${base}/api/threads/${criticalThread.id}/messages`, {
    method: "POST",
    headers: { ...jsonHeaders, Authorization: `Bearer ${second.token}` },
    body: JSON.stringify({
      content: "run critical command",
      requestedPermissions: ["file:write", "command:execute", "build:execute", "git"],
      approvalContext: { files: ["."], commands: ["rm src/old.txt"] },
      localWorkspaceAccess: true,
    }),
  });
  assert.equal(criticalResponse.status, 202);
  const criticalBody = await criticalResponse.json() as { approval: { id: string; risk: string } };
  assert.equal(criticalBody.approval.risk, "critical");
  assert.equal((await fetch(`${base}/api/threads/${criticalThread.id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${second.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ approvalId: criticalBody.approval.id, scope: "once" }),
  })).status, 403);
  assert.equal((await fetch(`${base}/api/threads/${criticalThread.id}/approve`, {
    method: "POST",
    headers: { ...jsonHeaders, Authorization: `Bearer ${second.token}` },
    body: JSON.stringify({ approvalId: criticalBody.approval.id, scope: "once" }),
  })).status, 200);

  const nonBrowserThread = await f.service.createThread(localDevice, { mode: "codex", projectId: project.id });
  assert.equal((await fetch(`${base}/api/threads/${nonBrowserThread.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${second.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: "no browser origin", localWorkspaceAccess: true }),
  })).status, 403);

  assert.equal((await fetch(`${base}/api/local/connect`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status, 403);
  const nonLoopbackHostStatus = await new Promise<number>((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      path: "/api/local/connect",
      method: "POST",
      headers: {
        Host: "bridge.example",
        Origin: origin,
        "Content-Type": "application/json",
        "Content-Length": "2",
      },
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode || 0));
    });
    request.once("error", reject);
    request.end("{}");
  });
  assert.equal(nonLoopbackHostStatus, 403);
  assert.equal((await fetch(`${base}/api/local/connect`, {
    method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}",
  })).status, 403);
  assert.equal((await fetch(`${base}/api/local/connect`, {
    method: "POST", headers: { ...jsonHeaders, "X-Forwarded-For": "127.0.0.1" }, body: "{}",
  })).status, 403);
  assert.equal((await fetch(`${base}/api/local/connect`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "text/plain" }, body: "{}",
  })).status, 415);
});

test("관리자 웹이 인증된 코드 발급, 페어링 승인, 기기 해제를 안전하게 제공한다", async () => {
  const f = await fixture();
  const http = createBridgeHttpServer(f.service, f.config);
  servers.push(http);
  const address = await http.listen();
  const base = `http://127.0.0.1:${address.port}`;
  const adminToken = await f.store.readAdminToken();
  const adminAuthorization = `Basic ${Buffer.from(`orbit:${adminToken}`, "utf8").toString("base64")}`;
  const adminHeaders = { Authorization: adminAuthorization };
  const adminJsonHeaders = { ...adminHeaders, Origin: base, "Content-Type": "application/json" };

  const redirect = await fetch(`${base}/admin`, { redirect: "manual" });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/admin/");

  const unauthenticated = await fetch(`${base}/admin/`);
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get("www-authenticate") || "", /Orbit Admin/);
  assert.equal((await fetch(`${base}/admin/`, {
    headers: { Authorization: `Basic ${Buffer.from("orbit:wrong").toString("base64")}` },
  })).status, 401);
  assert.equal((await fetch(`${base}/admin/api/status`, {
    headers: { Authorization: "Bearer device-token" },
  })).status, 401);

  const pageResponse = await fetch(`${base}/admin/`, { headers: adminHeaders });
  assert.equal(pageResponse.status, 200);
  assert.equal(pageResponse.headers.get("cache-control"), "no-store");
  assert.match(pageResponse.headers.get("content-security-policy") || "", /default-src 'none'/);
  assert.match(pageResponse.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  const page = await pageResponse.text();
  assert.match(page, /Orbit 관리자/);
  assert.doesNotMatch(page, new RegExp(adminToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const scriptResponse = await fetch(`${base}/admin/admin.js`, { headers: adminHeaders });
  assert.equal(scriptResponse.status, 200);
  const script = await scriptResponse.text();
  assert.match(script, /\/admin\/api\/pair-code/);
  assert.match(page, /연결 진행 중/);
  assert.match(page, /연결 완료/);
  assert.match(script, /awaitingPairClaims/);
  assert.match(script, /휴대폰 연결 완료 대기/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.doesNotMatch(script, new RegExp(adminToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.equal((await fetch(`${base}/admin/api/status`, {
    headers: { ...adminHeaders, Origin: "https://evil.example" },
  })).status, 403);
  const statusResponse = await fetch(`${base}/admin/api/status`, {
    headers: { ...adminHeaders, Origin: base },
  });
  assert.equal(statusResponse.status, 200);
  const initialStatusText = await statusResponse.text();
  assert.doesNotMatch(initialStatusText, /tokenHash|requestSecretHash|codeHash|rootPath|realPath/);
  assert.doesNotMatch(initialStatusText, new RegExp(adminToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.equal((await fetch(`${base}/admin/api/pair-code`, {
    method: "POST",
    headers: { ...adminHeaders, Origin: base, "Content-Type": "text/plain" },
    body: "{}",
  })).status, 415);

  const codeResponse = await fetch(`${base}/admin/api/pair-code`, {
    method: "POST", headers: adminJsonHeaders, body: "{}",
  });
  assert.equal(codeResponse.status, 201);
  const pairCode = await codeResponse.json() as { code: string; expiresAt: string };
  assert.match(pairCode.code, /^\d{6}$/);
  assert.ok(Date.parse(pairCode.expiresAt) > Date.now());

  const maliciousDeviceName = '\"><img src=x onerror=alert(1)>';
  const pairResponse = await fetch(`${base}/api/pair/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: pairCode.code, deviceName: maliciousDeviceName, requestedPermissions: ["chat"] }),
  });
  assert.equal(pairResponse.status, 202);
  const pairRequest = await pairResponse.json() as { requestId: string; requestSecret: string };

  const pendingResponse = await fetch(`${base}/admin/api/status`, { headers: adminHeaders });
  const pending = await pendingResponse.json() as {
    pendingPairRequests: Array<{ id: string; deviceName: string }>;
    awaitingPairClaims: Array<{ id: string }>;
  };
  assert.equal(pending.pendingPairRequests.length, 1);
  assert.equal(pending.pendingPairRequests[0]!.deviceName, maliciousDeviceName);
  assert.equal(pending.awaitingPairClaims.length, 0);

  const approveResponse = await fetch(`${base}/admin/api/pair/approve`, {
    method: "POST", headers: adminJsonHeaders, body: JSON.stringify({ requestId: pairRequest.requestId }),
  });
  assert.equal(approveResponse.status, 200);

  const approvedResponse = await fetch(`${base}/admin/api/status`, { headers: adminHeaders });
  const approvedText = await approvedResponse.text();
  const approved = JSON.parse(approvedText) as {
    pendingPairRequests: Array<{ id: string }>;
    awaitingPairClaims: Array<{
      id: string;
      deviceName: string;
      approvedPermissions: string[];
      status: string;
      approvedAt: string;
      expiresAt: string;
    }>;
    devices: Array<{ id: string }>;
  };
  assert.equal(approved.pendingPairRequests.length, 0);
  assert.deepEqual(approved.awaitingPairClaims, [{
    id: pairRequest.requestId,
    deviceName: maliciousDeviceName,
    approvedPermissions: ["chat"],
    status: "approved",
    approvedAt: approved.awaitingPairClaims[0]!.approvedAt,
    expiresAt: approved.awaitingPairClaims[0]!.expiresAt,
  }]);
  assert.equal(approved.devices.length, 0);
  assert.doesNotMatch(approvedText, /tokenHash|requestSecretHash|requestSecret|codeHash/);

  const claimResponse = await fetch(`${base}/api/pair/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pairRequest),
  });
  assert.equal(claimResponse.status, 200);
  const claim = await claimResponse.json() as { token: string; device: { id: string } };

  const devicesResponse = await fetch(`${base}/admin/api/status`, { headers: adminHeaders });
  const devices = await devicesResponse.json() as {
    devices: Array<{ id: string }>;
    awaitingPairClaims: Array<{ id: string }>;
  };
  assert.deepEqual(devices.devices.map((device) => device.id), [claim.device.id]);
  assert.equal(devices.awaitingPairClaims.length, 0);

  const revokeResponse = await fetch(`${base}/admin/api/device/revoke`, {
    method: "POST", headers: adminJsonHeaders, body: JSON.stringify({ deviceId: claim.device.id }),
  });
  assert.equal(revokeResponse.status, 200);
  assert.equal((await fetch(`${base}/api/health`, {
    headers: { Authorization: `Bearer ${claim.token}` },
  })).status, 401);
});

test("실제 공식 Codex SDK로 thread 재개와 승인 파일 변경을 수행한다", {
  skip: process.env.LIFEHUB_REAL_CODEX_E2E !== "1",
  timeout: 300_000,
}, async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "lifehub-real-codex-"));
  const projectRoot = join(dataRoot, "project");
  await mkdir(projectRoot);
  await writeFile(join(projectRoot, "README.md"), "# LifeHub SDK E2E\n", "utf8");
  await execFileAsync("git", ["init", "--quiet"], { cwd: projectRoot });

  const config = loadConfig({
    ...process.env,
    LIFEHUB_BRIDGE_DATA_DIR: join(dataRoot, "bridge-data"),
  });
  const store = new JsonStore(config);
  const adapter = new OfficialCodexAdapter();
  const service = new BridgeService(config, store, adapter);
  await service.init();
  assert.equal((await adapter.loginStatus()).loggedIn, true, "codex login이 필요합니다.");

  const { code } = await service.createPairCode();
  const pairRequest = await service.requestPairing({
    code,
    deviceName: "real-sdk-test",
    requestedPermissions: ["chat", "project:read", "file:write"],
  });
  await service.approvePairingAsAdmin(pairRequest.requestId as string, ["chat", "project:read", "file:write"]);
  const claim = await service.claimPairing({ requestId: pairRequest.requestId, requestSecret: pairRequest.requestSecret });
  const device = await service.authenticate(claim.token as string);
  const project = await service.registerProject(projectRoot, "sdk-e2e");
  const thread = await service.createThread(device, { mode: "codex", projectId: project.id });

  await service.postMessage(device, thread.id, { content: "Reply exactly LIFEHUB_E2E_OK. Do not run commands or change files." });
  await waitFor(async () => (await service.getThread(device, thread.id)).status !== "running", 180_000);
  const firstTurn = await service.getThread(device, thread.id);
  assert.equal(firstTurn.status, "idle");
  assert.ok(firstTurn.sdkThreadId);

  const resumed = new BridgeService(config, new JsonStore(config), new OfficialCodexAdapter());
  await resumed.init();
  await resumed.postMessage(device, thread.id, { content: "Reply exactly LIFEHUB_E2E_RESUMED. Do not run commands or change files." });
  await waitFor(async () => (await resumed.getThread(device, thread.id)).status !== "running", 180_000);
  assert.equal((await resumed.getThread(device, thread.id)).sdkThreadId, firstTurn.sdkThreadId);

  const requested = await resumed.postMessage(device, thread.id, {
    content: "Create e2e-output.txt containing exactly LIFEHUB_E2E_OK followed by one newline. Change no other file and run no commands.",
    requestedPermissions: ["file:write"],
    approvalContext: { files: ["e2e-output.txt"], description: "Create the isolated E2E output file" },
  });
  await resumed.approve(device, thread.id, { approvalId: (requested.approval as { id: string }).id, scope: "once" });
  await waitFor(async () => (await resumed.getThread(device, thread.id)).status !== "running", 180_000);
  assert.equal((await resumed.getThread(device, thread.id)).status, "idle");
  assert.equal(await readFile(join(projectRoot, "e2e-output.txt"), "utf8"), "LIFEHUB_E2E_OK\n");
});
