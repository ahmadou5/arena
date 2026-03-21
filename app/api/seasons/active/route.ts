// src/app/api/seasons/active/route.ts
// GET /api/seasons/active
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSeasonDay, isSquadLockDay } from "@/lib/season";
import type { Season } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  });
  if (!season) return NextResponse.json({ ok: true, season: null });

  const day = getSeasonDay(season);

  return NextResponse.json({
    ok: true,
    season: {
      seasonNumber: season.seasonNumber,
      name: season.name,
      startTs: season.startTs,
      endTs: season.endTs,
      offseasonEndTs: season.offseasonEndTs,
      isActive: true,
      prizePoolUsdc: Number(season.prizePoolUsdc),
      seasonDay: day,
      isSquadLockDay: isSquadLockDay(season),
      squadsLocked: day > 3,
    },
  });
}
