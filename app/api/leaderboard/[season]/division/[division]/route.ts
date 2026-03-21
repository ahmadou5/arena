// src/app/api/leaderboard/[season]/division/[division]/route.ts
// GET /api/leaderboard/:season/division/:division?page&limit&wallet
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
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  req: NextRequest,
  { params }: { params: { season: string; division: string } },
) {
  const seasonNumber = parseInt(params.season, 10);
  const division = parseInt(params.division, 10);

  if (!Number.isFinite(seasonNumber) || seasonNumber < 1)
    return NextResponse.json(
      { ok: false, error: "Invalid season" },
      { status: 400 },
    );
  if (division < 1 || division > 5)
    return NextResponse.json(
      { ok: false, error: "Division must be 1–5" },
      { status: 400 },
    );

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(sp.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    ),
  );
  const wallet = sp.get("wallet") ?? null;
  const skip = (page - 1) * limit;

  const [entries, totalTraders] = await Promise.all([
    prisma.seasonTraderSummary.findMany({
      where: { seasonNumber, division },
      orderBy: { rankInDivision: "asc" },
      skip,
      take: limit,
      select: {
        wallet: true,
        totalCps: true,
        rankInDivision: true,
        rankAtDay14: true,
        winningTrades: true,
        totalTrades: true,
      },
    }),
    prisma.seasonTraderSummary.count({ where: { seasonNumber, division } }),
  ]);

  // myRank: always fetch if wallet param provided, regardless of current page
  let myRank: number | null = null;
  if (wallet) {
    const mine = await prisma.seasonTraderSummary.findUnique({
      where: { wallet_seasonNumber: { wallet, seasonNumber } },
      select: { rankInDivision: true, division: true },
    });
    if (mine?.division === division) myRank = mine.rankInDivision ?? null;
  }

  return NextResponse.json({
    ok: true,
    leaderboard: entries.map((e) => ({
      ...e,
      totalCps: Number(e.totalCps),
      winRate: e.totalTrades > 0 ? e.winningTrades / e.totalTrades : 0,
    })),
    myRank,
    totalTraders,
    page,
    totalPages: Math.ceil(totalTraders / limit),
    division,
    divisionName: DIVISION_NAMES[division],
    seasonNumber,
  });
}
