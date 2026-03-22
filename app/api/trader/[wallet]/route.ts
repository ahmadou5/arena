// GET /api/trader/:wallet — public trader profile
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

const DIVISION_NAMES: Record<number, string> = {
  1: "Grandmaster",
  2: "Diamond",
  3: "Platinum",
  4: "Gold",
  5: "Silver",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  if (!wallet)
    return NextResponse.json(
      { ok: false, error: "Wallet required" },
      { status: 400 },
    );

  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: {
      wallet: true,
      arenaRating: true,
      currentDivision: true,
      registeredSeason: true,
      totalSeasonsParticipated: true,
      lastActiveSeason: true,
      currentSquadId: true,
      createdAt: true,
      currentSquad: {
        select: {
          id: true,
          name: true,
          division: true,
          squadScore: true,
          rank: true,
          isLocked: true,
          synergyQuestWeeks: true,
          synergyStreakPeak: true,
          _count: { select: { currentMembers: true } },
        },
      },
      streak: { select: { streakDays: true, lastStreakDate: true } },
      achievements: {
        orderBy: { earnedAt: "desc" },
        select: { achievementKey: true, seasonNumber: true, earnedAt: true },
      },
    },
  });

  if (!trader)
    return NextResponse.json(
      { ok: false, error: "Trader not found" },
      { status: 404 },
    );

  // Season history — last 10 SeasonRecords
  const seasonHistory = await prisma.seasonRecord.findMany({
    where: { wallet },
    orderBy: { seasonNumber: "desc" },
    take: 10,
    select: {
      seasonNumber: true,
      finalCps: true,
      finalRank: true,
      division: true,
      arStart: true,
      arEnd: true,
      promoted: true,
      relegated: true,
      totalTrades: true,
      winningTrades: true,
    },
  });

  // AR history: derive from SeasonRecords arStart/arEnd chain
  const arHistory = seasonHistory
    .filter((r) => r.arEnd !== null)
    .map((r) => ({ season: r.seasonNumber, ar: r.arEnd, division: r.division }))
    .reverse();

  // Active season summary
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: { seasonNumber: true, name: true },
  });
  let currentSeason: Record<string, unknown> | null = null;
  if (activeSeason) {
    const summary = await prisma.seasonTraderSummary.findUnique({
      where: {
        wallet_seasonNumber: {
          wallet,
          seasonNumber: activeSeason.seasonNumber,
        },
      },
      select: {
        totalCps: true,
        rankInDivision: true,
        division: true,
        totalTrades: true,
        winningTrades: true,
      },
    });
    currentSeason = {
      seasonNumber: activeSeason.seasonNumber,
      name: activeSeason.name,
      // Always include these fields — UI depends on them being present, even as 0
      totalCps: summary ? Number(summary.totalCps) : 0,
      rankInDivision: summary?.rankInDivision ?? null,
      totalTrades: summary?.totalTrades ?? 0,
      winRate:
        summary && summary.totalTrades > 0
          ? summary.winningTrades / summary.totalTrades
          : 0,
    };
  }

  return NextResponse.json({
    ok: true,
    wallet: trader.wallet,
    arenaRating: trader.arenaRating,
    division: trader.currentDivision,
    divisionName: DIVISION_NAMES[trader.currentDivision] ?? "Silver",
    createdAt: trader.createdAt,
    totalSeasonsParticipated: trader.totalSeasonsParticipated,
    lastActiveSeason: trader.lastActiveSeason,
    currentSeason,
    seasonHistory: seasonHistory.map((r) => ({
      ...r,
      finalCps: r.finalCps !== null ? Number(r.finalCps) : null,
    })),
    achievements: trader.achievements,
    arHistory,
    squad: trader.currentSquad
      ? {
          ...trader.currentSquad,
          squadScore: Number(trader.currentSquad.squadScore),
          memberCount: trader.currentSquad._count.currentMembers,
        }
      : null,
    streak: trader.streak,
  });
}
