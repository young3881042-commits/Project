import { mkdir } from "node:fs/promises";
import { basename, join, parse, resolve } from "node:path";
import { randomInt } from "node:crypto";
import type { ThreadEvent, ThreadItem } from "@openai/codex-sdk";
import type { BridgeConfig } from "./config.js";
import type { CodexAdapter } from "./codex-adapter.js";
import {
  decodeFoodImageDataUrl,
  FoodAnalysisError,
  validateFoodAnalysisResult,
  type FoodAnalysisResult,
  type FoodImageAnalyzer,
} from "./food-image-analyzer.js";
import { assertStableProjectRoot, getProjectChanges, resolveAllowedProjectPath, validateProjectRoot } from "./projects.js";
import {
  executeRemoteCommand,
  prepareRemoteCommand,
  RemoteCommandError,
  type RemoteCommandPlan,
} from "./remote-command.js";
import {
  containsPath,
  derivePairingDeviceToken,
  hashSecret,
  publicProjectPath,
  randomId,
  randomSecret,
  redactSensitiveText,
  safeSecretEqual,
} from "./security.js";
import { JsonStore } from "./store.js";
import type {
  ApprovalContext,
  ApprovalRecord,
  AuthenticatedDevice,
  BridgeEvent,
  BridgeState,
  DevicePermission,
  DeviceRecord,
  MessageRecord,
  ProjectRecord,
  TaskGrantRecord,
  ThreadMode,
  ThreadRecord,
} from "./types.js";
import { DEVICE_PERMISSIONS } from "./types.js";

export class BridgeError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

type EventListener = (event: BridgeEvent) => void;

const MUTATING_PERMISSIONS = new Set<DevicePermission>(["file:write", "command:execute", "build:execute", "git"]);
const CRITICAL_PATTERN = /(?:\b(?:rm|rmdir|unlink|shred|truncate)\b|\bfind\b[^\n]*(?:-delete|-exec\s+rm\b)|\bgit\s+(?:reset|clean|restore|checkout\s+--|push\b[^\n]*--force)\b|\b(?:sudo|doas|dd|mkfs|shutdown|reboot|chmod\s+-R|chown\s+-R|kill|pkill|killall)\b|\b(?:delete|remove|erase|format|remove-item)\b|삭제|초기화)/i;
const FILE_INTENT_PATTERN = /\b(?:edit|modify|change|fix|implement|create|add|write|delete|remove|rename|refactor|update)\b|수정|변경|구현|생성|추가|작성|삭제|제거|리팩터/i;
const BUILD_INTENT_PATTERN = /\b(?:build|test|lint|compile|gradle|mvn|maven|npm\s+(?:run|test)|pnpm|yarn)\b|빌드|테스트|린트|컴파일/i;
const GIT_INTENT_PATTERN = /\b(?:git|commit|checkout|rebase|merge|cherry-pick|push|pull)\b|깃|커밋/i;
const COMMAND_INTENT_PATTERN = /\b(?:run|execute|shell|command|script|start|serve)\b|실행|명령|스크립트/i;
const SAFE_READ_COMMANDS = new Set(["pwd", "ls", "cat", "head", "tail", "wc", "stat", "grep", "rg", "sed"]);
const SAFE_GIT_COMMANDS = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files"]);
const MAX_THREAD_MESSAGES = 500;
const MAX_LIST_THREADS = 200;
const PAIR_CLAIM_REPLAY_WINDOW_MS = 60_000;
const REMOTE_COMMAND_APPROVAL_TTL_MS = 2 * 60_000;
const MAX_REMOTE_COMMAND_APPROVALS = 200;
export const LOCAL_WEB_DEVICE_ID = "device_local_web";
const LOCAL_WEB_DEVICE_NAME = "Orbit 로컬 웹";

class PolicyViolationError extends Error {}

function classifyCodexFailure(error: unknown): { code: string; message: string } {
  const raw = error instanceof Error ? error.message : "";
  if (/(?:out of credits|usage\s*limit|UsageLimitExceeded|insufficient[_ -]?quota|credit balance)/i.test(raw)) {
    return { code: "CODEX_USAGE_LIMIT", message: "PC Codex 사용량 한도 또는 크레딧을 확인한 뒤 다시 시도하세요." };
  }
  if (/(?:not logged in|unauthorized|authentication failed|invalid credentials|\b401\b)/i.test(raw)) {
    return { code: "CODEX_LOGIN_REQUIRED", message: "PC에서 codex login을 실행한 뒤 다시 시도하세요." };
  }
  return { code: "CODEX_RUN_FAILED", message: "Codex 실행에 실패했습니다. PC의 Bridge 및 Codex 상태를 확인하세요." };
}

interface TurnExecutionPolicy {
  permissions: Set<DevicePermission>;
  approvedFiles: string[];
  approvedCommands: string[];
  criticalApproval: boolean;
  localWorkspaceAccess: boolean;
  projectRoot?: string;
}

interface TurnScope {
  permissions: DevicePermission[];
  files: string[];
  commands: string[];
  criticalApproval: boolean;
  localWorkspaceAccess: boolean;
}

interface RemoteCommandApprovalTicket {
  id: string;
  deviceId: string;
  projectId: string;
  plan: RemoteCommandPlan;
  createdAt: string;
  expiresAt: string;
}

function now(): string {
  return new Date().toISOString();
}

function slug(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{Letter}\p{Number}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "project";
}

function publicDevice(device: DeviceRecord): AuthenticatedDevice & { createdAt: string; lastSeenAt: string } {
  return { id: device.id, name: device.name, permissions: [...device.permissions], createdAt: device.createdAt, lastSeenAt: device.lastSeenAt };
}

function pairingClaimResponse(state: BridgeState, requestId: string, device: DeviceRecord, token: string): Record<string, unknown> {
  return {
    requestId,
    status: "approved",
    bridge: { id: state.bridgeId, name: state.bridgeName },
    device: publicDevice(device),
    token,
  };
}

function publicProject(project: ProjectRecord): { id: string; name: string } {
  return { id: project.id, name: project.name };
}

function redact(value: string): string {
  return redactSensitiveText(value);
}

function readPermissions(input: unknown, defaults: DevicePermission[] = ["chat"], forceChat = true): DevicePermission[] {
  if (input === undefined) return [...defaults];
  if (!Array.isArray(input)) throw new BridgeError(400, "INVALID_PERMISSIONS", "권한 목록 형식이 올바르지 않습니다.");
  const known = new Set<string>(DEVICE_PERMISSIONS);
  if (input.some((value) => typeof value !== "string" || !known.has(value))) {
    throw new BridgeError(400, "INVALID_PERMISSIONS", "알 수 없는 권한이 포함되어 있습니다.");
  }
  const values = input as DevicePermission[];
  return [...new Set<DevicePermission>(forceChat ? ["chat", ...values] : values)];
}

function compactTitle(content: string): string {
  return content.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 72) || "새 대화";
}

function contextStrings(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean).slice(0, maximum);
}

function minimumTurnPermissions(
  requested: DevicePermission[],
  content: string,
  context?: ApprovalContext,
): DevicePermission[] {
  const inferred = new Set<DevicePermission>();
  const files = contextStrings(context?.files, 100);
  const commands = contextStrings(context?.commands, 20);
  const combinedCommands = commands.join("\n");
  const buildIntent = BUILD_INTENT_PATTERN.test(content) || BUILD_INTENT_PATTERN.test(combinedCommands);
  const gitIntent = GIT_INTENT_PATTERN.test(content) || GIT_INTENT_PATTERN.test(combinedCommands);
  const commandIntent = COMMAND_INTENT_PATTERN.test(content) || commands.some((command) =>
    !BUILD_INTENT_PATTERN.test(command) && !GIT_INTENT_PATTERN.test(command));
  if (files.length || FILE_INTENT_PATTERN.test(content)) inferred.add("file:write");
  if (buildIntent) inferred.add("build:execute");
  if (gitIntent) inferred.add("git");
  if (commandIntent && !buildIntent && !gitIntent || commands.some((command) =>
    !BUILD_INTENT_PATTERN.test(command) && !GIT_INTENT_PATTERN.test(command))) inferred.add("command:execute");
  return requested.filter((permission) => MUTATING_PERMISSIONS.has(permission) && inferred.has(permission));
}

function scopeIsComplete(permissions: DevicePermission[], files: string[], commands: string[]): boolean {
  if (permissions.includes("file:write") && !files.length) return false;
  if (permissions.some((permission) => permission === "command:execute" || permission === "build:execute" || permission === "git") && !commands.length) return false;
  return true;
}

function pathWithinScope(candidate: string, allowed: string): boolean {
  const normalizedCandidate = candidate.replace(/\/$/, "");
  const normalizedAllowed = allowed.replace(/\/$/, "");
  if (normalizedAllowed === ".") return true;
  return normalizedCandidate === normalizedAllowed || normalizedCandidate.startsWith(`${normalizedAllowed}/`);
}

function taskGrantCovers(
  grant: TaskGrantRecord,
  permissions: DevicePermission[],
  files: string[],
  commands: string[],
): boolean {
  if (!permissions.every((permission) => grant.permissions.includes(permission))) return false;
  if (permissions.includes("file:write") && !files.every((file) => grant.files.some((allowed) => pathWithinScope(file, allowed)))) return false;
  if (permissions.some((permission) => permission === "command:execute" || permission === "build:execute" || permission === "git")) {
    const approvedCommands = new Set(grant.commands.map(comparableCommand));
    if (!commands.every((command) => approvedCommands.has(comparableCommand(command)))) return false;
  }
  return true;
}

function isTaskGrantRecord(value: unknown): value is TaskGrantRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Partial<TaskGrantRecord>;
  if (typeof grant.approvalId !== "string" || typeof grant.createdAt !== "string") return false;
  if (!Array.isArray(grant.permissions) || !grant.permissions.every((permission) => DEVICE_PERMISSIONS.includes(permission))) return false;
  if (!Array.isArray(grant.files) || !grant.files.every((file) => typeof file === "string")) return false;
  if (!Array.isArray(grant.commands) || !grant.commands.every((command) => typeof command === "string")) return false;
  return scopeIsComplete(grant.permissions, grant.files, grant.commands);
}

