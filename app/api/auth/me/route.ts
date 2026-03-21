// app/api/auth/me/route.ts
// GET /api/auth/me — return authenticated trader's profile

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────
  let wallet: string;
  try {
    wallet = requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  // ── Fetch trader profile ───────────────────────────────────────────────
  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: {
      wallet: true,
      arenaRating: true,
      currentDivision: true,
      registeredSeason: true,
      totalSeasonsParticipated: true,
      totalSeasonsMissed: true,
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
        },
      },
      streak: {
        select: {
          streakDays: true,
          lastStreakDate: true,
        },
      },
    },
  });

  if (!trader) {
    return NextResponse.json(
      { ok: false, error: "Trader not found — wallet may need to register" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, trader });
}
