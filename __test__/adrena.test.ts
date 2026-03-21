// __tests__/adrena.test.ts

import {
  getPositions,
  getPoolStats,
  getLiquidityInfo,
  getAPR,
  fetchWithRetry,
  AdrenaAPIError,
  type AdrenaPosition,
  type PoolStats,
  type LiquidityInfo,
  type APRInfo,
} from "../lib/adrena";

// ── Env setup ──────────────────────────────────────────────────────────────

const BASE = "https://datapi.adrena.trade";
beforeAll(() => {
  process.env.ADRENA_API_BASE = BASE;
});
afterAll(() => {
  delete process.env.ADRENA_API_BASE;
});

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetch(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
) {
  return jest.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }),
  );
}

function mockFetchRaw(response: Partial<Response>) {
  return jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(response as Response);
}

afterEach(() => jest.restoreAllMocks());

// ── fetchWithRetry ─────────────────────────────────────────────────────────

describe("fetchWithRetry", () => {
  it("returns response on 200", async () => {
    mockFetch(200, { ok: true });
    const res = await fetchWithRetry(`${BASE}/test`);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
  });

  it("returns null and logs warning on 429", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(429, { error: "rate limited" });
    const res = await fetchWithRetry(`${BASE}/test`);
    expect(res).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("429"));
  });

  it("retries once on network error then succeeds", async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // First call throws network error, second succeeds
    jest
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const promise = fetchWithRetry(`${BASE}/test`, 1);
    // Advance past the 2s retry delay
    await jest.runAllTimersAsync();
    const res = await promise;

    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Network error"),
    );
    jest.useRealTimers();
  });

  it("throws after exhausting retries", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => {});

    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const promise = fetchWithRetry(`${BASE}/test`, 1);
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow("Failed to fetch");
    jest.useRealTimers();
  });

  it("throws AdrenaAPIError on AbortController timeout", async () => {
    jest.spyOn(global, "fetch").mockImplementationOnce((_url, opts) => {
      // Simulate abort
      opts?.signal?.dispatchEvent(new Event("abort"));
      const err = new DOMException("The operation was aborted.", "AbortError");
      return Promise.reject(err);
    });

    await expect(fetchWithRetry(`${BASE}/test`, 0)).rejects.toThrow(
      AdrenaAPIError,
    );
  });
});

// ── getPositions ───────────────────────────────────────────────────────────

describe("getPositions", () => {
  const WALLET = "Test1111111111111111111111111111111111111111";

  const POSITION: AdrenaPosition = {
    position_id: 1,
    wallet: WALLET,
    symbol: "SOL/USD",
    side: "long",
    status: "open",
    entry_price: 150.5,
    exit_price: null,
    entry_size: 1000,
    pnl: 42.0,
    entry_leverage: 5,
    entry_date: "2025-01-01T00:00:00Z",
    exit_date: null,
    fees: 2.5,
    collateral_amount: 200,
  };

  it("returns positions from envelope { positions: [...] }", async () => {
    mockFetch(200, { positions: [POSITION] });
    const result = await getPositions(WALLET);
    expect(result).toHaveLength(1);
    expect(result[0].position_id).toBe(1);
    expect(result[0].side).toBe("long");
  });

  it("returns positions from bare array response", async () => {
    mockFetch(200, [POSITION]);
    const result = await getPositions(WALLET);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("SOL/USD");
  });

  it("returns empty array when positions key is missing", async () => {
    mockFetch(200, {});
    const result = await getPositions(WALLET);
    expect(result).toEqual([]);
  });

  it("sends wallet and limit as query params", async () => {
    const spy = mockFetch(200, { positions: [] });
    await getPositions(WALLET, 100);
    const calledUrl = spy.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`wallet=${WALLET}`);
    expect(calledUrl).toContain("limit=100");
  });

  it("throws AdrenaAPIError on 429", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(429, {});
    await expect(getPositions(WALLET)).rejects.toThrow(AdrenaAPIError);
    await expect(getPositions(WALLET)).rejects.toMatchObject({ status: 429 });
  });

  it("throws AdrenaAPIError on 500", async () => {
    mockFetch(500, { error: "internal server error" });
    await expect(getPositions(WALLET)).rejects.toThrow(AdrenaAPIError);
  });
});

