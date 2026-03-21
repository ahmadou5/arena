// src/app/api/seasons/list/route.ts
// GET /api/seasons/list?page&limit
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(sp.get("limit") ?? "10", 10) || 10),
  );
  const skip = (page - 1) * limit;

  const [seasons, total] = await Promise.all([
    prisma.season.findMany({
      orderBy: { seasonNumber: "desc" },
      skip,
      take: limit,
      select: {
        seasonNumber: true,
        name: true,
        startTs: true,
        endTs: true,
        isActive: true,
        prizePoolUsdc: true,
        _count: { select: { seasonSummaries: true, squads: true } },
      },
    }),
    prisma.season.count(),
  ]);

  return NextResponse.json({
    ok: true,
    seasons: seasons.map((s) => ({
      ...s,
      prizePoolUsdc: Number(s.prizePoolUsdc),
      traderCount: s._count.seasonSummaries,
      squadCount: s._count.squads,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
