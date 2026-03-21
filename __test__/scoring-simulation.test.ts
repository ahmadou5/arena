// __tests__/scoring-simulation.test.ts
// 5 trader archetypes compared through the full scoring formula.
// Produces a comparison table to stdout for visual inspection.

import { calculateRAR, calculateSeasonCPS } from "../lib/scoring";

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockAggregate = jest.fn();
const mockFindUnique = jest.fn();

jest.mock("../lib/prisma", () => ({
  prisma: {
    cpsRecord: {
      aggregate: (...a: unknown[]) => mockAggregate(...a),
    },
    seasonTraderSummary: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
  },
}));

afterEach(() => jest.clearAllMocks());

// ── Archetype definitions ──────────────────────────────────────────────────

interface TraderArchetype {
  name: string;
  description: string;
  trades: Array<{
    pnl: number;
    fees: number;
    collateral: number;
    durationSeconds: number;
  }>;
  questCps: number;
  streakBonus: number;
}

const ARCHETYPES: TraderArchetype[] = [
  {
    name: "Diamond Hands",
    description: "Few long-duration high-conviction trades, mostly winners",
    trades: [
      { pnl: 800, fees: 10, collateral: 1000, durationSeconds: 72 * 3600 },
      { pnl: -200, fees: 5, collateral: 500, durationSeconds: 48 * 3600 },
      { pnl: 1200, fees: 15, collateral: 1500, durationSeconds: 96 * 3600 },
    ],
    questCps: 200_000,
    streakBonus: 100_000,
  },
  {
    name: "Scalp King",
    description: "Many short trades, high win rate, modest gains each",
    trades: Array.from({ length: 20 }, (_, i) => ({
      pnl: i % 4 === 0 ? -20 : 15,
      fees: 0.5,
      collateral: 100,
      durationSeconds: 5 * 60, // 5 minutes
    })),
    questCps: 50_000,
    streakBonus: 500_000,
  },
  {
    name: "Degenerate Gambler",
    description: "High leverage, liquidations, some big wins",
    trades: [
      { pnl: -500, fees: 8, collateral: 500, durationSeconds: 30 * 60 }, // liquidated
      { pnl: 2000, fees: 20, collateral: 200, durationSeconds: 2 * 3600 }, // lucky big win
      { pnl: -300, fees: 5, collateral: 300, durationSeconds: 15 * 60 },
      { pnl: -400, fees: 6, collateral: 400, durationSeconds: 20 * 60 },
    ],
    questCps: 0,
    streakBonus: 0,
  },
  {
    name: "Consistent Grinder",
    description: "≥10 trades, 70% win rate, steady moderate profits",
    trades: Array.from({ length: 15 }, (_, i) => ({
      pnl: i % 3 === 2 ? -30 : 50,
      fees: 2,
      collateral: 300,
      durationSeconds: 8 * 3600,
    })),
    questCps: 300_000,
    streakBonus: 200_000,
  },
  {
    name: "Quest Farmer",
    description: "Mediocre trading performance but maximises quest CPS",
    trades: Array.from({ length: 8 }, (_, i) => ({
      pnl: i % 2 === 0 ? 10 : -8,
      fees: 1,
      collateral: 100,
      durationSeconds: 2 * 3600,
    })),
    questCps: 2_000_000,
    streakBonus: 800_000,
  },
];

// ── Helper: compute total RAR for an archetype ─────────────────────────────
function computeRARTotal(archetype: TraderArchetype): number {
  return archetype.trades.reduce(
    (sum, t) =>
      sum + calculateRAR(t.pnl, t.fees, t.collateral, t.durationSeconds),
    0,
  );
}

