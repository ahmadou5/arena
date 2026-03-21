// src/app/api/trader/[wallet]/positions/route.ts
// GET /api/trader/:wallet/positions — public, paginated
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { wallet: string } },
) {
  const { wallet } = params;
  const sp = req.nextUrl.searchParams;

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20),
  );
  const status = sp.get("status"); // 'open' | 'closed' | null (all)
  const season = sp.get("season");
  const skip = (page - 1) * limit;

  const where = {
    wallet,
    ...(status === "open" || status === "closed" ? { status } : {}),
    ...(season ? { seasonNumber: parseInt(season, 10) } : {}),
  };

  const [positions, total] = await Promise.all([
    prisma.positionCache.findMany({
      where,
      orderBy: { entryDate: "desc" },
      skip,
      take: limit,
      select: {
        positionId: true,
        symbol: true,
        side: true,
        status: true,
        entryPrice: true,
        exitPrice: true,
        entrySize: true,
        pnl: true,
        entryLeverage: true,
        entryDate: true,
        exitDate: true,
        fees: true,
        collateralAmount: true,
        seasonNumber: true,
      },
    }),
    prisma.positionCache.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    wallet,
    positions: positions.map((p) => ({
      ...p,
      entryPrice: p.entryPrice !== null ? Number(p.entryPrice) : null,
      exitPrice: p.exitPrice !== null ? Number(p.exitPrice) : null,
      entrySize: p.entrySize !== null ? Number(p.entrySize) : null,
      pnl: p.pnl !== null ? Number(p.pnl) : null,
      entryLeverage: p.entryLeverage !== null ? Number(p.entryLeverage) : null,
      fees: p.fees !== null ? Number(p.fees) : null,
      collateralAmount:
        p.collateralAmount !== null ? Number(p.collateralAmount) : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
