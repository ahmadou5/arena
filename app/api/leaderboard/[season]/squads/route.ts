// src/app/api/leaderboard/[season]/squads/route.ts
// GET /api/leaderboard/:season/squads?division&page&limit
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { season: string } },
) {
  const seasonNumber = parseInt(params.season, 10);
  if (!Number.isFinite(seasonNumber) || seasonNumber < 1)
    return NextResponse.json(
      { ok: false, error: "Invalid season" },
      { status: 400 },
    );

  const sp = req.nextUrl.searchParams;
  const divParam = sp.get("division");
  const division = divParam ? parseInt(divParam, 10) : null;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(sp.get("limit") ?? "50", 10) || 50),
  );
  const skip = (page - 1) * limit;

  const where = {
    seasonNumber,
    disbanded: false,
    ...(division && division >= 1 && division <= 5 ? { division } : {}),
  };

  const [squads, total] = await Promise.all([
    prisma.squad.findMany({
      where,
      orderBy: { squadScore: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        division: true,
        squadScore: true,
        rank: true,
        isLocked: true,
        synergyQuestWeeks: true,
        synergyStreakPeak: true,
        createdAt: true,
        _count: { select: { currentMembers: true } },
      },
    }),
    prisma.squad.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    squads: squads.map((s) => ({
      ...s,
      squadScore: Number(s.squadScore),
      memberCount: s._count.currentMembers,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    seasonNumber,
  });
}
