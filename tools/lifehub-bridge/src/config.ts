import { hostname } from "node:os";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface BridgeConfig {
  host: string;
  port: number;
  userHome: string;
  codexHome: string;
  dataDir: string;
  stateFile: string;
  adminTokenFile: string;
  allowedOrigins: Set<string>;
  bodyLimitBytes: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  pairCodeTtlMs: number;
  pairRequestTtlMs: number;
  bridgeName: string;
  lanEnabled: boolean;
  remoteCommandsEnabled: boolean;
  gitPushHosts: Set<string>;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function integerEnv(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const host = env.LIFEHUB_BRIDGE_HOST?.trim() || "127.0.0.1";
  const lanEnabled = env.LIFEHUB_BRIDGE_LAN === "1";
  if (!LOOPBACK_HOSTS.has(host) && !lanEnabled) {
    throw new Error("LAN 바인딩은 LIFEHUB_BRIDGE_LAN=1로 명시적으로 활성화해야 합니다.");
  }

  const userHome = resolve(env.HOME || homedir());
  const codexHome = resolve(env.CODEX_HOME || join(userHome, ".codex"));
  const dataDir = resolve(env.LIFEHUB_BRIDGE_DATA_DIR || join(userHome, ".lifehub-bridge"));
  const origins = (env.LIFEHUB_BRIDGE_ALLOWED_ORIGINS || "capacitor://localhost,https://appassets.androidplatform.net")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const gitPushHosts = (env.LIFEHUB_GIT_PUSH_HOSTS || "github.com")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host));

  return {
    host,
    port: integerEnv(env.LIFEHUB_BRIDGE_PORT, 4317, 1, 65_535),
    userHome,
    codexHome,
    dataDir,
    stateFile: join(dataDir, "state.json"),
    adminTokenFile: join(dataDir, "admin-token"),
    allowedOrigins: new Set(origins),
    bodyLimitBytes: integerEnv(env.LIFEHUB_BRIDGE_BODY_LIMIT, 64 * 1024, 1024, 1024 * 1024),
    rateLimitWindowMs: integerEnv(env.LIFEHUB_BRIDGE_RATE_WINDOW_MS, 60_000, 1_000, 60 * 60_000),
    rateLimitMax: integerEnv(env.LIFEHUB_BRIDGE_RATE_MAX, 120, 1, 10_000),
    pairCodeTtlMs: integerEnv(env.LIFEHUB_PAIR_CODE_TTL_MS, 5 * 60_000, 1_000, 15 * 60_000),
    pairRequestTtlMs: integerEnv(env.LIFEHUB_PAIR_REQUEST_TTL_MS, 10 * 60_000, 1_000, 30 * 60_000),
    bridgeName: env.LIFEHUB_BRIDGE_NAME?.trim() || hostname(),
    lanEnabled,
    remoteCommandsEnabled: env.LIFEHUB_BRIDGE_REMOTE_COMMANDS === "1",
    gitPushHosts: new Set(gitPushHosts),
  };
}
