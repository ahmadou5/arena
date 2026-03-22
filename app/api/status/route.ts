// src/app/api/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface TableCheck {
  name: string;
  count: number | null;
  error: string | null;
  latencyMs: number;
}

async function checkTable(
  name: string,
  query: () => Promise<number>,
): Promise<TableCheck> {
  const start = Date.now();
  try {
    const count = await query();
    return { name, count, error: null, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      name,
      count: null,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - start,
    };
  }
}

export async function GET() {
  const start = Date.now();

  // Check DB connectivity first with a raw ping
  let dbOnline = false;
  let dbLatencyMs = 0;
  let dbError: string | null = null;

  try {
    const pingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - pingStart;
    dbOnline = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
    dbLatencyMs = Date.now() - start;
  }

  // If DB is offline, return early
  if (!dbOnline) {
    return NextResponse.json({
      ok: false,
      status: "degraded",
      db: { online: false, latencyMs: dbLatencyMs, error: dbError },
      tables: [],
      checkedAt: new Date().toISOString(),
      totalMs: Date.now() - start,
    });
  }

  // Check all tables in parallel
  const tables = await Promise.all([
    checkTable("Season", () => prisma.season.count()),
    checkTable("Trader", () => prisma.trader.count()),
    checkTable("PositionCache", () => prisma.positionCache.count()),
    checkTable("Squad", () => prisma.squad.count()),
    checkTable("SquadMember", () => prisma.squadMember.count()),
    checkTable("CpsRecord", () => prisma.cpsRecord.count()),
    checkTable("SeasonTraderSummary", () => prisma.seasonTraderSummary.count()),
    checkTable("SeasonRecord", () => prisma.seasonRecord.count()),
    checkTable("Achievement", () => prisma.achievement.count()),
    checkTable("Streak", () => prisma.streak.count()),
    checkTable("QuestCompletion", () => prisma.questCompletion.count()),
    checkTable("PrizeAllocation", () => prisma.prizeAllocation.count()),
    checkTable("Nonce", () => prisma.nonce.count()),
  ]);

  // Active season info
  let activeSeason = null;
  try {
    const s = await prisma.season.findFirst({
      where: { isActive: true },
      select: { seasonNumber: true, name: true, startTs: true, endTs: true },
    });
    if (s)
      activeSeason = {
        ...s,
        startTs: s.startTs.toISOString(),
        endTs: s.endTs.toISOString(),
      };
  } catch {}

  const hasErrors = tables.some((t) => t.error !== null);
  const status = !dbOnline ? "degraded" : hasErrors ? "partial" : "operational";

  return NextResponse.json({
    ok: true,
    status,
    db: { online: true, latencyMs: dbLatencyMs, error: null },
    activeSeason,
    tables,
    checkedAt: new Date().toISOString(),
    totalMs: Date.now() - start,
  });
}
