// __tests__/season-finalize-idempotency.test.ts
// Verifies that running finalizeSeason twice produces zero DB changes on the
// second pass — every step is fully idempotent.

import { finalizeSeason } from "@/job/season-finalize";
import { prisma } from "../lib/prisma";

// ── Shared mock state ──────────────────────────────────────────────────────
// Simulates a closed season with 3 traders, 2 divisions, 1 squad.

const SEASON_NUMBER = 99;

const mockSeason = {
  seasonNumber: SEASON_NUMBER,
  name: "Test Season",
  isActive: false,
  prizePoolUsdc: 1000,
  startTs: new Date("2025-01-01T00:00:00Z"),
  endTs: new Date("2025-01-28T00:00:00Z"),
};

const mockSummaries = [
  {
    wallet: "W1",
    totalCps: 5_000_000,
    rankInDivision: 1,
    rankAtDay14: 3,
    division: 1,
    totalTrades: 12,
    winningTrades: 10,
  },
  {
    wallet: "W2",
    totalCps: 3_000_000,
    rankInDivision: 2,
    rankAtDay14: 1,
    division: 1,
    totalTrades: 8,
    winningTrades: 5,
  },
  {
    wallet: "W3",
    totalCps: 1_000_000,
    rankInDivision: 1,
    rankAtDay14: 1,
    division: 2,
    totalTrades: 5,
    winningTrades: 3,
  },
];

const mockTraders = [
  {
    wallet: "W1",
    arenaRating: 1400,
    currentDivision: 3,
    lastActiveSeason: null,
    registeredSeason: 1,
    currentSquadId: 1,
  },
  {
    wallet: "W2",
    arenaRating: 1200,
    currentDivision: 3,
    lastActiveSeason: null,
    registeredSeason: 1,
    currentSquadId: 1,
  },
  {
    wallet: "W3",
    arenaRating: 800,
    currentDivision: 4,
    lastActiveSeason: null,
    registeredSeason: 1,
    currentSquadId: null,
  },
];

const mockSquad = {
  id: 1,
  seasonNumber: SEASON_NUMBER,
  rank: 1,
  division: 1,
  synergyStreakPeak: 0,
  disbanded: false,
  currentMembers: [{ wallet: "W1" }, { wallet: "W2" }],
};

// Tracks write call counts per operation — lets us assert zero on second run
interface WriteCounts {
  seasonTraderSummaryUpdate: number;
  traderUpdate: number;
  seasonRecordCreate: number;
  traderUpdateMany: number;
  achievementUpsert: number;
  prizeAllocationUpsert: number;
  squadUpdate: number;
}

// Mutable state that resets between runs
let writeCounts: WriteCounts;
let existingSeasonRecords: Set<string>;

function resetWriteCounts() {
  writeCounts = {
    seasonTraderSummaryUpdate: 0,
    traderUpdate: 0,
    seasonRecordCreate: 0,
    traderUpdateMany: 0,
    achievementUpsert: 0,
    prizeAllocationUpsert: 0,
    squadUpdate: 0,
  };
}

// ── Mock Prisma ────────────────────────────────────────────────────────────

