// src/app/api/seasons/[number]/route.ts
// GET /api/seasons/:number
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSeasonDay } from "@/lib/season";
import type { Season } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const seasonNumber = parseInt(number, 10);
  if (!Number.isFinite(seasonNumber))
    return NextResponse.json(
      { ok: false, error: "Invalid season number" },
      { status: 400 },
    );

  const season = await prisma.season.findUnique({ where: { seasonNumber } });
  if (!season)
    return NextResponse.json(
      { ok: false, error: "Season not found" },
      { status: 404 },
    );

  const [traderCount, squadCount] = await Promise.all([
    prisma.seasonTraderSummary.count({ where: { seasonNumber } }),
    prisma.squad.count({ where: { seasonNumber, disbanded: false } }),
  ]);

  const day = season.isActive ? getSeasonDay(season) : null;

  return NextResponse.json({
    ok: true,
    season: {
      ...season,
      prizePoolUsdc: Number(season.prizePoolUsdc),
      seasonDay: day,
      traderCount,
      squadCount,
    },
  });
}