function unwrapShellCommand(value: string): string {
  const compact = value.trim().replace(/\s+/g, " ");
  const match = /^(?:\/[^\s]+\/)?(?:ba|z|)sh\s+-(?:l)?c\s+(?:"((?:\\.|[^"\\])*)"|'([^']*)')$/i.exec(compact);
  if (!match) return compact;
  const inner = match[1] ?? match[2] ?? "";
  return inner.replaceAll('\\"', '"').replaceAll("\\\\", "\\").trim().replace(/\s+/g, " ");
}

function commandName(value: string): string {
  return basename(value.trim().split(/\s+/, 1)[0] || "");
}

function isSafeReadCommand(raw: string): boolean {
  const command = unwrapShellCommand(raw);
  if (
    !command
    || /[\n\r;&|<>`$]/.test(command)
    || /(?:^|[\s'"=])~(?:\/|[\s'"]|$)/.test(command)
    || /(?:^|[\s'"/])\.\.(?:\/|[\s'"]|$)/.test(command)
  ) return false;
  const name = commandName(command);
  const rest = command.slice(command.search(/\s|$/)).trim();
  if (name === "git") {
    const subcommand = rest.split(/\s+/, 1)[0] || "";
    if (!SAFE_GIT_COMMANDS.has(subcommand)) return false;
    if (/(?:^|\s)(?:-C|-c|--git-dir|--work-tree)(?:\s|=)|(?:^|[\s'"=])\//.test(rest)) return false;
    return subcommand !== "diff" || /(?:^|\s)--no-ext-diff(?:\s|$)/.test(rest);
  }
  if (!SAFE_READ_COMMANDS.has(name)) return false;
  if (name === "sed" && !/^-(?:n|n\s+)\s*['"]?\d+(?:,\d+)?p['"]?\s+[^\s]+$/.test(rest)) return false;
  if ((name === "rg" || name === "grep") && /(?:--pre|--pre-glob|--hostname-bin)/.test(rest)) return false;
  const withoutExecutable = command.slice(command.search(/\s|$/));
  return !/(?:^|[\s'"=])\//.test(withoutExecutable);
}

function requiredCommandPermission(command: string): DevicePermission | undefined {
  if (isSafeReadCommand(command)) return undefined;
  if (BUILD_INTENT_PATTERN.test(command)) return "build:execute";
  if (GIT_INTENT_PATTERN.test(command)) return "git";
  return "command:execute";
}

function comparableCommand(command: string): string {
  return unwrapShellCommand(command).replace(/\s+/g, " ").trim();
}

export function canonicalCommandForApproval(command: string): string {
  return comparableCommand(command);
}

function hasOutsideProjectPathSyntax(raw: string): boolean {
  const command = unwrapShellCommand(raw);
  if (!command) return false;
  const firstWhitespace = command.search(/\s/);
  const executable = firstWhitespace < 0 ? command : command.slice(0, firstWhitespace);
  const argumentsText = firstWhitespace < 0 ? "" : command.slice(firstWhitespace);
  if (executable.startsWith("/") && !/^\/(?:usr\/local\/bin|usr\/bin|bin)\/[^/]+$/.test(executable)) return true;
  return /[\n\r`$]|(?:^|[\s'"=])~(?:\/|[\s'"]|$)|(?:^|[\s'"/])\.\.(?:[\\/]|[\s'"]|$)|(?:^|[\s'"=])\/(?!\/)|(?:^|[\s'"=])[A-Za-z]:[\\/]|%(?:USERPROFILE|HOMEPATH|APPDATA)%/i.test(argumentsText);
}

function simpleCommandTokens(raw: string): string[] | undefined {
  const command = unwrapShellCommand(raw);
  if (!command || /[\n\r;&|<>`$]/.test(command)) return undefined;
  const tokens: string[] = [];
  let token = "";
  let quote = "";
  let escaping = false;
  for (const character of command) {
    if (escaping) {
      token += character;
      escaping = false;
    } else if (character === "\\" && quote !== "'") {
      escaping = true;
    } else if (quote) {
      if (character === quote) quote = "";
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = "";
    } else {
      token += character;
    }
  }
  if (escaping || quote) return undefined;
  if (token) tokens.push(token);
  return tokens.length ? tokens : undefined;
}

function safeLocalCommandSequence(raw: string): string[] | undefined {
  const command = unwrapShellCommand(raw);
  if (!command) return undefined;
  const commands: string[] = [];
  let current = "";
  let quote = "";
  let escaping = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]!;
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      current += character;
      escaping = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === "&" && command[index + 1] === "&") {
      const segment = current.trim();
      if (!segment) return undefined;
      commands.push(segment);
      current = "";
      index += 1;
      continue;
    }
    if (/[;&|<>`$\n\r]/.test(character)) return undefined;
    current += character;
  }
  if (quote || escaping || !current.trim()) return undefined;
  commands.push(current.trim());
  return commands;
}

function commandPathCandidates(tokens: string[]): string[] | undefined {
  const executable = basename(tokens[0] || "").toLowerCase();
  if (["python", "python3", "node", "ruby", "perl", "php", "bash", "sh", "zsh", "pwsh", "powershell"].includes(executable)
    && tokens.some((token) => token === "-c" || token === "-e" || token === "--eval" || token === "-command")) return undefined;
  if (tokens.some((token) => token === "-exec" || token === "-execdir" || token === "-delete")) return undefined;
  const candidates: string[] = [];
  const executableToken = tokens[0]!;
  if ((executableToken.startsWith(".") || executableToken.includes("/")) && !/^\/(?:usr\/local\/bin|usr\/bin|bin)\/[^/]+$/.test(executableToken)) {
    candidates.push(executableToken);
  }
  for (const token of tokens.slice(1)) {
    if (!token || /^-\w*$/.test(token) || /^\d+$/.test(token)) continue;
    const candidate = token.startsWith("--") && token.includes("=") ? token.slice(token.indexOf("=") + 1) : token;
    if (!candidate || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(candidate)) continue;
    if (/[*?\[\]]/.test(candidate)) return undefined;
    candidates.push(candidate);
  }
  return candidates;
}

function boundedTail<T>(rows: T[], maximumRows: number, maximumBytes: number): { rows: T[]; truncated: boolean } {
  const selected: T[] = [];
  let size = 0;
  for (let index = rows.length - 1; index >= 0 && selected.length < maximumRows; index -= 1) {
    const row = rows[index]!;
    const rowSize = Buffer.byteLength(JSON.stringify(row));
    if (selected.length && size + rowSize > maximumBytes) break;
    selected.push(row);
    size += rowSize;
  }
  selected.reverse();
  return { rows: selected, truncated: selected.length < rows.length };
}

export class BridgeService {
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly running = new Map<string, AbortController>();
  private readonly foodAnalysisRunning = new Map<string, AbortController>();
  private readonly remoteCommandApprovals = new Map<string, RemoteCommandApprovalTicket>();
  private readonly remoteCommandsRunning = new Map<string, { deviceId: string; projectId: string; controller: AbortController }>();
  private readonly projectOperationsRunning = new Set<string>();
  private pairingTokenKey = "";

  constructor(
    readonly config: BridgeConfig,
    readonly store: JsonStore,
    readonly adapter: CodexAdapter,
    readonly foodAnalyzer?: FoodImageAnalyzer,
  ) {}

  async init(): Promise<void> {
    await this.store.init();
    this.pairingTokenKey = await this.store.readAdminToken();
    await mkdir(join(this.config.dataDir, "general-workspace"), { recursive: true, mode: 0o700 });
    await this.store.update((state) => {
      const interruptedAt = now();
      for (const thread of state.threads) {
        const storedGrants = Array.isArray(thread.taskGrants) ? thread.taskGrants as unknown[] : [];
        thread.taskGrants = storedGrants.filter(isTaskGrantRecord);
        if (thread.status !== "running") continue;
        thread.status = "failed";
        thread.updatedAt = interruptedAt;
        for (const message of thread.messages) {
          if (message.status === "streaming" || message.status === "pending") {
            message.status = "failed";
            message.error = "Bridge가 재시작되어 이전 응답이 중단되었습니다. 메시지를 다시 전송하세요.";
            message.updatedAt = interruptedAt;
          }
        }
      }
      for (const approval of state.approvals) {
        if (approval.status !== "pending" || scopeIsComplete(approval.permissions, approval.files, approval.commands)) continue;
        approval.status = "rejected";
        approval.decidedAt = interruptedAt;
        const thread = state.threads.find((entry) => entry.id === approval.threadId);
        const message = thread?.messages.find((entry) => entry.id === approval.messageId);
        if (message) {
          message.status = "failed";
          message.error = "승인할 파일 또는 명령 범위가 없어 안전하게 취소되었습니다.";
          message.updatedAt = interruptedAt;
        }
        if (thread?.status === "awaiting-approval") {
          thread.status = "idle";
          thread.updatedAt = interruptedAt;
        }
      }
    });
  }

