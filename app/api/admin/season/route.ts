// src/app/api/admin/seasons/route.ts
// GET  /api/admin/seasons — list all seasons with stats
// Auth: JWT wallet must be in ADMIN_WALLETS env var

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isAdmin(wallet: string): boolean {
  const admins = (process.env.ADMIN_WALLETS ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  // If no wallets configured, fall back to ADMIN_TOKEN check
  if (admins.length === 0) return true;
  return admins.includes(wallet.toLowerCase());
}

function unauthorized(msg = "Unauthorized") {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 });
}

export async function GET(req: NextRequest) {
  // Verify JWT
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return unauthorized();
  const payload = verifyJWT(header.slice(7));
  if (!payload) return unauthorized("Invalid or expired token");
  if (!isAdmin(payload.wallet)) return unauthorized("Not an admin wallet");

  const seasons = await prisma.season.findMany({
    orderBy: { seasonNumber: "desc" },
    select: {
      id: true,
      seasonNumber: true,
      name: true,
      startTs: true,
      endTs: true,
      offseasonEndTs: true,
      isActive: true,
      prizePoolUsdc: true,
      createdAt: true,
      _count: {
        select: {
          seasonRecords: true, // finished traders
          squads: true,
        },
      },
    },
  });

  // For each season get active trader count from SeasonTraderSummary
  const summaries = await prisma.seasonTraderSummary.groupBy({
    by: ["seasonNumber"],
    _count: { wallet: true },
  });
  const summaryMap: Record<number, number> = {};
  summaries.forEach((s) => {
    summaryMap[s.seasonNumber] = s._count.wallet;
  });

  return NextResponse.json({
    ok: true,
    seasons: seasons.map((s) => ({
      id: s.id,
      seasonNumber: s.seasonNumber,
      name: s.name,
      startTs: s.startTs.toISOString(),
      endTs: s.endTs.toISOString(),
      offseasonEndTs: s.offseasonEndTs.toISOString(),
      isActive: s.isActive,
      prizePoolUsdc: Number(s.prizePoolUsdc),
      createdAt: s.createdAt.toISOString(),
      traderCount: summaryMap[s.seasonNumber] ?? 0,
      squadCount: s._count.squads,
      recordCount: s._count.seasonRecords,
    })),
  });
}
