// src/app/api/leaderboard/[season]/mid-season-event/route.ts
// GET /api/leaderboard/:season/mid-season-event
// Derives mid-season event standings from seasonDay.
// Day 1–7:   "Early Bird" — most trades
// Day 8–14:  "Momentum"   — biggest totalCps gain since day 8
// Day 15–21: "Consistency"— highest win rate (min 5 trades)
// Day 22+:   "Sprint"     — ranked by rankInDivision (final push)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSeasonDay } from "@/lib/season";

export const dynamic = "force-dynamic";

type EventPhase =
  | "early_bird"
  | "momentum"
  | "consistency"
  | "sprint"
  | "offseason";

function derivePhase(day: number): EventPhase {
  if (day <= 0) return "offseason";
  if (day <= 7) return "early_bird";
  if (day <= 14) return "momentum";
  if (day <= 21) return "consistency";
  return "sprint";
}

const PHASE_LABELS: Record<EventPhase, string> = {
  early_bird: "Early Bird — Most Trades",
  momentum: "Momentum — Fastest Rising",
  consistency: "Consistency — Highest Win Rate",
  sprint: "Sprint — Final Push",
  offseason: "Offseason",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ season: string }> },
) {
  const { season: seasonParam } = await params;
  const seasonNumber = parseInt(seasonParam, 10);
  if (!Number.isFinite(seasonNumber) || seasonNumber < 1)
    return NextResponse.json(
      { ok: false, error: "Invalid season" },
      { status: 400 },
    );

  const season = await prisma.season.findUnique({
    where: { seasonNumber },
    select: { startTs: true, isActive: true, name: true },
  });
  if (!season)
    return NextResponse.json(
      { ok: false, error: "Season not found" },
      { status: 404 },
    );

  const day = season.isActive
    ? getSeasonDay(season as Parameters<typeof getSeasonDay>[0])
    : 28;
  const phase = derivePhase(day);

  let standings: Array<Record<string, unknown>> = [];

  if (phase === "early_bird") {
    // Most total trades
    const rows = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber },
      orderBy: { totalTrades: "desc" },
      take: 50,
      select: {
        wallet: true,
        totalTrades: true,
        winningTrades: true,
        division: true,
      },
    });
    standings = rows.map((r, i) => ({ rank: i + 1, ...r }));
  } else if (phase === "momentum") {
    // rankAtDay14 vs current rankInDivision — biggest improvement
    const rows = await prisma.seasonTraderSummary.findMany({
      where: {
        seasonNumber,
        rankAtDay14: { not: null },
        rankInDivision: { not: null },
      },
      select: {
        wallet: true,
        rankAtDay14: true,
        rankInDivision: true,
        totalCps: true,
        division: true,
      },
    });
    const scored = rows
      .map((r) => ({
        ...r,
        improvement: (r.rankAtDay14 ?? 99999) - (r.rankInDivision ?? 99999),
      }))
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 50);
    standings = scored.map((r, i) => ({
      rank: i + 1,
      ...r,
      totalCps: Number(r.totalCps),
    }));
  } else if (phase === "consistency") {
    // Win rate, minimum 5 trades
    const rows = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber, totalTrades: { gte: 5 } },
      select: {
        wallet: true,
        winningTrades: true,
        totalTrades: true,
        totalCps: true,
        division: true,
      },
    });
    const scored = rows
      .map((r) => ({ ...r, winRate: r.winningTrades / r.totalTrades }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 50);
    standings = scored.map((r, i) => ({
      rank: i + 1,
      ...r,
      totalCps: Number(r.totalCps),
    }));
  } else {
    // Sprint / offseason: current division rank
    const rows = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber },
      orderBy: [{ division: "asc" }, { rankInDivision: "asc" }],
      take: 50,
      select: {
        wallet: true,
        rankInDivision: true,
        totalCps: true,
        division: true,
      },
    });
    standings = rows.map((r, i) => ({
      rank: i + 1,
      ...r,
      totalCps: Number(r.totalCps),
    }));
  }

  return NextResponse.json({
    ok: true,
    seasonNumber,
    seasonDay: day,
    phase,
    phaseLabel: PHASE_LABELS[phase],
    standings,
  });
}
