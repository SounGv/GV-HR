/**
 * Group messages through gv-api-gateway.
 *
 * The paid LINE bot (GV BOT) belongs to gv-ops-bot, and the gateway at
 * https://api.gvtools.dev lets other systems post with it without holding its
 * channel token: POST /v1/line/push with an `X-GV-Api-Key`. The gateway only
 * sends to destinations on its allow-list and only while its push switch is on.
 *
 * Used for HR group alerts only. Messages to single employees keep using this
 * app's own bot (LINE_CHANNEL_ACCESS_TOKEN), so those who linked LINE keep working.
 *
 * Settings (all in the host's environment, none in code):
 *   GV_GATEWAY_URL            e.g. https://api.gvtools.dev
 *   GV_GATEWAY_API_KEY        a client key with the `line:push` scope
 *   GV_GATEWAY_LINE_GROUP_IDS comma-separated LINE group ids, as the gateway's bot knows them
 * Leave any of them out and group alerts go the old way (this app's own bot).
 */
import { createHash } from "node:crypto";

export interface GatewayConfig {
  url: string;
  apiKey: string;
  groupIds: string[];
}

type Env = Record<string, string | undefined>;

/** A gateway address must be https, except a developer's own machine. */
function isAllowedUrl(url: string): boolean {
  if (url.startsWith("https://")) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
}

/**
 * The gateway settings, or null when they are not all set (then the old path is used).
 *
 * @param env Environment to read; defaults to the process environment.
 */
export function readGatewayConfig(env: Env = process.env): GatewayConfig | null {
  const url = env.GV_GATEWAY_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.GV_GATEWAY_API_KEY?.trim();
  if (!url || !apiKey) return null;
  if (!isAllowedUrl(url)) {
    console.error("[line-gateway] GV_GATEWAY_URL must start with https:// (ignored)");
    return null;
  }
  const groupIds = (env.GV_GATEWAY_LINE_GROUP_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return { url, apiKey, groupIds };
}

/** Same message to the same place always gets the same key, so a retry never posts twice. */
export function idempotencyKeyFor(to: string, text: string): string {
  return createHash("sha256").update(`${to}\n${text}`).digest("hex").slice(0, 40);
}

export interface GatewayPushResult {
  ok: boolean;
  status: number;
  /** Short reason for a failure, safe to log. */
  reason?: string;
}

/**
 * Posts one text message to one LINE destination through the gateway.
 * Never throws: a gateway or LINE problem must not fail the leave or OT request that triggered it.
 *
 * @param config Gateway settings from readGatewayConfig.
 * @param to LINE group id the gateway's bot knows.
 * @param text Message text.
 * @param timeoutMs Give up after this long.
 */
export async function pushViaGateway(config: GatewayConfig, to: string, text: string, timeoutMs = 8000): Promise<GatewayPushResult> {
  try {
    const res = await fetch(`${config.url}/v1/line/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GV-Api-Key": config.apiKey,
        "X-GV-Idempotency-Key": idempotencyKeyFor(to, text),
      },
      body: JSON.stringify({ to, text: text.slice(0, 4900) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { ok: true, status: res.status };
    // 503 means the gateway's push switch is off or the allow-list is empty; 403 means this client or group is not allowed.
    // Neither is fixed by retrying: someone has to change the gateway's settings.
    const reason =
      res.status === 503 ? "gateway push switch is off or allow-list is empty"
      : res.status === 403 ? "client has no line:push scope or the group is not on the allow-list"
      : res.status === 401 ? "gateway rejected the API key"
      : res.status === 429 ? "LINE monthly message limit reached"
      : `gateway answered ${res.status}`;
    console.error(`[line-gateway] push failed: ${reason}`);
    return { ok: false, status: res.status, reason };
  } catch (err) {
    console.error("[line-gateway] push error:", err instanceof Error ? err.message : err);
    return { ok: false, status: 0, reason: "could not reach the gateway" };
  }
}
