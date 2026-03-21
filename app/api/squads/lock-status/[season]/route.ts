// src/app/api/squads/lock-status/[season]/route.ts
// GET /api/squads/lock-status/:season
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSeasonDay } from "@/lib/season";
import type { Season } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ season: string }> },
) {
  const { season: Pseason } = await params;
  const seasonNumber = parseInt(Pseason, 10);
  if (!Number.isFinite(seasonNumber))
    return NextResponse.json(
      { ok: false, error: "Invalid season" },
      { status: 400 },
    );

  const season = await prisma.season.findUnique({ where: { seasonNumber } });
  if (!season)
    return NextResponse.json(
      { ok: false, error: "Season not found" },
      { status: 404 },
    );

  const day = season.isActive ? getSeasonDay(season) : null;
  const locked = day !== null ? day > 3 : true; // closed season = locked

  const [lockedCount, unlockedCount] = await Promise.all([
    prisma.squad.count({
      where: { seasonNumber, isLocked: true, disbanded: false },
    }),
    prisma.squad.count({
      where: { seasonNumber, isLocked: false, disbanded: false },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    seasonNumber,
    squadsLocked: locked,
    seasonDay: day,
    lockDay: 3,
    lockedCount,
    unlockedCount,
  });
}
