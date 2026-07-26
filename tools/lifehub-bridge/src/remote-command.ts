import { spawn } from "node:child_process";
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { basename, delimiter, isAbsolute, join } from "node:path";
import { assertStableProjectRoot, resolveAllowedProjectPath } from "./projects.js";
import type { DevicePermission } from "./types.js";

const BUILD_COMMAND_PATTERN = /^(?:npm|npx|pnpm|yarn|bun|gradle|gradlew|mvn|mvnw|make|cmake|cargo|go|dotnet|pytest|jest|vitest)$/i;
const ALLOWED_EXECUTABLES = new Set([
  "bun", "cargo", "cat", "cmake", "cp", "dotnet", "echo", "false", "find", "git", "go", "gradle",
  "gradlew", "grep", "head", "java", "javac", "jest", "ls", "make", "mkdir", "mv", "mvn", "mvnw", "node",
  "npm", "npx", "perl", "php", "pnpm", "printf", "pwd", "pytest", "python", "python3", "rg", "ruby", "sed",
  "stat", "tail", "test", "touch", "true", "vitest", "wc", "yarn",
]);
const READ_ONLY_EXECUTABLES = new Set(["cat", "echo", "false", "grep", "head", "ls", "printf", "pwd", "rg", "stat", "tail", "test", "true", "wc"]);
const BLOCKED_EXECUTABLES = new Set([
  "bash", "chmod", "chown", "cmd", "curl", "dash", "dd", "docker", "doas", "env", "eval", "exec",
  "fish", "helm", "kill", "killall", "kubectl", "mkfs", "mount", "nc", "ncat", "pkill", "podman",
  "powershell", "printenv", "pwsh", "reboot", "rm", "rmdir", "scp", "service", "sftp", "sh", "shutdown",
  "socat", "source", "ssh", "su", "sudo", "systemctl", "truncate", "umount", "unlink", "wget", "zsh",
]);
const INTERPRETERS = new Set(["node", "perl", "php", "python", "python3", "ruby"]);
const ALLOWED_GIT_COMMANDS = new Set(["add", "commit", "diff", "log", "ls-files", "push", "rev-parse", "show", "status"]);
const GIT_REPOSITORY_OVERRIDE_FLAGS = /^(?:-C|-c|--git-dir(?:=|$)|--work-tree(?:=|$)|--config-env(?:=|$))/;
const SAFE_REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_BRANCH_NAME = /^(?![-/])(?!.*(?:\.\.|\/\/|@\{|\\|\s))(?!.*\.lock$)[A-Za-z0-9._/-]{1,200}$/;
const MAX_COMMAND_LENGTH = 2_000;
const MAX_OUTPUT_BYTES = 128 * 1024;

export type RemoteCommandPermission = Extract<DevicePermission, "command:execute" | "build:execute" | "git">;

export interface GitPushPlan {
  remote: string;
  branch: string;
  head: string;
  host: string;
  remoteUrl: string;
  setUpstream: boolean;
}

export interface RemoteCommandPlan {
  command: string;
  argv: string[];
  permission: RemoteCommandPermission;
  requiredPermissions: DevicePermission[];
  risk: "medium" | "high";
  gitPush?: GitPushPlan;
}

export interface RemoteCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

export class RemoteCommandError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function executableName(value: string): string {
  return basename(value).toLowerCase();
}

function safePathDirectories(): string[] {
  return (process.env.PATH || "")
    .split(delimiter)
    .filter((entry) => isAbsolute(entry) && !entry.split(/[\\/]/).some((part, index, parts) => part === "node_modules" && parts[index + 1] === ".bin"))
    .map((entry) => {
      try {
        const resolved = realpathSync(entry);
        const info = statSync(resolved);
        if (!info.isDirectory() || process.platform !== "win32" && (info.mode & 0o002) !== 0) return "";
        return resolved;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function resolveExecutablePath(value: string): string {
  const candidates = isAbsolute(value)
    ? [value]
    : safePathDirectories().flatMap((directory) => process.platform === "win32"
      ? [join(directory, `${value}.exe`), join(directory, `${value}.cmd`), join(directory, value)]
      : [join(directory, value)]);
  for (const candidate of candidates) {
    try {
      const resolved = realpathSync(candidate);
      const info = statSync(resolved);
      if (!info.isFile() || process.platform !== "win32" && (info.mode & 0o002) !== 0) continue;
      accessSync(resolved, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return resolved;
    } catch {
      // Continue to the next trusted PATH entry.
    }
  }
  throw new RemoteCommandError(400, "COMMAND_START_FAILED", "안전한 PATH에서 명령 실행 파일을 찾을 수 없습니다.");
}

function tokenize(command: string): string[] | undefined {
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

function argumentPathCandidate(token: string): string {
  if (token.startsWith("--") && token.includes("=")) return token.slice(token.indexOf("=") + 1);
  const attachedShortOption = /^-[A-Za-z](.+)$/.exec(token);
  return attachedShortOption?.[1] || token;
}

function rejectOutsidePathSyntax(tokens: string[]): void {
  for (const token of tokens) {
    const candidate = argumentPathCandidate(token);
    if (
      candidate.includes("\0")
      || candidate === "~"
      || candidate.startsWith("~/")
      || candidate.startsWith("~\\")
      || /(?:^|[=\\/])\.\.(?:[\\/]|$)/.test(candidate)
      || /(?:^|=)(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(candidate)
      || /[*?\[\]]/.test(candidate)
    ) {
      throw new RemoteCommandError(403, "PATH_OUTSIDE_PROJECT", "프로젝트 밖 경로나 glob이 포함된 명령은 실행할 수 없습니다.");
    }
  }
}

async function validatePathArguments(projectRoot: string, tokens: string[]): Promise<void> {
  rejectOutsidePathSyntax(tokens.slice(1));
  for (const token of tokens.slice(1)) {
    if (!token || token === "--") continue;
    const candidate = argumentPathCandidate(token);
    if (token.startsWith("-") && candidate === token) continue;
    try {
      await resolveAllowedProjectPath(projectRoot, candidate);
    } catch {
      throw new RemoteCommandError(403, "PATH_OUTSIDE_PROJECT", "프로젝트 밖 경로나 외부 심볼릭 링크를 참조하는 명령은 실행할 수 없습니다.");
    }
  }
}

function validateExecutable(tokens: string[]): void {
  const raw = tokens[0]!;
  if (raw.includes("/") && !/^\/(?:usr\/local\/bin|usr\/bin|bin)\/[^/]+$/.test(raw)) {
    throw new RemoteCommandError(403, "EXECUTABLE_NOT_ALLOWED", "허용된 시스템 실행 경로만 사용할 수 있습니다.");
  }
  const executable = executableName(raw);
  if (!ALLOWED_EXECUTABLES.has(executable)) {
    throw new RemoteCommandError(403, "EXECUTABLE_NOT_ALLOWED", `${executable} 명령은 원격 명령 허용 목록에 없습니다.`);
  }
  if (BLOCKED_EXECUTABLES.has(executable)) {
    throw new RemoteCommandError(403, "EXECUTABLE_NOT_ALLOWED", `${executable} 명령은 원격 명령 화면에서 실행할 수 없습니다.`);
  }
  if (INTERPRETERS.has(executable)) {
    const firstArgument = tokens[1];
    const scriptArgument = firstArgument === "--" ? tokens[2] : firstArgument;
    if (!scriptArgument || scriptArgument === "-" || firstArgument !== "--" && firstArgument?.startsWith("-")) {
      throw new RemoteCommandError(403, "INTERPRETER_EVAL_NOT_ALLOWED", "interpreter 옵션이나 인라인 코드는 실행할 수 없습니다. 프로젝트 안의 스크립트 파일을 직접 실행하세요.");
    }
  }
  if (executable === "rg" && tokens.slice(1).some((token) => (
    token === "--pre"
    || token.startsWith("--pre=")
    || token === "--pre-glob"
    || token.startsWith("--pre-glob=")
    || token === "--hostname-bin"
    || token.startsWith("--hostname-bin=")
  ))) {
    throw new RemoteCommandError(403, "RG_EXTERNAL_COMMAND_NOT_ALLOWED", "ripgrep의 외부 프로그램 실행 옵션은 사용할 수 없습니다.");
  }
  if (executable === "find" && tokens.some((token) => ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(token.toLowerCase()))) {
    throw new RemoteCommandError(403, "FIND_ACTION_NOT_ALLOWED", "find의 삭제 또는 하위 명령 실행 동작은 사용할 수 없습니다.");
  }
}

function validateGitCommand(tokens: string[]): string {
  if (tokens.slice(1).some((token) => GIT_REPOSITORY_OVERRIDE_FLAGS.test(token))) {
    throw new RemoteCommandError(403, "GIT_REPOSITORY_OVERRIDE_DENIED", "Git 저장소 위치나 실행 설정을 덮어쓰는 옵션은 허용되지 않습니다.");
  }
  const subcommand = (tokens[1] || "").toLowerCase();
  if (!ALLOWED_GIT_COMMANDS.has(subcommand)) {
    throw new RemoteCommandError(403, "GIT_COMMAND_NOT_ALLOWED", "이 화면에서는 Git 조회, add, commit, push 명령만 사용할 수 있습니다.");
  }
  if (subcommand === "commit" && tokens.some((token) => token === "--no-verify")) {
    throw new RemoteCommandError(403, "GIT_HOOK_BYPASS_DENIED", "commit 검증 hook을 건너뛸 수 없습니다.");
  }
  return subcommand;
}

function safeEnvironment(): NodeJS.ProcessEnv {
  const keys = [
    "PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "TMPDIR", "TMP", "TEMP",
    "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "SSH_AUTH_SOCK",
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of keys) if (process.env[key] !== undefined) env[key] = process.env[key];
  return {
    ...env,
    PATH: safePathDirectories().join(delimiter),
    CI: "1",
    NO_COLOR: "1",
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
    GIT_ASKPASS: "/bin/false",
    SSH_ASKPASS: "/bin/false",
  };
}

function terminate(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RemoteCommandError(499, "REMOTE_COMMAND_CANCELLED", "원격 명령 요청이 취소되었습니다.");
  }
}

function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<RemoteCommandResult> {
  try {
    throwIfAborted(signal);
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolvePromise, reject) => {
    const startedAt = Date.now();
    const child = spawn(resolveExecutablePath(executable), args, {
      cwd,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: safeEnvironment(),
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let aborted = false;
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const append = (current: string, chunk: string, mark: (value: boolean) => void): string => {
      if (Buffer.byteLength(current) >= MAX_OUTPUT_BYTES) {
        mark(true);
        return current;
      }
      const next = current + chunk;
      if (Buffer.byteLength(next) <= MAX_OUTPUT_BYTES) return next;
      mark(true);
      return Buffer.from(next).subarray(0, MAX_OUTPUT_BYTES).toString("utf8");
    };
    const requestTermination = () => {
      terminate(child);
      if (forceKillTimer) return;
      forceKillTimer = setTimeout(() => {
        if (!settled) {
          try {
            if (process.platform === "win32") child.kill("SIGKILL");
            else if (child.pid) process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        }
      }, 1_000);
      forceKillTimer.unref();
    };
    const abort = () => {
      aborted = true;
      requestTermination();
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      requestTermination();
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout = append(stdout, chunk, (value) => { stdoutTruncated = value; });
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = append(stderr, chunk, (value) => { stderrTruncated = value; });
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      signal?.removeEventListener("abort", abort);
      reject(new RemoteCommandError(400, "COMMAND_START_FAILED", error.message.includes("ENOENT") ? "명령 실행 파일을 찾을 수 없습니다." : "명령을 시작하지 못했습니다."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      signal?.removeEventListener("abort", abort);
      if (aborted && !timedOut) {
        reject(new RemoteCommandError(499, "REMOTE_COMMAND_CANCELLED", "원격 명령 요청이 취소되었습니다."));
        return;
      }
      resolvePromise({
        stdout: stdout + (stdoutTruncated ? "\n[출력이 제한 크기를 넘어 잘렸습니다.]\n" : ""),
        stderr: stderr + (stderrTruncated ? "\n[오류 출력이 제한 크기를 넘어 잘렸습니다.]\n" : ""),
        exitCode: typeof code === "number" ? code : -1,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

async function runGitRead(projectRoot: string, args: string[]): Promise<string> {
  const result = await runProcess("git", args, projectRoot, 5_000);
  if (result.exitCode !== 0) throw new RemoteCommandError(409, "GIT_STATE_UNAVAILABLE", "Git 저장소 상태를 확인할 수 없습니다.");
  return result.stdout.trim();
}

function remoteHost(remoteUrl: string): string {
  try {
    const parsed = new URL(remoteUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "ssh:") throw new Error("protocol");
    if (parsed.protocol === "https:" && (parsed.username || parsed.password)) throw new Error("credentials");
    return parsed.hostname.toLowerCase();
  } catch {
    const scpLike = /^(?:[^@\s]+@)?([^:\s/]+):[^\s]+$/.exec(remoteUrl);
    if (scpLike?.[1]) return scpLike[1].toLowerCase();
    throw new RemoteCommandError(403, "GIT_REMOTE_NOT_ALLOWED", "HTTPS 또는 SSH Git 원격 저장소만 push할 수 있습니다.");
  }
}

async function prepareGitPush(
  projectRoot: string,
  tokens: string[],
  allowedHosts: Set<string>,
): Promise<{ argv: string[]; gitPush: GitPushPlan }> {
  const currentBranch = await runGitRead(projectRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (!SAFE_BRANCH_NAME.test(currentBranch)) {
    throw new RemoteCommandError(409, "GIT_BRANCH_NOT_PUSHABLE", "detached HEAD 또는 지원하지 않는 브랜치에서는 push할 수 없습니다.");
  }
  let args = tokens.slice(2);
  let setUpstream = false;
  if (args[0] === "-u" || args[0] === "--set-upstream") {
    setUpstream = true;
    args = args.slice(1);
  }
  if (args.some((arg) => arg.startsWith("-")) || args.length > 2) {
    throw new RemoteCommandError(403, "GIT_PUSH_OPTIONS_DENIED", "git push는 선택적으로 -u와 원격 이름, 현재 브랜치만 지정할 수 있습니다.");
  }
  let remote = args[0] || "";
  const requestedBranch = args[1] || currentBranch;
  if (requestedBranch !== currentBranch || !SAFE_BRANCH_NAME.test(requestedBranch) || requestedBranch.includes(":")) {
    throw new RemoteCommandError(403, "GIT_PUSH_BRANCH_DENIED", "현재 체크아웃된 브랜치만 같은 이름으로 push할 수 있습니다.");
  }
  if (!remote) {
    remote = await runGitRead(projectRoot, ["config", "--get", `branch.${currentBranch}.remote`]);
  }
  if (!SAFE_REMOTE_NAME.test(remote) || remote === ".") {
    throw new RemoteCommandError(403, "GIT_PUSH_REMOTE_DENIED", "설정된 Git 원격 이름만 사용할 수 있습니다.");
  }
  const configuredRemotes = (await runGitRead(projectRoot, ["remote"])).split(/\r?\n/).filter(Boolean);
  if (!configuredRemotes.includes(remote)) {
    throw new RemoteCommandError(404, "GIT_REMOTE_NOT_FOUND", "지정한 Git 원격을 찾을 수 없습니다.");
  }
  const remoteUrl = await runGitRead(projectRoot, ["remote", "get-url", "--push", remote]);
  const host = remoteHost(remoteUrl);
  if (!allowedHosts.has(host)) {
    throw new RemoteCommandError(403, "GIT_PUSH_HOST_DENIED", `${host} 원격은 LIFEHUB_GIT_PUSH_HOSTS 허용 목록에 없습니다.`);
  }
  const head = await runGitRead(projectRoot, ["rev-parse", "HEAD"]);
  const argv = ["git", "push", ...(setUpstream ? ["--set-upstream"] : []), remote, currentBranch];
  return { argv, gitPush: { remote, branch: currentBranch, head, host, remoteUrl, setUpstream } };
}

export async function prepareRemoteCommand(
  projectRoot: string,
  commandInput: unknown,
  allowedGitPushHosts: Set<string>,
): Promise<RemoteCommandPlan> {
  const command = typeof commandInput === "string" ? commandInput.trim() : "";
  if (!command || command.length > MAX_COMMAND_LENGTH) {
    throw new RemoteCommandError(400, "INVALID_REMOTE_COMMAND", `명령은 1~${MAX_COMMAND_LENGTH}자여야 합니다.`);
  }
  const root = await assertStableProjectRoot(projectRoot).catch(() => {
    throw new RemoteCommandError(409, "PROJECT_ROOT_CHANGED", "등록된 프로젝트 루트가 변경되어 명령을 실행할 수 없습니다.");
  });
  const tokens = tokenize(command);
  if (!tokens) {
    throw new RemoteCommandError(400, "COMPLEX_COMMAND_NOT_ALLOWED", "한 번에 한 명령만 입력하세요. 파이프, 리다이렉션, 변수 치환과 복합 shell 문법은 사용할 수 없습니다.");
  }
  validateExecutable(tokens);
  await validatePathArguments(root, tokens);
  const executable = executableName(tokens[0]!);
  let permission: RemoteCommandPermission = BUILD_COMMAND_PATTERN.test(executable) ? "build:execute" : "command:execute";
  let requiredPermissions: DevicePermission[] = READ_ONLY_EXECUTABLES.has(executable)
    ? ["command:execute"]
    : permission === "build:execute"
      ? ["build:execute"]
      : ["command:execute", "file:write"];
  let argv = tokens;
  let gitPush: GitPushPlan | undefined;
  if (executable === "git") {
    permission = "git";
    requiredPermissions = ["git"];
    const subcommand = validateGitCommand(tokens);
    if (subcommand === "push") {
      const push = await prepareGitPush(root, tokens, allowedGitPushHosts);
      argv = push.argv;
      gitPush = push.gitPush;
    }
  }
  return {
    command,
    argv,
    permission,
    requiredPermissions,
    risk: permission === "git" || permission === "command:execute" ? "high" : "medium",
    gitPush,
  };
}

export async function executeRemoteCommand(
  projectRoot: string,
  plan: RemoteCommandPlan,
  signal?: AbortSignal,
): Promise<RemoteCommandResult> {
  const root = await assertStableProjectRoot(projectRoot).catch(() => {
    throw new RemoteCommandError(409, "PROJECT_ROOT_CHANGED", "등록된 프로젝트 루트가 변경되어 명령을 실행할 수 없습니다.");
  });
  throwIfAborted(signal);
  await validatePathArguments(root, plan.argv);
  throwIfAborted(signal);
  if (plan.gitPush) {
    const [branch, head, remoteUrl] = await Promise.all([
      runGitRead(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
      runGitRead(root, ["rev-parse", "HEAD"]),
      runGitRead(root, ["remote", "get-url", "--push", plan.gitPush.remote]),
    ]);
    throwIfAborted(signal);
    if (branch !== plan.gitPush.branch || head !== plan.gitPush.head || remoteUrl !== plan.gitPush.remoteUrl) {
      throw new RemoteCommandError(409, "GIT_PUSH_STATE_CHANGED", "승인 후 브랜치, HEAD 또는 원격 설정이 바뀌어 push를 중단했습니다. 다시 확인하세요.");
    }
  }
  const timeoutMs = plan.permission === "build:execute" ? 180_000 : plan.gitPush ? 120_000 : 60_000;
  throwIfAborted(signal);
  return runProcess(plan.argv[0]!, plan.argv.slice(1), root, timeoutMs, signal);
}
