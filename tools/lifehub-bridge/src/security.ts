import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { DEVICE_PERMISSIONS, type DevicePermission } from "./types.js";

const SENSITIVE_ASSIGNMENT_PATTERN = /((?:access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|bearer|password|client[_-]?secret)\s*[:=]\s*)([^\s,;]+)/gi;
const OPENAI_KEY_PATTERN = /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g;
const DEVICE_TOKEN_PATTERN = /\blhb_device_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashSecret(secret: string, salt = ""): string {
  return createHash("sha256").update(salt).update("\0").update(secret).digest("hex");
}

export function derivePairingDeviceToken(serverSecret: string, requestSecret: string, requestId: string, deviceId: string): string {
  const digest = createHmac("sha256", serverSecret)
    .update("lifehub-device-token-v1\0")
    .update(requestSecret)
    .update("\0")
    .update(requestId)
    .update("\0")
    .update(deviceId)
    .digest("base64url");
  return `lhb_${deviceId}.${digest}`;
}

export function safeSecretEqual(candidate: string, expectedHash: string, salt = ""): boolean {
  const actual = Buffer.from(hashSecret(candidate, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1];
}

export function normalizePermissions(input: unknown, defaults: DevicePermission[] = ["chat"]): DevicePermission[] {
  if (!Array.isArray(input)) return [...defaults];
  const known = new Set<string>(DEVICE_PERMISSIONS);
  const values = input.filter((value): value is DevicePermission => typeof value === "string" && known.has(value));
  return [...new Set(["chat" as DevicePermission, ...values])];
}

export function containsPath(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !isAbsolute(value));
}

export function rejectUnsafeRelativePath(value: string): void {
  if (!value || value.includes("\0") || isAbsolute(value) || value.startsWith("~")) {
    throw new Error("상대 프로젝트 경로만 허용됩니다.");
  }
  const normalizedSeparators = value.replaceAll("\\", "/");
  if (normalizedSeparators.split("/").some((part) => part === "..")) {
    throw new Error("상위 경로 이동은 허용되지 않습니다.");
  }
}

export function publicProjectPath(root: string, candidate: string): string | undefined {
  const full = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
  if (!containsPath(root, full)) return undefined;
  const display = relative(root, full).split(sep).join("/");
  return display || ".";
}

export function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum)}\n…(truncated)`;
}

export function redactSensitiveText(value: string, maximum = 128 * 1024): string {
  return truncate(
    value
      .replace(SENSITIVE_ASSIGNMENT_PATTERN, "$1[REDACTED]")
      .replace(OPENAI_KEY_PATTERN, "[REDACTED_OPENAI_KEY]")
      .replace(DEVICE_TOKEN_PATTERN, "[REDACTED_DEVICE_TOKEN]")
      .replace(JWT_PATTERN, "[REDACTED_JWT]"),
    maximum,
  );
}