// ── getPoolStats ───────────────────────────────────────────────────────────

describe("getPoolStats", () => {
  const STATS: PoolStats = {
    total_value_locked: 5_000_000,
    volume_24h: 1_200_000,
    fees_24h: 3_600,
    open_interest_long: 800_000,
    open_interest_short: 600_000,
  };

  it("returns pool stats", async () => {
    mockFetch(200, STATS);
    const result = await getPoolStats();
    expect(result.total_value_locked).toBe(5_000_000);
    expect(result.fees_24h).toBe(3_600);
  });

  it("calls /pool/stats endpoint", async () => {
    const spy = mockFetch(200, STATS);
    await getPoolStats();
    expect(spy.mock.calls[0][0] as string).toContain("/pool/stats");
  });

  it("throws on non-200 response", async () => {
    mockFetch(503, { error: "unavailable" });
    await expect(getPoolStats()).rejects.toThrow(AdrenaAPIError);
  });
});

// ── getLiquidityInfo ───────────────────────────────────────────────────────

describe("getLiquidityInfo", () => {
  const LIQUIDITY: LiquidityInfo = {
    alp_price: 1.042,
    alp_supply: 10_000_000,
    total_liquidity: 10_420_000,
    utilization_rate: 0.68,
  };

  it("returns liquidity info", async () => {
    mockFetch(200, LIQUIDITY);
    const result = await getLiquidityInfo();
    expect(result.alp_price).toBe(1.042);
    expect(result.utilization_rate).toBe(0.68);
  });

  it("calls /liquidity endpoint", async () => {
    const spy = mockFetch(200, LIQUIDITY);
    await getLiquidityInfo();
    expect(spy.mock.calls[0][0] as string).toContain("/liquidity");
  });

  it("throws AdrenaAPIError on 429", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(429, {});
    await expect(getLiquidityInfo()).rejects.toThrow(AdrenaAPIError);
  });
});

// ── getAPR ─────────────────────────────────────────────────────────────────

describe("getAPR", () => {
  const APR_DATA: APRInfo = {
    type: "alp",
    lock_period: 0,
    current_apr: 0.142,
    base_apr: 0.12,
    bonus_apr: 0.022,
  };

  it("returns APR with default params", async () => {
    const spy = mockFetch(200, APR_DATA);
    const result = await getAPR();
    expect(result.current_apr).toBe(0.142);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("type=alp");
    expect(url).toContain("lock=0");
  });

  it("sends custom type and lock period", async () => {
    const spy = mockFetch(200, { ...APR_DATA, type: "adx", lock_period: 90 });
    const result = await getAPR("adx", 90);
    expect(result.type).toBe("adx");
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("type=adx");
    expect(url).toContain("lock=90");
  });

  it("calls /apr endpoint", async () => {
    const spy = mockFetch(200, APR_DATA);
    await getAPR();
    expect(spy.mock.calls[0][0] as string).toContain("/apr");
  });

  it("throws AdrenaAPIError on 404", async () => {
    mockFetch(404, { error: "not found" });
    await expect(getAPR("unknown")).rejects.toThrow(AdrenaAPIError);
  });
});

// ── LOG_LEVEL=debug ────────────────────────────────────────────────────────

describe("debug logging", () => {
  it("logs request URL and response time when LOG_LEVEL=debug", async () => {
    process.env.LOG_LEVEL = "debug";
    const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
    mockFetch(200, { positions: [] });

    await getPositions("TestWallet");

    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining("[adrena]"));
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining("ms)"));

    delete process.env.LOG_LEVEL;
  });
});
