import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Codex, type ThreadEvent, type ThreadOptions } from "@openai/codex-sdk";
import type { DevicePermission, ThreadMode } from "./types.js";

export interface CodexRunRequest {
  sdkThreadId?: string;
  mode: ThreadMode;
  workingDirectory: string;
  content: string;
  permissions: DevicePermission[];
  approvedFiles: string[];
  approvedCommands: string[];
  criticalApproval: boolean;
  localWorkspaceAccess: boolean;
  signal: AbortSignal;
}

const SAFE_ENVIRONMENT_KEYS = new Set([
  "PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE",
  "TERM", "NO_COLOR", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "CODEX_HOME",
]);

/**
 * Give the SDK only the process metadata needed to locate the locally logged-in
 * Codex installation. API keys, bearer tokens and unrelated application secrets
 * are intentionally not inherited by the agent process.
 */
export function createCodexEnvironment(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = env[key];
    if (value !== undefined) safe[key] = value;
  }
  return safe;
}

export interface CodexAdapter {
  run(request: CodexRunRequest): AsyncIterable<ThreadEvent>;
  loginStatus(): Promise<{ loggedIn: boolean; status: "logged-in" | "not-logged-in" | "unavailable" }>;
}

export function threadOptionsFor(request: Pick<CodexRunRequest, "mode" | "workingDirectory" | "permissions">): ThreadOptions {
  const hasApprovedCapability = request.mode === "codex" && request.permissions.some((permission) =>
    permission === "file:write" || permission === "command:execute" || permission === "build:execute" || permission === "git");
  const needsWorkspaceWrite = request.mode === "codex" && request.permissions.some((permission) =>
    permission === "file:write" || permission === "build:execute" || permission === "git");
  return {
    workingDirectory: request.workingDirectory,
    skipGitRepoCheck: request.mode === "general",
    sandboxMode: needsWorkspaceWrite ? "workspace-write" : "read-only",
    approvalPolicy: hasApprovedCapability ? "never" : "untrusted",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    additionalDirectories: [],
  };
}

export function shellToolsEnabledFor(request: Pick<CodexRunRequest, "mode" | "permissions">): boolean {
  return request.mode === "codex" && request.permissions.some((permission) =>
    permission === "command:execute" || permission === "build:execute" || permission === "git");
}

export const CODEX_SECURITY_CONFIG = {
  web_search: "disabled",
  mcp_servers: {},
  features: {
    hooks: false,
    apps: false,
    browser_use: false,
    computer_use: false,
    remote_plugin: false,
    skill_mcp_dependency_install: false,
  },
} as const;

const CODEX_WRAPPER_PATH = fileURLToPath(new URL("../bin/codex-wrapper.mjs", import.meta.url));

export class OfficialCodexAdapter implements CodexAdapter {
  private readonly environment = createCodexEnvironment();
  private readonly codex = new Codex({
    env: this.environment,
    codexPathOverride: CODEX_WRAPPER_PATH,
    config: CODEX_SECURITY_CONFIG,
  });
  private readonly noShellCodex = new Codex({
    env: this.environment,
    codexPathOverride: CODEX_WRAPPER_PATH,
    config: {
      ...CODEX_SECURITY_CONFIG,
      features: { ...CODEX_SECURITY_CONFIG.features, shell_tool: false, unified_exec: false },
    },
  });
  private loginCache?: { value: { loggedIn: boolean; status: "logged-in" | "not-logged-in" | "unavailable" }; expiresAt: number };

  async *run(request: CodexRunRequest): AsyncIterable<ThreadEvent> {
    const options = threadOptionsFor(request);
    const hasApprovedCapability = request.mode === "codex" && request.permissions.some((permission) =>
      permission === "file:write" || permission === "command:execute" || permission === "build:execute" || permission === "git");
    const client = shellToolsEnabledFor(request) ? this.codex : this.noShellCodex;
    const thread = request.sdkThreadId
      ? client.resumeThread(request.sdkThreadId, options)
      : client.startThread(options);
    const guard = request.mode === "general"
      ? "You are the LifeHub general assistant. Answer without reading or changing local files, running commands, searching the web, or calling MCP/apps/connectors."
      : request.localWorkspaceAccess
        ? [
          "This turn was explicitly started in trusted local-workspace mode by the authenticated local web client.",
          `The client granted these capabilities for this turn: ${request.permissions.join(", ")}.`,
          `All file reads and writes must stay inside the selected project, and writes must stay inside these approved files/directories: ${JSON.stringify(request.approvedFiles)}.`,
          "You may run non-critical commands inside the selected project without matching an exact command allowlist, but only when the corresponding command/build/git capability was granted.",
          "Do not delete files, run destructive commands, access paths outside the project (including through symlinks), enable network access, search the web, or call MCP/apps/connectors.",
        ].join(" ")
      : hasApprovedCapability
        ? [
          `The user explicitly approved only these capabilities for this turn: ${request.permissions.join(", ")}.`,
          `Exact approved files/directories: ${JSON.stringify(request.approvedFiles)}.`,
          `Exact approved commands: ${JSON.stringify(request.approvedCommands)}.`,
          request.criticalApproval
            ? "A separate critical approval was granted only for the exact scope above."
            : "No deletion or other destructive operation is approved.",
          "Stay inside the selected project. Do not access outside paths, expand the approved scope, search the web, or call MCP/apps/connectors.",
        ].join(" ")
        : "Work in read-only mode. Do not modify files, run commands that change state, search the web, or call MCP/apps/connectors.";
    const result = await thread.runStreamed(`${guard}\n\nUser request:\n${request.content}`, { signal: request.signal });
    yield* result.events;
  }

  async loginStatus(): Promise<{ loggedIn: boolean; status: "logged-in" | "not-logged-in" | "unavailable" }> {
    if (this.loginCache && this.loginCache.expiresAt > Date.now()) return this.loginCache.value;
    return new Promise((resolvePromise) => {
      const child = spawn(process.execPath, [CODEX_WRAPPER_PATH, "login", "status"], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: this.environment,
      });
      let statusTail = "";
      let timedOut = false;
      let settled = false;
      const finish = (
        value: { loggedIn: boolean; status: "logged-in" | "not-logged-in" | "unavailable" },
        cacheMs: number,
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        statusTail = "";
        this.loginCache = { value, expiresAt: Date.now() + cacheMs };
        resolvePromise(value);
      };
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, 5_000);
      const captureStatus = (chunk: string) => { statusTail = (statusTail + chunk).slice(-512); };
      child.stdout.setEncoding("utf8").on("data", captureStatus);
      child.stderr.setEncoding("utf8").on("data", captureStatus);
      child.once("error", () => {
        finish({ loggedIn: false, status: "unavailable" }, 5_000);
      });
      child.once("close", (code) => {
        if (timedOut) {
          finish({ loggedIn: false, status: "unavailable" }, 5_000);
          return;
        }
        const loggedIn = code === 0 && /logged in/i.test(statusTail) && !/not logged in/i.test(statusTail);
        const value = {
          loggedIn,
          status: loggedIn ? "logged-in" : code === 0 || /not logged in/i.test(statusTail) ? "not-logged-in" : "unavailable",
        } as const;
        finish(value, 15_000);
      });
    });
  }
}
