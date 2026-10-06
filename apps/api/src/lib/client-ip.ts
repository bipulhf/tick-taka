import type { Context } from "hono";

const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

/** The socket's peer address, from the Bun server passed to fetch as Hono's env. */
function peerAddress(c: Context): string | undefined {
  const server = c.env as { requestIP?: (request: Request) => { address: string } | null } | null;
  if (typeof server?.requestIP !== "function") return undefined;
  return server.requestIP(c.req.raw)?.address || undefined;
}

/**
 * Who is calling, for rate limits. X-Real-IP is believed only when TRUST_PROXY is
 * on and the request came through a proxy on this machine (a loopback peer);
 * otherwise anyone could pick a fresh address per request by setting the header.
 */
export function clientIp(c: Context, trustProxy: boolean): string {
  const peer = peerAddress(c);
  const forwarded = c.req.header("x-real-ip")?.trim();
  if (trustProxy && forwarded && (peer === undefined || LOOPBACK.test(peer))) return forwarded;
  return peer ?? "unknown";
}