  async connectLocalWebDevice(deviceNameInput?: unknown): Promise<Record<string, unknown>> {
    const requestedName = typeof deviceNameInput === "string" ? deviceNameInput.trim().slice(0, 80) : "";
    if (requestedName && /[\u0000-\u001f\u007f]/.test(requestedName)) {
      throw new BridgeError(400, "INVALID_DEVICE_NAME", "기기 이름이 올바르지 않습니다.");
    }
    const connectedAt = now();
    const token = `lhb_${LOCAL_WEB_DEVICE_ID}.${randomSecret(32)}`;
    return this.store.update((state) => {
      let device = state.devices.find((entry) => entry.id === LOCAL_WEB_DEVICE_ID);
      if (!device) {
        device = {
          id: LOCAL_WEB_DEVICE_ID,
          name: requestedName || LOCAL_WEB_DEVICE_NAME,
          tokenHash: hashSecret(token),
          permissions: [...DEVICE_PERMISSIONS],
          createdAt: connectedAt,
          lastSeenAt: connectedAt,
        };
        state.devices.push(device);
      } else {
        device.name = requestedName || LOCAL_WEB_DEVICE_NAME;
        device.tokenHash = hashSecret(token);
        device.permissions = [...DEVICE_PERMISSIONS];
        device.lastSeenAt = connectedAt;
        delete device.revokedAt;
      }
      return {
        status: "connected",
        bridge: { id: state.bridgeId, name: state.bridgeName },
        device: publicDevice(device),
        token,
        pairedAt: device.createdAt,
      };
    });
  }

