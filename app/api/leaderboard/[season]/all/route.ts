// src/app/api/leaderboard/[season]/all/route.ts
// GET /api/leaderboard/:season/all — top 10 per division, always DB (no cache)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  { params }: { params: { season: string } },
) {
  const seasonNumber = parseInt(params.season, 10);
  if (!Number.isFinite(seasonNumber) || seasonNumber < 1)
    return NextResponse.json(
      { ok: false, error: "Invalid season" },
      { status: 400 },
    );

  // Fetch top 10 per division in parallel
  const divResults = await Promise.all(
    [1, 2, 3, 4, 5].map((division) =>
      prisma.seasonTraderSummary
        .findMany({
          where: { seasonNumber, division },
          orderBy: { rankInDivision: "asc" },
          take: 10,
          select: {
            wallet: true,
            totalCps: true,
            rankInDivision: true,
            winningTrades: true,
            totalTrades: true,
          },
        })
        .then((entries) => ({ division, entries })),
    ),
  );

  const divisions = divResults.map(({ division, entries }) => ({
    division,
    name: DIVISION_NAMES[division],
    entries: entries.map((e) => ({
      ...e,
      totalCps: Number(e.totalCps),
      winRate: e.totalTrades > 0 ? e.winningTrades / e.totalTrades : 0,
    })),
  }));

  return NextResponse.json({ ok: true, seasonNumber, divisions });
}