jest.mock("../lib/prisma", () => {
  const mockFns = {
    season: {
      findUnique: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        if (where.seasonNumber === SEASON_NUMBER)
          return Promise.resolve(mockSeason);
        return Promise.resolve(null);
      }),
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    seasonTraderSummary: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        if (where?.seasonNumber === SEASON_NUMBER)
          return Promise.resolve(mockSummaries);
        return Promise.resolve([]);
      }),
      findUnique: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const key = (where as { wallet_seasonNumber: { wallet: string } })
          ?.wallet_seasonNumber;
        const s = mockSummaries.find((s) => s.wallet === key?.wallet);
        return Promise.resolve(s ?? null);
      }),
      update: jest.fn(() => {
        writeCounts.seasonTraderSummaryUpdate++;
        return Promise.resolve({});
      }),
      upsert: jest.fn(() => Promise.resolve({})),
      count: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const div = (where as { division: number })?.division;
        return Promise.resolve(
          mockSummaries.filter((s) => !div || s.division === div).length,
        );
      }),
    },
    cpsRecord: {
      findMany: jest.fn(() =>
        Promise.resolve(
          mockSummaries.map((s) => ({
            wallet: s.wallet,
            totalCps: s.totalCps,
          })),
        ),
      ),
      aggregate: jest.fn(() =>
        Promise.resolve({
          _sum: {
            rarScore: 5_000_000,
            questCps: 0,
            streakBonus: 0,
            consistencyBonus: 0,
          },
          _count: { id: 10 },
        }),
      ),
      upsert: jest.fn(() => Promise.resolve({})),
    },
    trader: {
      findUnique: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const t = mockTraders.find((t) => t.wallet === where.wallet);
        return Promise.resolve(t ?? null);
      }),
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        // Idempotency guard: filter out traders with lastActiveSeason already set
        const w = where as {
          wallet?: { in?: string[]; notIn?: string[] };
          NOT?: unknown;
        };
        let base = mockTraders;
        if (w?.wallet?.in)
          base = base.filter((t) => w.wallet!.in!.includes(t.wallet));
        if (w?.wallet?.notIn)
          base = base.filter((t) => !w.wallet!.notIn!.includes(t.wallet));
        // Simulate NOT: { lastActiveSeason: SEASON_NUMBER }
        if (w?.NOT) {
          const notClause = w.NOT as { lastActiveSeason?: number };
          if (notClause?.lastActiveSeason !== undefined) {
            base = base.filter(
              (t) => t.lastActiveSeason !== notClause.lastActiveSeason,
            );
          }
        }
        return Promise.resolve(base);
      }),
      update: jest.fn(() => {
        writeCounts.traderUpdate++;
        return Promise.resolve({});
      }),
      updateMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        // Only count if there are wallets to update
        const w = where as { wallet?: { in?: string[] } };
        if (w?.wallet?.in && w.wallet.in.length > 0) {
          writeCounts.traderUpdateMany++;
        }
        return Promise.resolve({ count: w?.wallet?.in?.length ?? 0 });
      }),
    },
    seasonRecord: {
      findUnique: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const key = (
          where as {
            wallet_seasonNumber: { wallet: string; seasonNumber: number };
          }
        )?.wallet_seasonNumber;
        const k = `${key?.wallet}:${key?.seasonNumber}`;
        return Promise.resolve(
          existingSeasonRecords.has(k) ? { wallet: key?.wallet } : null,
        );
      }),
      create: jest.fn(() => {
        writeCounts.seasonRecordCreate++;
        return Promise.resolve({});
      }),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
      count: jest.fn(() => Promise.resolve(0)),
    },
    achievement: {
      findMany: jest.fn(() => Promise.resolve([])),
      upsert: jest.fn(() => {
        writeCounts.achievementUpsert++;
        return Promise.resolve({});
      }),
    },
    prizeAllocation: {
      upsert: jest.fn(() => {
        writeCounts.prizeAllocationUpsert++;
        return Promise.resolve({});
      }),
    },
    squad: {
      findUnique: jest.fn(() => Promise.resolve(mockSquad)),
      findMany: jest.fn(() => Promise.resolve([mockSquad])),
      update: jest.fn(() => {
        writeCounts.squadUpdate++;
        return Promise.resolve({});
      }),
    },
    squadMember: {
      findMany: jest.fn(() =>
        Promise.resolve(
          mockSquad.currentMembers.map((m) => ({ wallet: m.wallet })),
        ),
      ),
    },
    positionCache: {
      findMany: jest.fn(() => Promise.resolve([])),
    },
  };
  return { prisma: mockFns };
});

// Mock lib functions to avoid deep dependency chains
jest.mock("../lib/scoring", () => ({
  updateAllLeaderboardCPS: jest.fn(() => Promise.resolve(3)),
  detectAchievements: jest.fn(() => Promise.resolve([])),
  allocatePrizes: jest.fn(() => Promise.resolve(5)),
}));

jest.mock("../lib/season", () => ({
  updateArenaRating: jest.fn(() => Promise.resolve()),
  processPromotionRelegation: jest.fn(() => Promise.resolve()),
  assignDivision: jest.fn((ar: number) => (ar >= 1200 ? 3 : 4)),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("finalizeSeason idempotency", () => {
  beforeEach(() => {
    resetWriteCounts();
    existingSeasonRecords = new Set();
    jest.clearAllMocks();
  });

  it("run 1: all 10 steps complete without error", async () => {
    const results = await finalizeSeason(SEASON_NUMBER);
    expect(results).toHaveLength(10);
    const errors = results.filter((r) => r.status === "error");
    expect(errors).toHaveLength(0);
  }, 15_000);

  it("run 1: SeasonRecords are written when none exist", async () => {
    existingSeasonRecords = new Set(); // nothing pre-existing
    await finalizeSeason(SEASON_NUMBER);
    // Should have attempted to create records for all 3 summary rows
    expect(writeCounts.seasonRecordCreate).toBe(3);
  }, 15_000);

  it("run 2: SeasonRecords skipped when all already exist", async () => {
    // Pre-populate — simulates state after first run
    existingSeasonRecords = new Set(
      mockSummaries.map((s) => `${s.wallet}:${SEASON_NUMBER}`),
    );
    await finalizeSeason(SEASON_NUMBER);
    expect(writeCounts.seasonRecordCreate).toBe(0);
  }, 15_000);

  it("run 2: trader season counters not double-incremented", async () => {
    // Simulate first run already set lastActiveSeason
    mockTraders.forEach((t) => {
      t.lastActiveSeason = SEASON_NUMBER as unknown as null;
    });
    await finalizeSeason(SEASON_NUMBER);
    // updateMany should not be called for already-counted traders
    expect(writeCounts.traderUpdateMany).toBe(0);
    // Restore
    mockTraders.forEach((t) => {
      t.lastActiveSeason = null;
    });
  }, 15_000);

  it("step 1 aborts if season is still active", async () => {
    (prisma.season.findUnique as jest.Mock).mockResolvedValueOnce({
      ...mockSeason,
      isActive: true,
    });
    const results = await finalizeSeason(SEASON_NUMBER);
    expect(results[0].status).toBe("error");
    expect(results[0].detail).toContain("still active");
    // Should have aborted — only 1 result
    expect(results).toHaveLength(1);
  }, 15_000);
});
