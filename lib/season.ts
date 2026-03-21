// lib/season.ts — Season lifecycle management

import { prisma } from "./prisma";
import type { Season } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OpenSeasonParams {
  seasonNumber: number;
  name: string;
  startTs: Date;
  endTs: Date;
  offseasonEndTs: Date;
  prizePoolUsdc?: number;
}

// ── In-memory cache (shared with position-sync / leaderboard) ─────────────

let _cache: Season | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 30_000;

export function invalidateSeasonCache(): void {
  _cache = null;
  _cacheTs = 0;
}

// ── Season CRUD ────────────────────────────────────────────────────────────

/**
 * Create a new season. Throws if a season with that number already exists
 * or if another season is currently active.
 */
export async function openSeason(params: OpenSeasonParams): Promise<Season> {
  const {
    seasonNumber,
    name,
    startTs,
    endTs,
    offseasonEndTs,
    prizePoolUsdc = 0,
  } = params;

  // Guard: no duplicate season numbers
  const existing = await prisma.season.findUnique({ where: { seasonNumber } });
  if (existing) {
    throw new Error(`Season ${seasonNumber} already exists`);
  }

  // Guard: deactivate any currently active season first
  const active = await prisma.season.findFirst({ where: { isActive: true } });
  if (active) {
    throw new Error(
      `Season ${active.seasonNumber} is still active — close it before opening a new one`,
    );
  }

  const season = await prisma.season.create({
    data: {
      seasonNumber,
      name,
      startTs,
      endTs,
      offseasonEndTs,
      isActive: true,
      prizePoolUsdc,
    },
  });

  invalidateSeasonCache();
  console.log(`[season] opened season ${seasonNumber}: "${name}"`);
  return season;
}

/**
 * Close an active season: mark isActive=false, run AR updates and
 * promotion/relegation for every participant, write SeasonRecords.
 */
export async function closeSeason(seasonNumber: number): Promise<Season> {
  const season = await prisma.season.findUnique({ where: { seasonNumber } });
  if (!season) throw new Error(`Season ${seasonNumber} not found`);
  if (!season.isActive)
    throw new Error(`Season ${seasonNumber} is already closed`);

  // 1. Finalise SeasonRecords for all participants
  const summaries = await prisma.seasonTraderSummary.findMany({
    where: { seasonNumber },
    select: {
      wallet: true,
      totalCps: true,
      rankInDivision: true,
      division: true,
      winningTrades: true,
      totalTrades: true,
    },
  });

  for (const s of summaries) {
    await prisma.seasonRecord
      .upsert({
        where: { wallet_seasonNumber: { wallet: s.wallet, seasonNumber } },
        create: {
          wallet: s.wallet,
          seasonNumber,
          finalCps: s.totalCps,
          finalRank: s.rankInDivision,
          division: s.division,
          arStart:
            (
              await prisma.trader.findUnique({
                where: { wallet: s.wallet },
                select: { arenaRating: true },
              })
            )?.arenaRating ?? 400,
          totalTrades: s.totalTrades,
          winningTrades: s.winningTrades,
        },
        update: {
          finalCps: s.totalCps,
          finalRank: s.rankInDivision,
          division: s.division,
          totalTrades: s.totalTrades,
          winningTrades: s.winningTrades,
        },
      })
      .catch((err) =>
        console.error(
          `[season] SeasonRecord upsert failed wallet=${s.wallet}:`,
          err,
        ),
      );
  }

  // 2. AR updates for all participants
  for (const s of summaries) {
    await updateArenaRating(s.wallet, seasonNumber).catch((err) =>
      console.error(`[season] AR update failed wallet=${s.wallet}:`, err),
    );
  }

  // 3. Promotion / relegation pass
  await processPromotionRelegation(seasonNumber);

  // 4. Update trader season counters
  const wallets = summaries.map((s) => s.wallet);
  await prisma.trader.updateMany({
    where: { wallet: { in: wallets } },
    data: {
      lastActiveSeason: seasonNumber,
      totalSeasonsParticipated: { increment: 1 },
    },
  });

  // Inactive penalty: registered traders who never appeared in summaries
  await prisma.trader.updateMany({
    where: {
      wallet: { notIn: wallets },
      registeredSeason: { lt: seasonNumber },
      lastActiveSeason: { not: seasonNumber },
    },
    data: { totalSeasonsMissed: { increment: 1 } },
  });

  // 5. Flip the season off
  const closed = await prisma.season.update({
    where: { seasonNumber },
    data: { isActive: false },
  });

  invalidateSeasonCache();
  console.log(
    `[season] closed season ${seasonNumber} (${summaries.length} participants)`,
  );
  return closed;
}

/**
 * Returns the currently active Season, with a 30s in-memory cache.
 * Throws if no active season exists.
 */
export async function getActiveSeason(): Promise<Season> {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL_MS) return _cache;

  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) throw new Error("No active season found");

  _cache = season;
  _cacheTs = now;
  return season;
}

// ── Season day helpers ─────────────────────────────────────────────────────

/**
 * Returns the current day of the season (1-indexed, 1 = first 24h).
 * Returns 0 before startTs, and a day past endTs if called after season ends.
 */
export function getSeasonDay(season: Season): number {
  const elapsed = Date.now() - season.startTs.getTime();
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / 86_400_000) + 1;
}

/**
 * Squad Lock Day = Day 3 of the season.
 * Returns true if today is day 3 (squads can no longer be changed after this).
 */
export function isSquadLockDay(season: Season): boolean {
  return getSeasonDay(season) === 3;
}

// ── Arena Rating ───────────────────────────────────────────────────────────

const DIVISION_WEIGHT: Record<number, number> = {
  1: 3.0,
  2: 2.5,
  3: 2.0,
  4: 1.5,
  5: 1.0,
};

