// src/app/api/trader/[wallet]/cps-breakdown/route.ts
// GET /api/trader/:wallet/cps-breakdown — JWT, own wallet only
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateSeasonCPS } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet: paramWallet } = await params;
  let authWallet: string;
  try {
    authWallet = requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  if (authWallet !== paramWallet)
    return NextResponse.json(
      { ok: false, error: "Forbidden — own wallet only" },
      { status: 403 },
    );

  const sp = req.nextUrl.searchParams;
  const seasonParam = sp.get("season");

  // Default to active season
  let seasonNumber: number;
  if (seasonParam) {
    seasonNumber = parseInt(seasonParam, 10);
    if (!Number.isFinite(seasonNumber))
      return NextResponse.json(
        { ok: false, error: "Invalid season" },
        { status: 400 },
      );
  } else {
    const active = await prisma.season.findFirst({
      where: { isActive: true },
      select: { seasonNumber: true },
    });
    if (!active)
      return NextResponse.json(
        { ok: false, error: "No active season" },
        { status: 404 },
      );
    seasonNumber = active.seasonNumber;
  }

  const breakdown = await calculateSeasonCPS(paramWallet, seasonNumber);

  // Per-position CPS records
  const records = await prisma.cpsRecord.findMany({
    where: { wallet: paramWallet, seasonNumber },
    orderBy: { calculatedAt: "desc" },
    take: 100,
    select: {
      positionId: true,
      rarScore: true,
      questCps: true,
      streakBonus: true,
      consistencyBonus: true,
      totalCps: true,
      calculatedAt: true,
    },
  });

  // Summary stats
  const summary = await prisma.seasonTraderSummary.findUnique({
    where: { wallet_seasonNumber: { wallet: paramWallet, seasonNumber } },
    select: {
      totalTrades: true,
      winningTrades: true,
      rankInDivision: true,
      division: true,
    },
  });

  return NextResponse.json({
    ok: true,
    wallet: paramWallet,
    seasonNumber,
    breakdown: {
      finalCps: breakdown.finalCps,
      rarComponent: breakdown.rarComponent,
      consistencyComponent: breakdown.consistencyComponent,
      questComponent: breakdown.questComponent,
      streakComponent: breakdown.streakComponent,
    },
    summary,
    recentRecords: records.map((r) => ({
      ...r,
      rarScore: Number(r.rarScore),
      questCps: Number(r.questCps),
      streakBonus: Number(r.streakBonus),
      consistencyBonus: Number(r.consistencyBonus),
      totalCps: Number(r.totalCps),
    })),
  });
}
