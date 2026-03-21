// lib/adrena.ts — Adrena API client using native fetch (Next.js extended)

const BASE_URL = () => {
  const url = process.env.ADRENA_API_BASE;
  if (!url) throw new Error("ADRENA_API_BASE is not set");
  return url.replace(/\/$/, "");
};

const isDebug = () => process.env.LOG_LEVEL === "debug";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdrenaPosition {
  position_id: number;
  wallet: string;
  symbol: string;
  side: "long" | "short";
  status: "open" | "closed";
  entry_price: number | null;
  exit_price: number | null;
  entry_size: number | null;
  pnl: number | null;
  entry_leverage: number | null;
  entry_date: string | null;
  exit_date: string | null;
  fees: number | null;
  collateral_amount: number | null;
}

export interface PoolStats {
  total_value_locked: number;
  volume_24h: number;
  fees_24h: number;
  open_interest_long: number;
  open_interest_short: number;
}

export interface LiquidityInfo {
  alp_price: number;
  alp_supply: number;
  total_liquidity: number;
  utilization_rate: number;
}

export interface APRInfo {
  type: string;
  lock_period: number;
  current_apr: number;
  base_apr: number;
  bonus_apr: number;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class AdrenaAPIError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
    this.name = "AdrenaAPIError";
  }
}

// ── Core fetch with retry + timeout ──────────────────────────────────────────

export async function fetchWithRetry(
  url: string,
  retries = 1,
): Promise<Response | null> {
  const attempt = async (): Promise<Response | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const start = Date.now();

    try {
      if (isDebug()) console.debug(`[adrena] → GET ${url}`);
      const res = await fetch(url, { signal: controller.signal });
      if (isDebug())
        console.debug(
          `[adrena] ← ${res.status} ${url} (${Date.now() - start}ms)`,
        );

      if (res.status === 429) {
        console.warn(`[adrena] 429 rate-limited: ${url}`);
        return null;
      }

      return res;
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        throw new AdrenaAPIError(0, `Request timed out: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    if (retries > 0) {
      console.warn(`[adrena] Network error, retrying in 2s… (${url})`);
      await new Promise((r) => setTimeout(r, 2000));
      return fetchWithRetry(url, retries - 1);
    }
    throw err;
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const base = BASE_URL();
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetchWithRetry(url.toString());

  if (res === null) {
    throw new AdrenaAPIError(429, `Rate limited on ${path}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AdrenaAPIError(
      res.status,
      `Adrena API error ${res.status} on ${path}: ${body}`,
    );
  }

  return res.json() as Promise<T>;
}

// ── Public API functions ──────────────────────────────────────────────────────

/**
 * Fetch all positions for a wallet. Paginates automatically up to `limit`.
 */
export async function getPositions(
  wallet: string,
  limit = 500,
): Promise<AdrenaPosition[]> {
  const data = await apiGet<{ positions: AdrenaPosition[] } | AdrenaPosition[]>(
    "/positions",
    { wallet, limit },
  );
  // Handle both { positions: [...] } envelope and bare array
  return Array.isArray(data) ? data : (data.positions ?? []);
}

/**
 * Fetch global pool statistics (TVL, volume, fees, OI).
 */
export async function getPoolStats(): Promise<PoolStats> {
  return apiGet<PoolStats>("/pool/stats");
}

/**
 * Fetch current liquidity info (ALP price, supply, utilization).
 */
export async function getLiquidityInfo(): Promise<LiquidityInfo> {
  return apiGet<LiquidityInfo>("/liquidity");
}

/**
 * Fetch APR for a given product type and lock period.
 * @param type  'alp' | 'adx' (default: 'alp')
 * @param lock  lock period in days (default: 0 = unlocked)
 */
export async function getAPR(type = "alp", lock = 0): Promise<APRInfo> {
  return apiGet<APRInfo>("/apr", { type, lock });
}
