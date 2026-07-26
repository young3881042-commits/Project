export interface LocalBrowserRequestContext {
  remoteAddress: string | undefined;
  host: string | undefined;
  origin: string | undefined;
  hasForwardedHeaders?: boolean;
}

const LOOPBACK_HOST_HEADER = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$/i;

export function isLoopbackSocketAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.startsWith("::ffff:") ? address.slice(7) : address;
  return normalized === "127.0.0.1" || normalized === "::1";
}

export function isLoopbackHostHeader(value: string | undefined): boolean {
  if (!value || value !== value.trim()) return false;
  const match = LOOPBACK_HOST_HEADER.exec(value);
  if (!match) return false;
  if (!match[1]) return true;
  const port = Number.parseInt(match[1], 10);
  return port >= 1 && port <= 65_535;
}

export function isLoopbackBrowserOrigin(value: string | undefined): boolean {
  if (!value || value !== value.trim() || value.includes(",")) return false;
  try {
    const origin = new URL(value);
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return false;
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return false;
    const hostname = origin.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function allowsLocalBrowserConnection(context: LocalBrowserRequestContext): boolean {
  return !context.hasForwardedHeaders
    && isLoopbackSocketAddress(context.remoteAddress)
    && isLoopbackHostHeader(context.host)
    && isLoopbackBrowserOrigin(context.origin);
}
