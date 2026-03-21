// __tests__/scoring.test.ts — 15 unit tests for lib/scoring.ts

import {
  calculateRAR,
  calculateSeasonCPS,
  scorePosition,
  updateAllLeaderboardCPS,
} from "../lib/scoring";
import type { AdrenaPosition } from "../lib/adrena";

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockUpsert = jest.fn().mockResolvedValue({});
const mockAggregate = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});

jest.mock("../lib/prisma", () => ({
  prisma: {
    cpsRecord: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      aggregate: (...a: unknown[]) => mockAggregate(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
    seasonTraderSummary: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
  },
}));

afterEach(() => jest.clearAllMocks());

// ── Fixtures ───────────────────────────────────────────────────────────────
const BASE_POS: AdrenaPosition = {
  position_id: 42,
  wallet: "TestWallet111111111111111111111111111111111",
  symbol: "SOL/USD",
  side: "long",
  status: "closed",
  entry_price: 150,
  exit_price: 165,
  entry_size: 1000,
  pnl: 150,
  entry_leverage: 5,
  entry_date: "2025-01-01T00:00:00Z",
  exit_date: "2025-01-01T04:00:00Z", // 4 hours
  fees: 2,
  collateral_amount: 200,
};

// ════════════════════════════════════════════════════════════════════════════
// calculateRAR — 8 tests
// ════════════════════════════════════════════════════════════════════════════

describe("calculateRAR", () => {
  it("returns positive score for profitable trade", () => {
    const score = calculateRAR(100, 2, 200, 3600);
    expect(score).toBeGreaterThan(0);
  });

  it("returns negative score for losing trade", () => {
    const score = calculateRAR(-50, 2, 200, 3600);
    expect(score).toBeLessThan(0);
  });

  it("clamps to +10_000_000 for extreme winner", () => {
    const score = calculateRAR(1_000_000, 0.01, 1, 86400);
    expect(score).toBe(10_000_000);
  });

  it("clamps to -10_000_000 for extreme loser", () => {
    const score = calculateRAR(-1_000_000, 0.01, 1, 86400);
    expect(score).toBe(-10_000_000);
  });

  it("longer duration increases score for same pnl", () => {
    const short = calculateRAR(100, 2, 200, 3600); // 1 hour
    const long = calculateRAR(100, 2, 200, 86400); // 24 hours
    expect(long).toBeGreaterThan(short);
  });

  it("zero-second duration produces zero log factor", () => {
    // ln(1+0) = 0, so rar = (pnl/floor) * 0 = 0
    const score = calculateRAR(100, 2, 200, 0);
    expect(score).toBe(0);
  });

  it("drawdownFloor never goes below 0.01 (prevents division by zero)", () => {
    // All zero inputs — floor = 0.01
    expect(() => calculateRAR(0, 0, 0, 3600)).not.toThrow();
    const score = calculateRAR(0, 0, 0, 3600);
    expect(Number.isFinite(score)).toBe(true);
  });

  it("high fees reduce effective RAR (larger drawdownFloor)", () => {
    const lowFee = calculateRAR(100, 1, 200, 3600);
    const highFee = calculateRAR(100, 999, 200, 3600);
    expect(lowFee).toBeGreaterThan(highFee);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// scorePosition — 4 tests
// ════════════════════════════════════════════════════════════════════════════

describe("scorePosition", () => {
  it("calls cpsRecord.upsert with correct positionId", async () => {
    await scorePosition(BASE_POS, 1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.where.positionId).toBe(42);
  });

  it("computes positive rarScore for winning trade", async () => {
    await scorePosition(BASE_POS, 1);
    const call = mockUpsert.mock.calls[0][0];
    expect(Number(call.create.rarScore)).toBeGreaterThan(0);
  });

  it("handles liquidation: pnl = -collateralAmount when exit_price null", async () => {
    const liquidated: AdrenaPosition = {
      ...BASE_POS,
      pnl: null,
      exit_price: null,
      status: "closed",
      collateral_amount: 200,
    };
    await scorePosition(liquidated, 1);
    const call = mockUpsert.mock.calls[0][0];
    // RAR should be negative (full collateral loss)
    expect(Number(call.create.rarScore)).toBeLessThan(0);
  });

  it("increments winningTrades when pnl > 0", async () => {
    await scorePosition(BASE_POS, 1);
    // Second upsert call is for seasonTraderSummary
    const summaryCall = mockUpsert.mock.calls[1][0];
    expect(summaryCall.update.winningTrades).toEqual({ increment: 1 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// calculateSeasonCPS — 3 tests
// ════════════════════════════════════════════════════════════════════════════

describe("calculateSeasonCPS", () => {
  it("returns zero breakdown when no records", async () => {
    mockAggregate.mockResolvedValueOnce({ _sum: {}, _count: { id: 0 } });
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await calculateSeasonCPS("wallet", 1);
    expect(result.finalCps).toBe(0);
    expect(result.consistencyComponent).toBe(0);
  });

  it("adds consistency bonus when winRate > 50% with 10+ trades", async () => {
    mockAggregate.mockResolvedValueOnce({
      _sum: {
        rarScore: 1_000_000,
        questCps: 0,
        streakBonus: 0,
        consistencyBonus: 0,
      },
      _count: { id: 10 },
    });
    mockFindUnique.mockResolvedValueOnce({ totalTrades: 10, winningTrades: 8 });
    const result = await calculateSeasonCPS("wallet", 1);
    expect(result.consistencyComponent).toBeGreaterThan(0);
    expect(result.finalCps).toBeGreaterThan(1_000_000);
  });

  it("no consistency bonus with fewer than 10 trades", async () => {
    mockAggregate.mockResolvedValueOnce({
      _sum: {
        rarScore: 500_000,
        questCps: 0,
        streakBonus: 0,
        consistencyBonus: 0,
      },
      _count: { id: 3 },
    });
    mockFindUnique.mockResolvedValueOnce({ totalTrades: 3, winningTrades: 3 });
    const result = await calculateSeasonCPS("wallet", 1);
    expect(result.consistencyComponent).toBe(0);
  });
});