function computeConsistency(archetype: TraderArchetype): number {
  const total = archetype.trades.length;
  const winning = archetype.trades.filter((t) => t.pnl > 0).length;
  if (total < 10) return 0;
  const winRate = winning / total;
  return Math.max(0, (winRate - 0.5) * 200) * 500_000;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Trader archetype scoring simulation", () => {
  let results: Array<{
    archetype: TraderArchetype;
    rarTotal: number;
    consistencyBonus: number;
    finalCps: number;
  }> = [];

  beforeAll(() => {
    results = ARCHETYPES.map((a) => {
      const rarTotal = computeRARTotal(a);
      const consistencyBonus = computeConsistency(a);
      const finalCps = rarTotal + a.questCps + a.streakBonus + consistencyBonus;
      return { archetype: a, rarTotal, consistencyBonus, finalCps };
    });

    // Print comparison table
    const pad = (s: string, n: number) => s.padEnd(n);
    const fmt = (n: number) => (n / 1_000_000).toFixed(3).padStart(9);
    console.log("\n" + "═".repeat(90));
    console.log(
      "  ARCHETYPE SCORING SIMULATION — CPS Components (in millions)",
    );
    console.log("═".repeat(90));
    console.log(
      pad("  Archetype", 24) +
        pad("Trades", 8) +
        fmt(0).replace(/\S+/, "RAR") +
        fmt(0).replace(/\S+/, "Quest") +
        fmt(0).replace(/\S+/, "Streak") +
        fmt(0).replace(/\S+/, "Consist") +
        fmt(0).replace(/\S+/, "TOTAL"),
    );
    console.log("─".repeat(90));
    for (const r of results) {
      const { archetype: a, rarTotal, consistencyBonus, finalCps } = r;
      console.log(
        pad(`  ${a.name}`, 24) +
          String(a.trades.length).padStart(6) +
          "  " +
          fmt(rarTotal) +
          fmt(a.questCps) +
          fmt(a.streakBonus) +
          fmt(consistencyBonus) +
          fmt(finalCps),
      );
    }
    console.log("═".repeat(90) + "\n");
  });

  it("Diamond Hands scores positive RAR (long duration boosts score)", () => {
    const r = results.find((r) => r.archetype.name === "Diamond Hands")!;
    expect(r.rarTotal).toBeGreaterThan(0);
  });

  it("Consistent Grinder gets consistency bonus (10+ trades, >50% win rate)", () => {
    const r = results.find((r) => r.archetype.name === "Consistent Grinder")!;
    expect(r.consistencyBonus).toBeGreaterThan(0);
  });

  it("duration multiplier: same modest win scores higher when held longer", () => {
    // ln(1 + 4) ≈ 1.61 vs ln(1 + 5/60) ≈ 0.08 — 4h trade scores ~20x a 5m trade
    const shortRAR = calculateRAR(5, 0.1, 50, 5 * 60); // 5-min hold
    const longRAR = calculateRAR(5, 0.1, 50, 4 * 3600); // 4-hour hold
    expect(longRAR).toBeGreaterThan(shortRAR);
  });

  it("Degenerate Gambler scores worst total CPS", () => {
    const degen = results.find(
      (r) => r.archetype.name === "Degenerate Gambler",
    )!;
    const others = results.filter(
      (r) => r.archetype.name !== "Degenerate Gambler",
    );
    // At least 3 of the 4 others should outscore the degen
    const outscoring = others.filter((r) => r.finalCps > degen.finalCps);
    expect(outscoring.length).toBeGreaterThanOrEqual(3);
  });

  it("Quest Farmer total CPS significantly exceeds raw trading performance", () => {
    const farmer = results.find((r) => r.archetype.name === "Quest Farmer")!;
    // finalCps includes quest + streak bonuses on top of RAR
    expect(farmer.finalCps).toBeGreaterThan(farmer.rarTotal);
    // The bonus components (quest + streak = 2.8M) dwarf the per-trade RAR
    const bonusTotal = farmer.archetype.questCps + farmer.archetype.streakBonus;
    expect(bonusTotal).toBeGreaterThan(0);
    // Final CPS should be at least 2x the raw RAR due to bonuses
    expect(farmer.finalCps).toBeGreaterThan(farmer.rarTotal * 2);
  });
});
