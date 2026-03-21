// src/app/api/squads/open/[season]/route.ts
// GET /api/squads/open/:season — open (not locked, not disbanded) squads this season
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ season: string }> },
) {
  const { season } = await params;
  const seasonNumber = parseInt(season, 10);
  if (!Number.isFinite(seasonNumber))
    return NextResponse.json(
      { ok: false, error: "Invalid season" },
      { status: 400 },
    );

  const sp = req.nextUrl.searchParams;
  const div = sp.get("division");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20),
  );
  const skip = (page - 1) * limit;

  const where = {
    seasonNumber,
    isLocked: false,
    disbanded: false,
    ...(div ? { division: parseInt(div, 10) } : {}),
  };

  const [squads, total] = await Promise.all([
    prisma.squad.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        division: true,
        creatorWallet: true,
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
      memberCount: s._count.currentMembers,
      spotsLeft: 5 - s._count.currentMembers,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
