// src/app/api/config/route.ts
// GET /api/config — scoring weights, thresholds, system constants
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const SCORING_CONFIG = {
  // RAR formula constants
  rar: {
    clampMin: -10,
    clampMax: 10,
    scaleFactor: 1_000_000,
  },
  // Validation thresholds (position-sync filters)
  positionFilters: {
    minHoldSeconds: 60,
    minCollateral: 100,
    maxLeverage: 50,
  },
  // Consistency bonus
  consistency: {
    minTrades: 10,
    baseWinRate: 0.5,
    bonusScaleFactor: 200,
    bonusMultiplier: 500_000,
  },
  // Arena Rating
  arenaRating: {
    defaultAr: 400,
    maxAr: 9999,
    minAr: 0,
    inactivityPenalty: 50,
    promoBonusAr: 200,
    relgPenaltyAr: 150,
    promoCutoffPct: 0.1,
    relgCutoffPct: 0.1,
  },
  // Division AR thresholds
  divisions: {
    1: { name: "Grandmaster", minAr: 2000, weight: 3.0 },
    2: { name: "Diamond", minAr: 1600, weight: 2.5 },
    3: { name: "Platinum", minAr: 1200, weight: 2.0 },
    4: { name: "Gold", minAr: 800, weight: 1.5 },
    5: { name: "Silver", minAr: 0, weight: 1.0 },
  },
  // Squad rules
  squad: {
    maxMembers: 5,
    nameMinLength: 3,
    nameMaxLength: 32,
    lockDay: 3, // squads locked after day 3
    antisybilMinClosedPositions: 1,
  },
  // Synergy multipliers
  synergy: {
    questBonus: 0.05,
    streakBonus: 0.1,
    streakMinDays: 7,
  },
  // Prize pool split
  prizes: {
    individualPct: 0.6,
    squadPct: 0.2,
    participationPct: 0.1,
    achievementPct: 0.1,
  },
  // Season structure
  season: {
    lengthDays: 28,
    offseasonDays: 7,
  },
} as const;

export async function GET() {
  return NextResponse.json({ ok: true, config: SCORING_CONFIG });
}