/**
 * Assign a division tier from an Arena Rating.
 * 2000+ → 1, 1600+ → 2, 1200+ → 3, 800+ → 4, else → 5
 */
export function assignDivision(ar: number): number {
  if (ar >= 2000) return 1;
  if (ar >= 1600) return 2;
  if (ar >= 1200) return 3;
  if (ar >= 800) return 4;
  return 5;
}

/**
 * Recalculate and persist a single trader's Arena Rating at season end.
 *
 * Formula:
 *   percentile        = ((totalInDiv - rank) / totalInDiv) × 100
 *   divisionWeight    = {1:3.0, 2:2.5, 3:2.0, 4:1.5, 5:1.0}[division]
 *   inactivity penalty: arBase -= 50 if lastActiveSeason !== season AND
 *                                      registeredSeason < season
 *   delta             = round((percentile - 50) × divisionWeight)
 *   newAr             = clamp(arBase + delta, 0, 9999)
 */
export async function updateArenaRating(
  wallet: string,
  seasonNumber: number,
): Promise<void> {
  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: {
      arenaRating: true,
      currentDivision: true,
      lastActiveSeason: true,
      registeredSeason: true,
    },
  });
  if (!trader) {
    console.warn(
      `[season] updateArenaRating: trader not found wallet=${wallet}`,
    );
    return;
  }

  const summary = await prisma.seasonTraderSummary.findUnique({
    where: { wallet_seasonNumber: { wallet, seasonNumber } },
    select: { rankInDivision: true, division: true },
  });

  // Trader registered but never traded — no summary row
  const rank = summary?.rankInDivision ?? null;
  const division = summary?.division ?? trader.currentDivision;

  let arBase = trader.arenaRating;

  // Inactivity penalty
  const wasInactive =
    trader.lastActiveSeason !== seasonNumber &&
    (trader.registeredSeason ?? 0) < seasonNumber;
  if (wasInactive) {
    arBase = Math.max(0, arBase - 50);
  }

  let newAr = arBase;

  if (rank !== null) {
    // Count peers in same division
    const totalInDiv = await prisma.seasonTraderSummary.count({
      where: { seasonNumber, division },
    });

    const divWeight = DIVISION_WEIGHT[division] ?? 1.0;
    const percentile =
      totalInDiv > 0 ? ((totalInDiv - rank) / totalInDiv) * 100 : 50;

    const delta = Math.round((percentile - 50) * divWeight);
    newAr = Math.max(0, Math.min(9999, arBase + delta));
  }

  await prisma.trader.update({
    where: { wallet },
    data: {
      arenaRating: newAr,
      currentDivision: assignDivision(newAr),
    },
  });

  // Write arEnd to SeasonRecord
  await prisma.seasonRecord.updateMany({
    where: { wallet, seasonNumber },
    data: { arEnd: newAr },
  });
}

// ── Promotion / Relegation ─────────────────────────────────────────────────

/**
 * After AR updates: promote top 10% of each division (excl Div1) by +200 AR,
 * relegate bottom 10% (excl Div5) by -150 AR.
 * Ties are included (ceil for promotion, ceil for relegation cut).
 * Updates currentDivision via assignDivision.
 */
export async function processPromotionRelegation(
  seasonNumber: number,
): Promise<void> {
  for (let div = 1; div <= 5; div++) {
    // Fetch all summaries for this division, ranked by rankInDivision
    const members = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber, division: div },
      orderBy: { rankInDivision: "asc" },
      select: { wallet: true, rankInDivision: true },
    });

    if (members.length === 0) continue;

    const total = members.length;
    const promoCutoff = Math.ceil(total * 0.1); // top 10% — include ties
    const relCutoff = Math.floor(total * 0.9); // bottom 10% starts here

    for (let i = 0; i < members.length; i++) {
      const { wallet } = members[i];
      const rank = members[i].rankInDivision ?? i + 1;

      const isPromoZone = div > 1 && rank <= promoCutoff;
      const isRelZone = div < 5 && rank > relCutoff;

      if (!isPromoZone && !isRelZone) continue;

      const trader = await prisma.trader.findUnique({
        where: { wallet },
        select: { arenaRating: true },
      });
      if (!trader) continue;

      const arDelta = isPromoZone ? 200 : -150;
      const newAr = Math.max(0, Math.min(9999, trader.arenaRating + arDelta));
      const newDiv = assignDivision(newAr);

      await prisma.trader.update({
        where: { wallet },
        data: {
          arenaRating: newAr,
          currentDivision: newDiv,
        },
      });

      await prisma.seasonRecord.updateMany({
        where: { wallet, seasonNumber },
        data: {
          promoted: isPromoZone,
          relegated: isRelZone,
          arEnd: newAr,
        },
      });
    }
  }
}

// ── Prize payment tracking ─────────────────────────────────────────────────

/**
 * Mark a PrizeAllocation as paid.
 * Records the Solana transaction signature and timestamps paidAt.
 */
export async function markPrizePaid(
  prizeId: number,
  txSignature: string,
): Promise<void> {
  const prize = await prisma.prizeAllocation.findUnique({
    where: { id: prizeId },
    select: { status: true, wallet: true },
  });
  if (!prize) throw new Error(`PrizeAllocation ${prizeId} not found`);
  if (prize.status === "paid") {
    console.warn(
      `[season] markPrizePaid: prize ${prizeId} already marked paid — skipping`,
    );
    return;
  }

  await prisma.prizeAllocation.update({
    where: { id: prizeId },
    data: {
      status: "paid",
      txSignature,
      paidAt: new Date(),
    },
  });

  console.log(
    `[season] prize ${prizeId} marked paid — wallet=${prize.wallet} tx=${txSignature}`,
  );
}