  async createPairCode(): Promise<{ code: string; expiresAt: string }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = randomSecret(12);
    const createdAt = now();
    const expiresAt = new Date(Date.now() + this.config.pairCodeTtlMs).toISOString();
    await this.store.update((state) => {
      for (const entry of state.pairCodes) if (!entry.consumedAt) entry.consumedAt = createdAt;
      state.pairCodes = state.pairCodes.filter((entry) => Date.parse(entry.expiresAt) > Date.now() - 86_400_000).slice(-20);
      state.pairCodes.push({ id: randomId("code"), salt, codeHash: hashSecret(code, salt), createdAt, expiresAt });
    });
    return { code, expiresAt };
  }

  async requestPairing(input: { code?: unknown; deviceName?: unknown; requestedPermissions?: unknown }): Promise<Record<string, unknown>> {
    const code = typeof input.code === "string" ? input.code.trim() : "";
    const deviceName = typeof input.deviceName === "string" ? input.deviceName.trim().slice(0, 80) : "";
    if (!/^\d{6}$/.test(code)) throw new BridgeError(401, "INVALID_PAIR_CODE", "6자리 연결 코드가 올바르지 않습니다.");
    if (!deviceName || /[\u0000-\u001f\u007f]/.test(deviceName)) throw new BridgeError(400, "INVALID_DEVICE_NAME", "기기 이름이 올바르지 않습니다.");
    const requestSecret = randomSecret(32);
    const requestId = randomId("pair");
    const createdAt = now();
    const expiresAt = new Date(Date.now() + this.config.pairRequestTtlMs).toISOString();
    const requestedPermissions = readPermissions(input.requestedPermissions);

    await this.store.update((state) => {
      const match = state.pairCodes.find((entry) => safeSecretEqual(code, entry.codeHash, entry.salt));
      if (!match) throw new BridgeError(401, "INVALID_PAIR_CODE", "연결 코드가 올바르지 않습니다.");
      if (Date.parse(match.expiresAt) <= Date.now()) throw new BridgeError(410, "EXPIRED_PAIR_CODE", "연결 코드가 만료되었습니다.");
      if (match.consumedAt) throw new BridgeError(409, "USED_PAIR_CODE", "이미 사용된 연결 코드입니다.");
      match.consumedAt = createdAt;
      state.pairRequests.push({
        id: requestId,
        requestSecretHash: hashSecret(requestSecret),
        deviceName,
        requestedPermissions,
        status: "pending",
        createdAt,
        expiresAt,
      });
    });
    return { requestId, requestSecret, status: "pending", expiresAt };
  }

  async approvePairingAsAdmin(requestId: string, permissions?: unknown): Promise<Record<string, unknown>> {
    return this.store.update((state) => {
      const request = state.pairRequests.find((entry) => entry.id === requestId);
      if (!request) throw new BridgeError(404, "PAIR_REQUEST_NOT_FOUND", "페어링 요청을 찾을 수 없습니다.");
      if (Date.parse(request.expiresAt) <= Date.now()) throw new BridgeError(410, "EXPIRED_PAIR_REQUEST", "페어링 요청이 만료되었습니다.");
      if (request.status !== "pending") throw new BridgeError(409, "PAIR_REQUEST_DECIDED", "이미 처리된 페어링 요청입니다.");
      const approved = permissions === undefined
        ? request.requestedPermissions
        : readPermissions(permissions).filter((permission) => request.requestedPermissions.includes(permission));
      request.approvedPermissions = [...new Set<DevicePermission>(["chat", ...approved])];
      request.status = "approved";
      request.approvedAt = now();
      return { requestId, status: request.status, deviceName: request.deviceName, permissions: request.approvedPermissions };
    });
  }

  async rejectPairingAsAdmin(requestId: string): Promise<void> {
    await this.store.update((state) => {
      const request = state.pairRequests.find((entry) => entry.id === requestId);
      if (!request) throw new BridgeError(404, "PAIR_REQUEST_NOT_FOUND", "페어링 요청을 찾을 수 없습니다.");
      if (request.status !== "pending") throw new BridgeError(409, "PAIR_REQUEST_DECIDED", "이미 처리된 페어링 요청입니다.");
      request.status = "rejected";
    });
  }

  async claimPairing(input: { requestId?: unknown; requestSecret?: unknown }): Promise<Record<string, unknown>> {
    const requestId = typeof input.requestId === "string" ? input.requestId : "";
    const requestSecret = typeof input.requestSecret === "string" ? input.requestSecret : "";
    if (!requestId || !requestSecret) throw new BridgeError(400, "PAIR_CLAIM_REQUIRED", "페어링 요청 정보가 필요합니다.");
    if (!this.pairingTokenKey) throw new BridgeError(503, "BRIDGE_NOT_READY", "Bridge가 아직 준비되지 않았습니다.");
    return this.store.update((state) => {
      const request = state.pairRequests.find((entry) => entry.id === requestId);
      if (!request || !safeSecretEqual(requestSecret, request.requestSecretHash)) {
        throw new BridgeError(401, "INVALID_PAIR_CLAIM", "페어링 요청 확인에 실패했습니다.");
      }
      if (request.status === "claimed") {
        const claimedAt = Date.parse(request.claimedAt || "");
        if (!Number.isFinite(claimedAt) || Date.now() - claimedAt > PAIR_CLAIM_REPLAY_WINDOW_MS) {
          throw new BridgeError(409, "PAIR_ALREADY_CLAIMED", "이미 완료된 페어링 요청입니다.");
        }
        const device = request.claimedDeviceId
          ? state.devices.find((entry) => entry.id === request.claimedDeviceId)
          : undefined;
        if (!device) throw new BridgeError(409, "PAIR_ALREADY_CLAIMED", "이미 완료된 페어링 요청입니다.");
        if (device.revokedAt) throw new BridgeError(410, "PAIR_CLAIM_REVOKED", "폐기된 페어링 요청입니다.");
        const token = derivePairingDeviceToken(this.pairingTokenKey, requestSecret, requestId, device.id);
        if (!safeSecretEqual(token, device.tokenHash)) {
          throw new BridgeError(409, "PAIR_ALREADY_CLAIMED", "이미 완료된 페어링 요청입니다.");
        }
        return pairingClaimResponse(state, requestId, device, token);
      }
      if (Date.parse(request.expiresAt) <= Date.now()) throw new BridgeError(410, "EXPIRED_PAIR_REQUEST", "페어링 요청이 만료되었습니다.");
      if (request.status === "pending") return { requestId, status: "pending" };
      if (request.status === "rejected") throw new BridgeError(403, "PAIR_REJECTED", "PC에서 페어링 요청을 거부했습니다.");

      const createdAt = now();
      const id = randomId("device");
      const token = derivePairingDeviceToken(this.pairingTokenKey, requestSecret, requestId, id);
      const device: DeviceRecord = {
        id,
        name: request.deviceName,
        tokenHash: hashSecret(token),
        permissions: request.approvedPermissions || ["chat"],
        createdAt,
        lastSeenAt: createdAt,
      };
      state.devices.push(device);
      request.status = "claimed";
      request.claimedAt = createdAt;
      request.claimedDeviceId = id;
      return pairingClaimResponse(state, requestId, device, token);
    });
  }

  async authenticate(token: string | undefined): Promise<AuthenticatedDevice> {
    if (!token) throw new BridgeError(401, "AUTH_REQUIRED", "기기 인증이 필요합니다.");
    return this.store.update((state) => {
      const device = state.devices.find((entry) => !entry.revokedAt && safeSecretEqual(token, entry.tokenHash));
      if (!device) throw new BridgeError(401, "INVALID_DEVICE_TOKEN", "기기 토큰이 올바르지 않거나 폐기되었습니다.");
      device.lastSeenAt = now();
      return publicDevice(device);
    });
  }

  requirePermission(device: AuthenticatedDevice, permission: DevicePermission): void {
    if (!device.permissions.includes(permission)) throw new BridgeError(403, "PERMISSION_DENIED", `${permission} 권한이 필요합니다.`);
  }

  async revokeDevice(actor: AuthenticatedDevice | undefined, targetDeviceId?: string): Promise<void> {
    const revoked = await this.store.update((state) => {
      const id = targetDeviceId || actor?.id;
      const device = state.devices.find((entry) => entry.id === id && !entry.revokedAt);
      if (!device) throw new BridgeError(404, "DEVICE_NOT_FOUND", "연결된 기기를 찾을 수 없습니다.");
      if (actor && actor.id !== device.id) throw new BridgeError(403, "PERMISSION_DENIED", "다른 기기의 연결을 해제할 수 없습니다.");
      device.revokedAt = now();
      device.tokenHash = hashSecret(randomSecret(32));
      const ownedThreads = state.threads.filter((thread) => thread.ownerDeviceId === device.id);
      for (const approval of state.approvals) {
        if (approval.deviceId !== device.id || approval.status !== "pending") continue;
        approval.status = "rejected";
        approval.decidedAt = now();
      }
      for (const thread of ownedThreads) {
        if (thread.status !== "awaiting-approval") continue;
        thread.status = "idle";
        thread.updatedAt = now();
        for (const message of thread.messages) {
          if (message.status !== "awaiting-approval") continue;
          message.status = "failed";
          message.error = "기기 연결이 폐기되어 승인 대기 작업이 취소되었습니다.";
          message.updatedAt = now();
        }
      }
      return { deviceId: device.id, threadIds: ownedThreads.map((thread) => thread.id) };
    });
    this.foodAnalysisRunning.get(revoked.deviceId)?.abort();
    for (const [approvalId, approval] of this.remoteCommandApprovals) {
      if (approval.deviceId === revoked.deviceId) this.remoteCommandApprovals.delete(approvalId);
    }
    for (const running of this.remoteCommandsRunning.values()) {
      if (running.deviceId === revoked.deviceId) running.controller.abort();
    }
    for (const threadId of revoked.threadIds) {
      this.running.get(threadId)?.abort();
      await this.publish(threadId, "device.revoked", { message: "기기 연결이 폐기되었습니다." }).catch(() => undefined);
    }
  }

  async deviceStatus(device: AuthenticatedDevice): Promise<Record<string, unknown>> {
    const [state, codex] = await Promise.all([this.store.read(), this.adapter.loginStatus()]);
    return {
      connected: true,
      bridge: {
        id: state.bridgeId,
        name: state.bridgeName,
        host: this.config.host,
        port: this.config.port,
        lanEnabled: this.config.lanEnabled,
      },
      device,
      codex,
      capabilities: { remoteCommands: this.config.remoteCommandsEnabled },
    };
  }

  async prepareRemoteCommand(
    device: AuthenticatedDevice,
    projectId: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.requireRemoteCommandsEnabled();
    this.requirePermission(device, "project:read");
    const project = await this.findRegisteredProject(projectId);
    let plan: RemoteCommandPlan;
    try {
      plan = await prepareRemoteCommand(project.realPath, input.command, this.config.gitPushHosts);
    } catch (error) {
      if (error instanceof RemoteCommandError) throw new BridgeError(error.status, error.code, error.message);
      throw error;
    }
    for (const permission of plan.requiredPermissions) this.requirePermission(device, permission);
    this.pruneRemoteCommandApprovals();
    const createdAt = now();
    const ticket: RemoteCommandApprovalTicket = {
      id: randomId("command_approval"),
      deviceId: device.id,
      projectId: project.id,
      plan,
      createdAt,
      expiresAt: new Date(Date.now() + REMOTE_COMMAND_APPROVAL_TTL_MS).toISOString(),
    };
    this.remoteCommandApprovals.set(ticket.id, ticket);
    while (this.remoteCommandApprovals.size > MAX_REMOTE_COMMAND_APPROVALS) {
      const oldest = this.remoteCommandApprovals.keys().next().value as string | undefined;
      if (!oldest) break;
      this.remoteCommandApprovals.delete(oldest);
    }
    return {
      approval: {
        id: ticket.id,
        command: plan.command,
        permission: plan.permission,
        permissions: plan.requiredPermissions,
        risk: plan.risk,
        project: publicProject(project),
        gitPush: plan.gitPush ? {
          remote: plan.gitPush.remote,
          branch: plan.gitPush.branch,
          head: plan.gitPush.head,
          host: plan.gitPush.host,
        } : undefined,
        createdAt: ticket.createdAt,
        expiresAt: ticket.expiresAt,
      },
    };
  }

  async executePreparedRemoteCommand(
    device: AuthenticatedDevice,
    projectId: string,
    input: Record<string, unknown>,
    requestSignal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    this.requireRemoteCommandsEnabled();
    this.requirePermission(device, "project:read");
    const approvalId = typeof input.approvalId === "string" ? input.approvalId : "";
    const approval = this.remoteCommandApprovals.get(approvalId);
    if (!approval || approval.deviceId !== device.id || approval.projectId !== projectId) {
      throw new BridgeError(404, "REMOTE_COMMAND_APPROVAL_NOT_FOUND", "원격 명령 승인 요청을 찾을 수 없습니다. 명령을 다시 확인하세요.");
    }
    if (Date.parse(approval.expiresAt) <= Date.now()) {
      this.remoteCommandApprovals.delete(approvalId);
      throw new BridgeError(410, "REMOTE_COMMAND_APPROVAL_EXPIRED", "원격 명령 확인 시간이 만료되었습니다. 명령을 다시 확인하세요.");
    }
    for (const permission of approval.plan.requiredPermissions) this.requirePermission(device, permission);
    // Consume before the first await so parallel replays cannot retain the same ticket.
    this.remoteCommandApprovals.delete(approvalId);
    if (this.projectOperationsRunning.has(projectId)) {
      throw new BridgeError(409, "REMOTE_COMMAND_IN_PROGRESS", "이 프로젝트에서 다른 Codex 작업 또는 원격 명령을 실행 중입니다.");
    }
    if ([...this.remoteCommandsRunning.values()].some((running) => running.deviceId === device.id)) {
      throw new BridgeError(409, "REMOTE_COMMAND_IN_PROGRESS", "이 기기에서 다른 원격 명령을 실행 중입니다.");
    }
    const controller = new AbortController();
    const cancelFromRequest = () => controller.abort();
    if (requestSignal?.aborted) controller.abort();
    else requestSignal?.addEventListener("abort", cancelFromRequest, { once: true });
    this.remoteCommandsRunning.set(approvalId, { deviceId: device.id, projectId, controller });
    this.projectOperationsRunning.add(projectId);
    try {
      const project = await this.findRegisteredProject(projectId);
      if (controller.signal.aborted) {
        throw new BridgeError(499, "REMOTE_COMMAND_CANCELLED", "원격 명령 요청이 취소되었습니다.");
      }
      const result = await executeRemoteCommand(project.realPath, approval.plan, controller.signal);
      const stdout = this.sanitizeProjectCommandText(project, result.stdout, approval.plan);
      const stderr = this.sanitizeProjectCommandText(project, result.stderr, approval.plan);
      return {
        result: {
          command: approval.plan.command,
          stdout,
          stderr,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          durationMs: result.durationMs,
          project: publicProject(project),
          gitPush: approval.plan.gitPush ? {
            remote: approval.plan.gitPush.remote,
            branch: approval.plan.gitPush.branch,
            head: approval.plan.gitPush.head,
            host: approval.plan.gitPush.host,
          } : undefined,
        },
      };
    } catch (error) {
      if (error instanceof RemoteCommandError) throw new BridgeError(error.status, error.code, error.message);
      throw error;
    } finally {
      requestSignal?.removeEventListener("abort", cancelFromRequest);
      this.remoteCommandsRunning.delete(approvalId);
      this.projectOperationsRunning.delete(projectId);
    }
  }

  async analyzeFood(device: AuthenticatedDevice, input: Record<string, unknown>, signal?: AbortSignal): Promise<FoodAnalysisResult> {
    this.requirePermission(device, "chat");
    if (!this.foodAnalyzer) {
      throw new BridgeError(503, "FOOD_ANALYZER_UNAVAILABLE", "음식 사진 분석기를 사용할 수 없습니다. Bridge를 다시 시작하세요.");
    }
    if (this.foodAnalysisRunning.has(device.id)) {
      throw new BridgeError(409, "FOOD_ANALYSIS_IN_PROGRESS", "이 기기에서 음식 사진을 이미 분석하고 있습니다.");
    }
    const controller = new AbortController();
    const cancelFromRequest = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", cancelFromRequest, { once: true });
    this.foodAnalysisRunning.set(device.id, controller);
    try {
      if (controller.signal.aborted) {
        throw new BridgeError(499, "FOOD_ANALYSIS_CANCELLED", "음식 사진 분석 요청이 취소되었습니다.");
      }
      const keys = Object.keys(input);
      if (keys.length !== 1 || keys[0] !== "imageDataUrl") {
        throw new BridgeError(400, "INVALID_FOOD_ANALYSIS_REQUEST", "imageDataUrl 하나만 포함한 JSON 요청이 필요합니다.");
      }
      const image = decodeFoodImageDataUrl(input.imageDataUrl);
      const login = await this.adapter.loginStatus();
      if (!login.loggedIn) {
        if (login.status === "not-logged-in") {
          throw new BridgeError(503, "CODEX_LOGIN_REQUIRED", "PC에서 codex login을 실행한 뒤 다시 시도하세요.");
        }
        throw new BridgeError(503, "CODEX_UNAVAILABLE", "로컬 Codex 상태를 확인할 수 없습니다. Codex 설치와 Bridge 상태를 확인하세요.");
      }
      const result = await this.foodAnalyzer.analyze(image, controller.signal);
      if (controller.signal.aborted) {
        throw new BridgeError(499, "FOOD_ANALYSIS_CANCELLED", "음식 사진 분석 요청이 취소되었습니다.");
      }
      return validateFoodAnalysisResult(result);
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      if (error instanceof FoodAnalysisError) {
        throw new BridgeError(error.status, error.code, error.message);
      }
      throw new BridgeError(502, "FOOD_ANALYSIS_FAILED", "음식 사진 분석에 실패했습니다. 다른 사진으로 다시 시도하세요.");
    } finally {
      signal?.removeEventListener("abort", cancelFromRequest);
      if (this.foodAnalysisRunning.get(device.id) === controller) this.foodAnalysisRunning.delete(device.id);
    }
  }

  async listProjects(device: AuthenticatedDevice): Promise<{ projects: Array<{ id: string; name: string }> }> {
    this.requirePermission(device, "project:read");
    const state = await this.store.read();
    return { projects: state.projects.map(publicProject) };
  }

  async registerProject(inputPath: string, inputName?: string): Promise<{ id: string; name: string }> {
    if (!inputPath) throw new BridgeError(400, "PROJECT_PATH_REQUIRED", "프로젝트 경로가 필요합니다.");
    const realPath = await validateProjectRoot(inputPath);
    const filesystemRoot = parse(realPath).root;
    const protectedPaths = [resolve(this.config.codexHome), resolve(this.config.dataDir)];
    if (realPath === filesystemRoot || protectedPaths.some((protectedPath) =>
      containsPath(realPath, protectedPath) || containsPath(protectedPath, realPath))) {
      throw new BridgeError(403, "PROTECTED_PROJECT_PATH", "Codex 인증/Bridge 데이터 경로 또는 이를 포함하는 상위 경로는 프로젝트로 등록할 수 없습니다.");
    }
    const rawName = inputName?.trim() || basename(realPath);
    if (!rawName || /[\u0000-\u001f\u007f]/.test(rawName)) throw new BridgeError(400, "INVALID_PROJECT_NAME", "프로젝트 이름이 올바르지 않습니다.");
    const name = rawName.slice(0, 80);
    return this.store.update((state) => {
      const existing = state.projects.find((project) => project.realPath === realPath);
      if (existing) return publicProject(existing);
      const baseId = slug(name);
      let id = baseId;
      let suffix = 2;
      while (state.projects.some((project) => project.id === id)) id = `${baseId}-${suffix++}`;
      const project = { id, name, rootPath: realPath, realPath, createdAt: now() };
      state.projects.push(project);
      return publicProject(project);
    });
  }

  async removeProject(idOrName: string): Promise<void> {
    await this.store.update((state) => {
      const index = state.projects.findIndex((project) => project.id === idOrName || project.name === idOrName);
      if (index < 0) throw new BridgeError(404, "PROJECT_NOT_FOUND", "등록된 프로젝트를 찾을 수 없습니다.");
      const project = state.projects[index]!;
      if (state.threads.some((thread) => thread.projectId === project.id && thread.status === "running")) {
        throw new BridgeError(409, "PROJECT_IN_USE", "실행 중인 작업의 프로젝트는 제거할 수 없습니다.");
      }
      state.projects.splice(index, 1);
    });
  }

  async createThread(device: AuthenticatedDevice, input: { mode?: unknown; projectId?: unknown; title?: unknown }): Promise<ThreadRecord> {
    this.requirePermission(device, "chat");
    const mode: ThreadMode = input.mode === "codex" ? "codex" : input.mode === "general" || input.mode === undefined ? "general" : (() => { throw new BridgeError(400, "INVALID_MODE", "대화 모드가 올바르지 않습니다."); })();
    const projectId = typeof input.projectId === "string" ? input.projectId : undefined;
    if (mode === "codex") {
      this.requirePermission(device, "project:read");
      if (!projectId) throw new BridgeError(400, "PROJECT_REQUIRED", "Codex 모드는 등록된 프로젝트가 필요합니다.");
    } else if (projectId) {
      throw new BridgeError(400, "GENERAL_PROJECT_FORBIDDEN", "일반 AI 모드는 로컬 프로젝트에 연결할 수 없습니다.");
    }
    const requestedTitle = typeof input.title === "string" ? input.title.trim() : "";
    if (requestedTitle && /[\u0000-\u001f\u007f]/.test(requestedTitle)) throw new BridgeError(400, "INVALID_THREAD_TITLE", "대화 제목이 올바르지 않습니다.");
    const createdAt = now();
    return this.store.update((state) => {
      if (projectId && !state.projects.some((project) => project.id === projectId)) throw new BridgeError(404, "PROJECT_NOT_FOUND", "등록된 프로젝트를 찾을 수 없습니다.");
      const thread: ThreadRecord = {
        id: randomId("thread"), ownerDeviceId: device.id, mode, projectId,
        title: requestedTitle ? requestedTitle.slice(0, 120) : mode === "general" ? "새 대화" : "새 Codex 작업",
        status: "idle", messages: [], events: [], nextEventId: 1, taskGrants: [], createdAt, updatedAt: createdAt,
      };
      state.threads.push(thread);
      return structuredClone(thread);
    });
  }

  async listThreads(device: AuthenticatedDevice, mode?: string): Promise<{ threads: Array<Record<string, unknown>> }> {
    this.requirePermission(device, "chat");
    if (mode && mode !== "general" && mode !== "codex") throw new BridgeError(400, "INVALID_MODE", "대화 모드가 올바르지 않습니다.");
    const state = await this.store.read();
    const threads = state.threads
      .filter((thread) => thread.ownerDeviceId === device.id && (!mode || thread.mode === mode))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_LIST_THREADS)
      .map((thread) => {
        const lastMessage = thread.messages.at(-1);
        return {
          id: thread.id,
          mode: thread.mode,
          projectId: thread.projectId,
          title: thread.title,
          status: thread.status,
          messageCount: thread.messages.length,
          lastMessage: lastMessage ? {
            role: lastMessage.role,
            status: lastMessage.status,
            preview: redact(lastMessage.content).replace(/\s+/g, " ").slice(0, 160),
            createdAt: lastMessage.createdAt,
          } : undefined,
          eventCursor: thread.nextEventId - 1,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        };
      });
    return { threads };
  }

  async getThread(device: AuthenticatedDevice, threadId: string): Promise<ThreadRecord> {
    const state = await this.store.read();
    const thread = state.threads.find((entry) => entry.id === threadId && entry.ownerDeviceId === device.id);
    if (!thread) throw new BridgeError(404, "THREAD_NOT_FOUND", "대화를 찾을 수 없습니다.");
    return thread;
  }

  async getThreadDetail(device: AuthenticatedDevice, threadId: string): Promise<Record<string, unknown>> {
    const thread = await this.getThread(device, threadId);
    const messages = boundedTail(thread.messages, 200, 768 * 1024);
    const events = boundedTail(thread.events, 200, 768 * 1024);
    return {
      id: thread.id,
      mode: thread.mode,
      projectId: thread.projectId,
      sdkThreadId: thread.sdkThreadId,
      title: thread.title,
      status: thread.status,
      messages: messages.rows,
      events: events.rows,
      messageCount: thread.messages.length,
      eventCursor: thread.nextEventId - 1,
      truncated: { messages: messages.truncated, events: events.truncated },
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async postMessage(device: AuthenticatedDevice, threadId: string, input: {
    content?: unknown;
    requestedPermissions?: unknown;
    approvalContext?: unknown;
    localWorkspaceAccess?: unknown;
  }): Promise<Record<string, unknown>> {
    const content = typeof input.content === "string" ? input.content.trim() : "";
    if (!content || content.length > 100_000) throw new BridgeError(400, "INVALID_MESSAGE", "메시지는 1~100000자여야 합니다.");
    if (input.localWorkspaceAccess !== undefined && typeof input.localWorkspaceAccess !== "boolean") {
      throw new BridgeError(400, "INVALID_LOCAL_WORKSPACE_ACCESS", "로컬 작업공간 접근 설정이 올바르지 않습니다.");
    }
    const thread = await this.getThread(device, threadId);
    this.requireThreadAvailable(thread);
    const localWorkspaceAccess = input.localWorkspaceAccess === true;
    if (localWorkspaceAccess && (device.id !== LOCAL_WEB_DEVICE_ID || thread.mode !== "codex")) {
      throw new BridgeError(403, "LOCAL_WORKSPACE_ACCESS_FORBIDDEN", "로컬 작업공간 전체 접근은 이 PC의 로컬 웹 Codex 작업에서만 사용할 수 있습니다.");
    }
    const requestedByClient = readPermissions(input.requestedPermissions, [], false).filter((permission) => permission !== "chat" && permission !== "project:read");
    if (thread.mode === "general" && requestedByClient.length) throw new BridgeError(403, "GENERAL_MODE_READ_ONLY", "일반 AI 모드는 파일 및 명령 권한을 사용할 수 없습니다.");
    const context = await this.validateApprovalContext(thread, input.approvalContext);
    const requested = thread.mode === "codex"
      ? localWorkspaceAccess
        ? requestedByClient.filter((permission) => MUTATING_PERMISSIONS.has(permission))
        : minimumTurnPermissions(requestedByClient, content, context)
      : [];
    for (const permission of requested) this.requirePermission(device, permission);
    const login = await this.adapter.loginStatus();
    if (!login.loggedIn) {
      if (login.status === "not-logged-in") throw new BridgeError(503, "CODEX_LOGIN_REQUIRED", "PC에서 codex login을 실행한 뒤 다시 시도하세요.");
      throw new BridgeError(503, "CODEX_UNAVAILABLE", "로컬 Codex 상태를 확인할 수 없습니다. Codex 설치와 Bridge 로그를 확인하세요.");
    }

    const createdAt = now();
    const message: MessageRecord = {
      id: randomId("message"), role: "user", content,
      status: "pending", requestedPermissions: requested, createdAt, updatedAt: createdAt,
    };
    const mutating = requested.filter((permission) => MUTATING_PERMISSIONS.has(permission));
    const missingFileScope = mutating.includes("file:write") && !context.files.length;
    const missingExactScope = !localWorkspaceAccess && !scopeIsComplete(mutating, context.files, context.commands);
    const localWriteCapability = localWorkspaceAccess && mutating.some((permission) =>
      permission === "file:write" || permission === "build:execute" || permission === "git");
    const missingLocalRootScope = localWriteCapability && !context.files.includes(".");
    if (mutating.length && (missingFileScope || missingExactScope || missingLocalRootScope)) {
      throw new BridgeError(
        400,
        "APPROVAL_SCOPE_REQUIRED",
        missingLocalRootScope
          ? "로컬 전체 권한 작업에는 선택 프로젝트 전체를 뜻하는 파일 범위 '.'이 필요합니다."
          : missingFileScope
          ? "파일 수정 권한에는 비어 있지 않은 변경 예정 파일 목록이 필요합니다."
          : "명령/빌드/Git 권한에는 비어 있지 않은 실행 예정 명령 목록이 필요합니다.",
      );
    }
    const critical = CRITICAL_PATTERN.test(`${content}\n${context.commands.join("\n")}`);
    const taskGrant = !localWorkspaceAccess && !critical
      ? thread.taskGrants.find((grant) => taskGrantCovers(grant, mutating, context.files, context.commands))
      : undefined;

    if (mutating.length && !taskGrant && (!localWorkspaceAccess || critical)) {
      const approval: ApprovalRecord = {
        id: randomId("approval"), threadId, deviceId: device.id, messageId: message.id,
        description: context.description || content.slice(0, 240), projectId: thread.projectId,
        files: context.files, commands: context.commands, permissions: mutating,
        localWorkspaceAccess,
        risk: critical ? "critical" : mutating.includes("command:execute") || mutating.includes("git") ? "high" : mutating.includes("build:execute") ? "medium" : "low",
        status: "pending", createdAt,
      };
      message.status = "awaiting-approval";
      await this.store.update((state) => {
        const target = this.findOwnedThread(state.threads, threadId, device.id);
        this.requireThreadAvailable(target);
        if (!target.messages.length && (target.title === "새 대화" || target.title === "새 Codex 작업")) target.title = compactTitle(content);
        target.messages.push(message);
        if (target.messages.length > MAX_THREAD_MESSAGES) target.messages.splice(0, target.messages.length - MAX_THREAD_MESSAGES);
        target.status = "awaiting-approval";
        target.updatedAt = createdAt;
        state.approvals.push(approval);
      });
      await this.publish(threadId, "approval.required", { approval });
      return { accepted: false, pendingApproval: true, messageId: message.id, approval, turnPermissions: requested };
    }

    await this.store.update((state) => {
      const target = this.findOwnedThread(state.threads, threadId, device.id);
      this.requireThreadAvailable(target);
      if (!target.messages.length && (target.title === "새 대화" || target.title === "새 Codex 작업")) target.title = compactTitle(content);
      target.messages.push(message);
      if (target.messages.length > MAX_THREAD_MESSAGES) target.messages.splice(0, target.messages.length - MAX_THREAD_MESSAGES);
      target.status = "running";
      target.updatedAt = createdAt;
    });
    void this.runTurn(device, threadId, message.id, {
      permissions: requested,
      files: localWorkspaceAccess || taskGrant ? context.files : [],
      commands: localWorkspaceAccess || taskGrant ? context.commands : [],
      criticalApproval: false,
      localWorkspaceAccess,
    });
    return { accepted: true, pendingApproval: false, messageId: message.id, turnPermissions: requested, localWorkspaceAccess };
  }

  async approve(device: AuthenticatedDevice, threadId: string, input: { approvalId?: unknown; scope?: unknown }): Promise<Record<string, unknown>> {
    const approvalId = typeof input.approvalId === "string" ? input.approvalId : "";
    const requestedScope = input.scope === "task" ? "task" : "once";
    let turnScope: TurnScope = { permissions: [], files: [], commands: [], criticalApproval: false, localWorkspaceAccess: false };
    let messageId = "";
    const result = await this.store.update((state) => {
      const thread = this.findOwnedThread(state.threads, threadId, device.id);
      const approval = state.approvals.find((entry) => entry.id === approvalId && entry.threadId === threadId && entry.deviceId === device.id);
      if (!approval) throw new BridgeError(404, "APPROVAL_NOT_FOUND", "승인 요청을 찾을 수 없습니다.");
      if (approval.status !== "pending") throw new BridgeError(409, "APPROVAL_DECIDED", "이미 처리된 승인 요청입니다.");
      const approvalScopeComplete = approval.localWorkspaceAccess
        ? (!approval.permissions.some((permission) => permission === "file:write" || permission === "build:execute" || permission === "git")
          || approval.files.includes("."))
        : scopeIsComplete(approval.permissions, approval.files, approval.commands);
      if (!approvalScopeComplete) {
        throw new BridgeError(409, "APPROVAL_SCOPE_REQUIRED", "승인할 파일 또는 명령 범위가 없어 실행할 수 없습니다.");
      }
      const message = this.requireActiveApproval(state, thread, approval);
      for (const permission of approval.permissions) this.requirePermission(device, permission);
      approval.status = "approved";
      approval.scope = approval.risk === "critical" ? "once" : requestedScope;
      approval.decidedAt = now();
      if (approval.scope === "task") {
        thread.taskGrants.push({
          approvalId: approval.id,
          permissions: [...approval.permissions],
          files: [...approval.files],
          commands: [...approval.commands],
          createdAt: now(),
        });
        if (thread.taskGrants.length > 50) thread.taskGrants.splice(0, thread.taskGrants.length - 50);
      }
      message.status = "pending";
      message.updatedAt = now();
      thread.status = "running";
      thread.updatedAt = now();
      turnScope = {
        permissions: [...approval.permissions],
        files: [...approval.files],
        commands: [...approval.commands],
        criticalApproval: approval.risk === "critical",
        localWorkspaceAccess: approval.localWorkspaceAccess === true,
      };
      messageId = approval.messageId;
      return { approvalId, status: approval.status, scope: approval.scope };
    });
    await this.publish(threadId, "approval.approved", result);
    void this.runTurn(device, threadId, messageId, turnScope);
    return result;
  }

  async reject(device: AuthenticatedDevice, threadId: string, input: { approvalId?: unknown; reason?: unknown }): Promise<Record<string, unknown>> {
    const approvalId = typeof input.approvalId === "string" ? input.approvalId : "";
    const reason = typeof input.reason === "string" ? input.reason.slice(0, 500) : "사용자가 작업을 거부했습니다.";
    const result = await this.store.update((state) => {
      const thread = this.findOwnedThread(state.threads, threadId, device.id);
      const approval = state.approvals.find((entry) => entry.id === approvalId && entry.threadId === threadId && entry.deviceId === device.id);
      if (!approval) throw new BridgeError(404, "APPROVAL_NOT_FOUND", "승인 요청을 찾을 수 없습니다.");
      if (approval.status !== "pending") throw new BridgeError(409, "APPROVAL_DECIDED", "이미 처리된 승인 요청입니다.");
      const message = this.requireActiveApproval(state, thread, approval);
      approval.status = "rejected";
      approval.decidedAt = now();
      message.status = "failed";
      message.error = reason;
      message.updatedAt = now();
      thread.status = "idle";
      thread.updatedAt = now();
      return { approvalId, status: approval.status, reason };
    });
    await this.publish(threadId, "approval.rejected", result);
    return result;
  }

  async cancel(device: AuthenticatedDevice, threadId: string): Promise<{ cancelled: boolean }> {
    await this.getThread(device, threadId);
    const controller = this.running.get(threadId);
    if (!controller) return { cancelled: false };
    controller.abort();
    return { cancelled: true };
  }

  async changes(device: AuthenticatedDevice, threadId: string): Promise<Record<string, unknown>> {
    this.requirePermission(device, "project:read");
    const thread = await this.getThread(device, threadId);
    if (!thread.projectId) return { files: [], diff: "", workingDirectory: undefined };
    const state = await this.store.read();
    const project = state.projects.find((entry) => entry.id === thread.projectId);
    if (!project) throw new BridgeError(404, "PROJECT_NOT_FOUND", "등록된 프로젝트를 찾을 수 없습니다.");
    try {
      await assertStableProjectRoot(project.realPath);
    } catch {
      throw new BridgeError(409, "PROJECT_ROOT_CHANGED", "등록된 프로젝트 루트가 변경되어 접근을 차단했습니다.");
    }
    const result = await getProjectChanges(project.realPath).catch(() => ({ files: [], diff: "" }));
    const diff = await this.sanitizeRuntimeText(threadId, result.diff, 512 * 1024);
    return {
      files: result.files.map((file) => redact(file).slice(0, 1_024)),
      diff,
      workingDirectory: project.name,
      project: publicProject(project),
    };
  }

  async events(device: AuthenticatedDevice, threadId: string, after = 0): Promise<BridgeEvent[]> {
    const thread = await this.getThread(device, threadId);
    return thread.events.filter((event) => event.id > after);
  }

  subscribe(threadId: string, listener: EventListener): () => void {
    const set = this.listeners.get(threadId) || new Set<EventListener>();
    set.add(listener);
    this.listeners.set(threadId, set);
    return () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(threadId);
    };
  }

  async adminStatus(): Promise<Record<string, unknown>> {
    const [state, codex] = await Promise.all([this.store.read(), this.adapter.loginStatus()]);
    return {
      bridge: {
        id: state.bridgeId,
        name: state.bridgeName,
        address: `${this.config.host}:${this.config.port}`,
        lanEnabled: this.config.lanEnabled,
        remoteCommandsEnabled: this.config.remoteCommandsEnabled,
      },
      codex,
      projects: state.projects.map(publicProject),
      devices: state.devices.filter((device) => !device.revokedAt).map(publicDevice),
      pendingPairRequests: state.pairRequests.filter((request) => request.status === "pending" && Date.parse(request.expiresAt) > Date.now()).map((request) => ({
        id: request.id, deviceName: request.deviceName, requestedPermissions: request.requestedPermissions, status: request.status, expiresAt: request.expiresAt,
      })),
      awaitingPairClaims: state.pairRequests.filter((request) => request.status === "approved" && Date.parse(request.expiresAt) > Date.now()).map((request) => ({
        id: request.id,
        deviceName: request.deviceName,
        approvedPermissions: request.approvedPermissions || request.requestedPermissions,
        status: request.status,
        approvedAt: request.approvedAt,
        expiresAt: request.expiresAt,
      })),
    };
  }

  private requireRemoteCommandsEnabled(): void {
    if (!this.config.remoteCommandsEnabled) {
      throw new BridgeError(
        403,
        "REMOTE_COMMANDS_DISABLED",
        "원격 명령 기능이 비활성화되어 있습니다. 서버 관리자가 LIFEHUB_BRIDGE_REMOTE_COMMANDS=1을 명시해야 합니다.",
      );
    }
  }

  private async findRegisteredProject(projectId: string): Promise<ProjectRecord> {
    if (!projectId) throw new BridgeError(400, "PROJECT_REQUIRED", "원격 명령에는 등록된 프로젝트가 필요합니다.");
    const state = await this.store.read();
    const project = state.projects.find((entry) => entry.id === projectId);
    if (!project) throw new BridgeError(404, "PROJECT_NOT_FOUND", "등록된 프로젝트를 찾을 수 없습니다.");
    try {
      await assertStableProjectRoot(project.realPath);
    } catch {
      throw new BridgeError(409, "PROJECT_ROOT_CHANGED", "등록된 프로젝트 루트가 변경되어 접근을 차단했습니다.");
    }
    return project;
  }

  private pruneRemoteCommandApprovals(): void {
    const current = Date.now();
    for (const [approvalId, approval] of this.remoteCommandApprovals) {
      if (Date.parse(approval.expiresAt) <= current) this.remoteCommandApprovals.delete(approvalId);
    }
  }

  private sanitizeProjectCommandText(project: ProjectRecord, value: string, plan: RemoteCommandPlan): string {
    let sanitized = redactSensitiveText(value, 128 * 1024);
    const replacements: Array<[string | undefined, string]> = [
      [plan.gitPush?.remoteUrl, `[${plan.gitPush?.host || "git-remote"}]`],
      [project.realPath, project.name],
      [this.config.dataDir, "[bridge-data]"],
      [this.config.userHome, "~"],
    ];
    for (const [privateValue, label] of replacements) {
      if (privateValue) sanitized = sanitized.split(privateValue).join(label);
    }
    return sanitized;
  }

  private async validateApprovalContext(thread: ThreadRecord, input?: unknown): Promise<{ description?: string; files: string[]; commands: string[] }> {
    if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input))) {
      throw new BridgeError(400, "INVALID_APPROVAL_CONTEXT", "승인 요청 정보 형식이 올바르지 않습니다.");
    }
    const context = input as ApprovalContext | undefined;
    if (context?.files !== undefined && (!Array.isArray(context.files) || context.files.some((value) => typeof value !== "string"))) {
      throw new BridgeError(400, "INVALID_APPROVAL_FILES", "변경 예정 파일 목록이 올바르지 않습니다.");
    }
    if (context?.commands !== undefined && (!Array.isArray(context.commands) || context.commands.some((value) => typeof value !== "string"))) {
      throw new BridgeError(400, "INVALID_APPROVAL_COMMANDS", "실행 예정 명령 목록이 올바르지 않습니다.");
    }
    const files = contextStrings(context?.files, 100).map((value) => value.slice(0, 1_024));
    const commands = contextStrings(context?.commands, 20).map((value) => value.slice(0, 2_000));
    if (files.some((file) => file.includes("\0")) || commands.some((command) => command.includes("\0"))) {
      throw new BridgeError(400, "INVALID_APPROVAL_CONTEXT", "승인 요청 정보에 허용되지 않는 문자가 있습니다.");
    }
    if (files.length) {
      if (!thread.projectId) throw new BridgeError(400, "PROJECT_REQUIRED", "파일 작업에는 프로젝트가 필요합니다.");
      const state = await this.store.read();
      const project = state.projects.find((entry) => entry.id === thread.projectId);
      if (!project) throw new BridgeError(404, "PROJECT_NOT_FOUND", "등록된 프로젝트를 찾을 수 없습니다.");
      for (const file of files) {
        try { await resolveAllowedProjectPath(project.realPath, file); }
        catch { throw new BridgeError(403, "PATH_OUTSIDE_PROJECT", "프로젝트 외부 경로 또는 외부 심볼릭 링크는 허용되지 않습니다."); }
      }
    }
    if (commands.length) {
      if (!thread.projectId) throw new BridgeError(400, "PROJECT_REQUIRED", "명령 실행에는 프로젝트가 필요합니다.");
      const state = await this.store.read();
      const project = state.projects.find((entry) => entry.id === thread.projectId);
      if (!project) throw new BridgeError(404, "PROJECT_NOT_FOUND", "등록된 프로젝트를 찾을 수 없습니다.");
      for (const command of commands) {
        if (hasOutsideProjectPathSyntax(command)) {
          throw new BridgeError(403, "PATH_OUTSIDE_PROJECT", "프로젝트 외부 경로를 참조하는 명령은 허용되지 않습니다.");
        }
        const tokens = simpleCommandTokens(command);
        const candidates = tokens ? commandPathCandidates(tokens) : undefined;
        if (!tokens || !candidates) {
          throw new BridgeError(400, "COMPLEX_COMMAND_NOT_ALLOWED", "복합 shell/interpreter 명령은 허용되지 않습니다. 실행할 명령을 개별 항목으로 나누세요.");
        }
        for (const candidate of candidates) {
          try {
            await resolveAllowedProjectPath(project.realPath, candidate);
          } catch {
            throw new BridgeError(403, "PATH_OUTSIDE_PROJECT", "프로젝트 외부 경로 또는 외부 심볼릭 링크를 참조하는 명령은 허용되지 않습니다.");
          }
        }
      }
    }
    if (context?.description !== undefined && typeof context.description !== "string") {
      throw new BridgeError(400, "INVALID_APPROVAL_DESCRIPTION", "작업 설명이 올바르지 않습니다.");
    }
    return { description: typeof context?.description === "string" ? redact(context.description).slice(0, 500) : undefined, files, commands };
  }

  private async runTurn(device: AuthenticatedDevice, threadId: string, messageId: string, turnScope: TurnScope): Promise<void> {
    const controller = new AbortController();
    this.running.set(threadId, controller);
    let lockedProjectId = "";
    let assistantId = randomId("message");
    let assistantText = "";
    try {
      const snapshot = await this.store.update((state) => {
        const thread = this.findOwnedThread(state.threads, threadId, device.id);
        const userMessage = thread.messages.find((message) => message.id === messageId);
        if (!userMessage) throw new BridgeError(404, "MESSAGE_NOT_FOUND", "메시지를 찾을 수 없습니다.");
        userMessage.status = "streaming";
        userMessage.updatedAt = now();
        const assistant: MessageRecord = { id: assistantId, role: "assistant", content: "", status: "streaming", createdAt: now(), updatedAt: now() };
        thread.messages.push(assistant);
        thread.status = "running";
        thread.updatedAt = now();
        return { thread: structuredClone(thread), content: userMessage.content };
      });
      const state = await this.store.read();
      const project = snapshot.thread.projectId ? state.projects.find((entry) => entry.id === snapshot.thread.projectId) : undefined;
      if (project) {
        try {
          await assertStableProjectRoot(project.realPath);
        } catch {
          throw new BridgeError(409, "PROJECT_ROOT_CHANGED", "등록된 프로젝트 루트가 변경되어 실행을 차단했습니다.");
        }
        if (this.projectOperationsRunning.has(project.id)) {
          throw new BridgeError(409, "PROJECT_OPERATION_IN_PROGRESS", "이 프로젝트에서 다른 Codex 작업 또는 원격 명령을 실행 중입니다.");
        }
        this.projectOperationsRunning.add(project.id);
        lockedProjectId = project.id;
      }
      const workingDirectory = snapshot.thread.mode === "general" ? join(this.config.dataDir, "general-workspace") : project?.realPath;
      if (!workingDirectory) throw new BridgeError(409, "PROJECT_NOT_AVAILABLE", "등록된 프로젝트를 사용할 수 없습니다.");
      const policy: TurnExecutionPolicy = {
        permissions: new Set(turnScope.permissions),
        approvedFiles: turnScope.files,
        approvedCommands: turnScope.commands,
        criticalApproval: turnScope.criticalApproval,
        localWorkspaceAccess: turnScope.localWorkspaceAccess,
        projectRoot: project?.realPath,
      };

      for await (const event of this.adapter.run({
        sdkThreadId: snapshot.thread.sdkThreadId,
        mode: snapshot.thread.mode,
        workingDirectory,
        content: snapshot.content,
        permissions: turnScope.permissions,
        approvedFiles: turnScope.files,
        approvedCommands: turnScope.commands,
        criticalApproval: turnScope.criticalApproval,
        localWorkspaceAccess: turnScope.localWorkspaceAccess,
        signal: controller.signal,
      })) {
        if (event.type === "thread.started") {
          await this.store.update((next) => { this.findOwnedThread(next.threads, threadId, device.id).sdkThreadId = event.thread_id; });
          await this.publish(threadId, "thread.sdk-linked", { sdkThreadId: event.thread_id });
          continue;
        }
        if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
          const handled = await this.handleItem(threadId, assistantId, event.item, assistantText, policy);
          assistantText = handled.assistantText;
          continue;
        }
        if (event.type === "turn.completed") {
          await this.publish(threadId, "turn.completed", { usage: event.usage });
        } else if (event.type === "turn.failed") {
          throw new Error(event.error.message);
        } else if (event.type === "error") {
          throw new Error(event.message);
        } else {
          await this.publish(threadId, event.type, {});
        }
      }

      await this.store.update((next) => {
        const thread = this.findOwnedThread(next.threads, threadId, device.id);
        const user = thread.messages.find((message) => message.id === messageId);
        const assistant = thread.messages.find((message) => message.id === assistantId);
        if (user) { user.status = "completed"; user.updatedAt = now(); }
        if (assistant) { assistant.status = "completed"; assistant.content = assistantText; assistant.updatedAt = now(); }
        thread.status = "idle";
        thread.updatedAt = now();
      });
      await this.publish(threadId, "message.completed", { messageId: assistantId, content: assistantText });
    } catch (error) {
      const policyViolation = error instanceof PolicyViolationError;
      const cancelled = controller.signal.aborted && !policyViolation;
      const codexFailure = error instanceof BridgeError
        ? { code: error.code, message: error.message }
        : classifyCodexFailure(error);
      const message = policyViolation
        ? error.message
        : cancelled
          ? "응답 생성이 중지되었습니다."
          : codexFailure.message;
      await this.store.update((state) => {
        const thread = state.threads.find((entry) => entry.id === threadId && entry.ownerDeviceId === device.id);
        if (!thread) return;
        const user = thread.messages.find((entry) => entry.id === messageId);
        const assistant = thread.messages.find((entry) => entry.id === assistantId);
        const status = cancelled ? "cancelled" : "failed";
        if (user) { user.status = status; user.error = message; user.updatedAt = now(); }
        if (assistant) { assistant.status = status; assistant.error = message; assistant.updatedAt = now(); }
        thread.status = cancelled ? "idle" : "failed";
        thread.updatedAt = now();
      }).catch(() => undefined);
      await this.publish(threadId, cancelled ? "turn.cancelled" : "turn.failed", {
        message,
        code: policyViolation ? "POLICY_VIOLATION" : cancelled ? undefined : codexFailure.code,
      }).catch(() => undefined);
    } finally {
      if (this.running.get(threadId) === controller) this.running.delete(threadId);
      if (lockedProjectId) this.projectOperationsRunning.delete(lockedProjectId);
    }
  }

  private async handleItem(
    threadId: string,
    assistantId: string,
    item: ThreadItem,
    previousText: string,
    policy: TurnExecutionPolicy,
  ): Promise<{ assistantText: string }> {
    if (item.type === "agent_message") {
      const text = await this.sanitizeRuntimeText(threadId, item.text);
      const delta = text.startsWith(previousText) ? text.slice(previousText.length) : text;
      if (delta) await this.publish(threadId, "message.delta", { messageId: assistantId, delta });
      await this.store.update((state) => {
        const thread = state.threads.find((entry) => entry.id === threadId);
        const assistant = thread?.messages.find((entry) => entry.id === assistantId);
        if (assistant) { assistant.content = text; assistant.updatedAt = now(); }
      });
      return { assistantText: text };
    }
    if (item.type === "mcp_tool_call" || item.type === "web_search") {
      await this.failPolicy(threadId, "외부 MCP/app/web 도구 호출이 감지되어 작업을 중지했습니다.", "external-tool");
    } else if (item.type === "command_execution") {
      await this.enforceCommandPolicy(threadId, item.command, policy);
      const command = await this.sanitizeRuntimeText(threadId, item.command);
      const output = await this.sanitizeRuntimeText(threadId, item.aggregated_output);
      await this.publish(threadId, `command.${item.status}`, { id: item.id, command, output, exitCode: item.exit_code });
    } else if (item.type === "file_change") {
      if (!policy.projectRoot || !policy.permissions.has("file:write")) {
        await this.failPolicy(threadId, "승인되지 않은 파일 변경을 Codex가 시도해 작업을 중지했습니다.", "file");
      }
      const state = await this.store.read();
      const thread = state.threads.find((entry) => entry.id === threadId);
      const project = thread?.projectId ? state.projects.find((entry) => entry.id === thread.projectId) : undefined;
      const changes: Array<{ path: string; kind: string }> = [];
      for (const change of item.changes) {
        if (change.kind === "delete" && !policy.criticalApproval) {
          await this.failPolicy(threadId, "별도 위험 승인을 받지 않은 파일 삭제가 감지되어 작업을 중지했습니다.", "file");
        }
        const display = project ? publicProjectPath(project.realPath, change.path) : undefined;
        if (!display || !project) await this.failPolicy(threadId, "프로젝트 외부 파일 변경이 감지되어 작업을 중지했습니다.", "path");
        const allowedProject = project!;
        const allowedDisplay = display!;
        try {
          await resolveAllowedProjectPath(allowedProject.realPath, allowedDisplay);
        } catch {
          await this.failPolicy(threadId, "프로젝트 외부 경로 또는 외부 심볼릭 링크 변경이 감지되어 작업을 중지했습니다.", "path");
        }
        if (policy.approvedFiles.length && !policy.approvedFiles.some((allowed) => pathWithinScope(allowedDisplay, allowed))) {
          await this.failPolicy(threadId, "승인 목록에 없는 파일 변경이 감지되어 작업을 중지했습니다.", "file");
        }
        changes.push({ path: allowedDisplay, kind: change.kind });
      }
      await this.publish(threadId, "file.changed", { id: item.id, changes, status: item.status });
    } else if (item.type === "error") {
      await this.publish(threadId, "item.error", { message: "Codex 작업 항목에서 오류가 발생했습니다." });
    } else if (item.type === "todo_list") {
      await this.publish(threadId, "todo.updated", { items: item.items });
    }
    return { assistantText: previousText };
  }

  private async enforceCommandPolicy(threadId: string, command: string, policy: TurnExecutionPolicy): Promise<void> {
    const sanitized = await this.sanitizeRuntimeText(threadId, command);
    const sequence = policy.localWorkspaceAccess ? safeLocalCommandSequence(command) : [command];
    if (!sequence) {
      await this.failPolicy(threadId, "복합 shell 또는 inline interpreter 명령이 감지되어 작업을 중지했습니다.", "command", sanitized);
    }
    for (const segment of sequence!) {
      const required = requiredCommandPermission(segment);
      if (hasOutsideProjectPathSyntax(segment)) {
        await this.failPolicy(threadId, "프로젝트 외부 경로를 참조하는 명령이 감지되어 작업을 중지했습니다.", "path", sanitized);
      }
      const tokens = simpleCommandTokens(segment);
      const candidates = tokens ? commandPathCandidates(tokens) : undefined;
      if (policy.localWorkspaceAccess && (!tokens || !candidates)) {
        await this.failPolicy(threadId, "inline interpreter 또는 검사할 수 없는 명령이 감지되어 작업을 중지했습니다.", "command", sanitized);
      }
      if (policy.projectRoot && candidates) {
        for (const candidate of candidates) {
          try {
            await resolveAllowedProjectPath(policy.projectRoot, candidate);
          } catch {
            await this.failPolicy(threadId, "프로젝트 외부 경로 또는 외부 심볼릭 링크를 참조하는 명령이 감지되어 작업을 중지했습니다.", "path", sanitized);
          }
        }
      }
      if (CRITICAL_PATTERN.test(segment) && !policy.criticalApproval) {
        await this.failPolicy(threadId, "별도 위험 승인을 받지 않은 명령이 감지되어 작업을 중지했습니다.", "command", sanitized);
      }
      if (required && !policy.permissions.has(required)) {
        await this.failPolicy(threadId, `${required} 권한으로 승인되지 않은 명령이 감지되어 작업을 중지했습니다.`, "command", sanitized);
      }
    }
    const required = requiredCommandPermission(command);
    if (required && policy.approvedCommands.length && !policy.localWorkspaceAccess) {
      const actual = comparableCommand(command);
      const approved = policy.approvedCommands.some((candidate) => comparableCommand(candidate) === actual);
      if (!approved) await this.failPolicy(threadId, "승인 목록에 없는 명령이 감지되어 작업을 중지했습니다.", "command", sanitized);
    }
  }

  private async failPolicy(threadId: string, message: string, kind: string, command?: string): Promise<never> {
    this.running.get(threadId)?.abort();
    await this.publish(threadId, "security.violation", { kind, message, command });
    throw new PolicyViolationError(message);
  }

  private async sanitizeRuntimeText(threadId: string, value: string, maximum = 128 * 1024): Promise<string> {
    let sanitized = redactSensitiveText(value, maximum);
    const state = await this.store.read();
    const thread = state.threads.find((entry) => entry.id === threadId);
    const project = thread?.projectId ? state.projects.find((entry) => entry.id === thread.projectId) : undefined;
    const replacements: Array<[string | undefined, string]> = [
      [project?.realPath, project?.name || "[project]"],
      [this.config.dataDir, "[bridge-data]"],
      [this.config.userHome, "~"],
    ];
    for (const [privatePath, label] of replacements) {
      if (privatePath) sanitized = sanitized.split(privatePath).join(label);
    }
    return sanitized;
  }

  private async publish(threadId: string, type: string, data: Record<string, unknown>): Promise<BridgeEvent> {
    const event = await this.store.update((state) => {
      const thread = state.threads.find((entry) => entry.id === threadId);
      if (!thread) throw new BridgeError(404, "THREAD_NOT_FOUND", "대화를 찾을 수 없습니다.");
      const value: BridgeEvent = { id: thread.nextEventId++, type, threadId, createdAt: now(), data };
      thread.events.push(value);
      if (thread.events.length > 500) thread.events.splice(0, thread.events.length - 500);
      return value;
    });
    for (const listener of this.listeners.get(threadId) || []) listener(event);
    return event;
  }

  private findOwnedThread(threads: ThreadRecord[], threadId: string, deviceId: string): ThreadRecord {
    const thread = threads.find((entry) => entry.id === threadId && entry.ownerDeviceId === deviceId);
    if (!thread) throw new BridgeError(404, "THREAD_NOT_FOUND", "대화를 찾을 수 없습니다.");
    return thread;
  }

  private requireThreadAvailable(thread: ThreadRecord): void {
    if (thread.status === "running" || thread.status === "awaiting-approval" || this.running.has(thread.id)) {
      throw new BridgeError(409, "THREAD_BUSY", "이 대화에서 응답을 생성하거나 작업 승인을 기다리는 중입니다.");
    }
  }

  private requireActiveApproval(state: BridgeState, thread: ThreadRecord, approval: ApprovalRecord): MessageRecord {
    const latestPending = state.approvals
      .filter((entry) => entry.threadId === thread.id && entry.deviceId === thread.ownerDeviceId && entry.status === "pending")
      .at(-1);
    const message = thread.messages.find((entry) => entry.id === approval.messageId);
    if (
      thread.status !== "awaiting-approval"
      || this.running.has(thread.id)
      || latestPending?.id !== approval.id
      || message?.status !== "awaiting-approval"
    ) {
      throw new BridgeError(409, "APPROVAL_STALE", "현재 대기 중인 작업의 승인 요청이 아닙니다.");
    }
    return message;
  }
}
