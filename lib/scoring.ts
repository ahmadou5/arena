// lib/scoring.ts — CPS scoring engine

import { prisma } from "@/lib/prisma";
import type { AdrenaPosition } from "@/lib/adrena";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CpsBreakdown {
  finalCps: number;
  rarComponent: number;
  consistencyComponent: number;
  questComponent: number;
  streakComponent: number;
}

// ── Pure math ──────────────────────────────────────────────────────────────

/**
 * Risk-Adjusted Return (RAR) score for a single position.
 * Normalised to micro-CPS units (×1_000_000) and clamped to [-10, 10]×1M.
 *
 *   rar = (pnl / drawdownFloor) × ln(1 + hours)
 *
 * drawdownFloor = max(|min(0,pnl)|, fees×0.1, collateral×0.001, 0.01)
 * ensures the denominator is never zero and penalises fee-heavy trades.
 */
export function calculateRAR(
  pnl: number,
  fees: number,
  collateral: number,
  durationSeconds: number,
): number {
  const hours = durationSeconds / 3600;
  const drawdownFloor = Math.max(
    Math.abs(Math.min(0, pnl)),
    fees * 0.1,
    collateral * 0.001,
    0.01,
  );
  const rar = (pnl / drawdownFloor) * Math.log(1 + hours);
  return Math.min(Math.max(rar, -10), 10) * 1_000_000;
}

// ── Position scorer ────────────────────────────────────────────────────────

/**
 * Score a single closed position, persist a CpsRecord row, and update
 * the SeasonTraderSummary trade counters.
 */
export async function scorePosition(
  pos: AdrenaPosition,
  seasonNumber: number,
): Promise<void> {
  // ── Duration ──────────────────────────────────────────────────────────
  const entryMs = pos.entry_date ? new Date(pos.entry_date).getTime() : 0;
  const exitMs = pos.exit_date ? new Date(pos.exit_date).getTime() : Date.now();
  const durationSeconds = Math.max(0, (exitMs - entryMs) / 1000);

  // ── PnL: handle liquidation (exit_price null + status closed) ─────────
  const collateral = pos.collateral_amount ?? 0;
  const fees = pos.fees ?? 0;
  const pnl =
    pos.pnl !== null
      ? pos.pnl
      : pos.exit_price === null && pos.status === "closed"
        ? -collateral // liquidated — full collateral loss
        : 0;

  // ── RAR ───────────────────────────────────────────────────────────────
  let rarScaled = calculateRAR(pnl, fees, collateral, durationSeconds);

  // ── Gauntlet multiplier (Days 7–10): 1.5x CPS ────────────────────────
  // Applied at position-close time; stored in rarScore so leaderboard reflects it.
  const activeSeason = await prisma.season.findUnique({
    where: { seasonNumber },
    select: { startTs: true },
  });
  if (activeSeason) {
    const elapsed = pos.exit_date
      ? new Date(pos.exit_date).getTime() - activeSeason.startTs.getTime()
      : Date.now() - activeSeason.startTs.getTime();
    const seasonDay = Math.floor(elapsed / 86_400_000) + 1;
    if (seasonDay >= 7 && seasonDay <= 10) {
      rarScaled = rarScaled * 1.5;
      console.log(
        `[scoring] Gauntlet bonus applied day=${seasonDay} positionId=${pos.position_id} multiplier=1.5x`,
      );
    }
  }

  // ── Persist CpsRecord (upsert on positionId) ──────────────────────────
  await prisma.cpsRecord.upsert({
    where: { positionId: pos.position_id },
    create: {
      wallet: pos.wallet,
      seasonNumber,
      positionId: pos.position_id,
      rarScore: rarScaled,
      questCps: 0,
      streakBonus: 0,
      consistencyBonus: 0,
      totalCps: rarScaled,
      calculatedAt: new Date(),
    },
    update: {
      rarScore: rarScaled,
      totalCps: rarScaled, // quest/streak bonuses summed in calculateSeasonCPS
      calculatedAt: new Date(),
    },
  });

  // ── SeasonTraderSummary: increment trade counters ─────────────────────
  const isWin = pnl > 0;
  await prisma.seasonTraderSummary.upsert({
    where: { wallet_seasonNumber: { wallet: pos.wallet, seasonNumber } },
    create: {
      wallet: pos.wallet,
      seasonNumber,
      totalCps: 0,
      totalTrades: 1,
      winningTrades: isWin ? 1 : 0,
      division: null,
    },
    update: {
      totalTrades: { increment: 1 },
      winningTrades: isWin ? { increment: 1 } : undefined,
    },
  });
}

// ── Season-level aggregation ───────────────────────────────────────────────

/**
 * Aggregate all CpsRecords for a wallet+season into a final CPS breakdown.
 *
 * consistencyBonus = totalTrades>=10 ? max(0,(winRate-0.5)×200)×500_000 : 0
 */
export async function calculateSeasonCPS(
  wallet: string,
  season: number,
): Promise<CpsBreakdown> {
  // Aggregate CPS components from all records for this wallet+season
  const agg = await prisma.cpsRecord.aggregate({
    where: { wallet, seasonNumber: season },
    _sum: {
      rarScore: true,
      questCps: true,
      streakBonus: true,
      consistencyBonus: true,
    },
    _count: { id: true },
  });

  const rarComponent = Number(agg._sum.rarScore ?? 0);
  const questComponent = Number(agg._sum.questCps ?? 0);
  const streakComponent = Number(agg._sum.streakBonus ?? 0);

  // Win-rate consistency bonus (requires summary row)
  const summary = await prisma.seasonTraderSummary.findUnique({
    where: { wallet_seasonNumber: { wallet, seasonNumber: season } },
    select: { totalTrades: true, winningTrades: true },
  });

  const totalTrades = summary?.totalTrades ?? 0;
  const winningTrades = summary?.winningTrades ?? 0;
  const winRate = totalTrades >= 10 ? winningTrades / totalTrades : 0;
  const consistencyComponent =
    totalTrades >= 10 ? Math.max(0, (winRate - 0.5) * 200) * 500_000 : 0;

  const finalCps =
    rarComponent + questComponent + streakComponent + consistencyComponent;

  return {
    finalCps,
    rarComponent,
    consistencyComponent,
    questComponent,
    streakComponent,
  };
}

// ── Leaderboard batch update ───────────────────────────────────────────────

/**
 * Recalculate CPS for every wallet active in `seasonNumber`,
 * upsert SeasonTraderSummary.totalCps, and return the count updated.
 */
export async function updateAllLeaderboardCPS(
  seasonNumber: number,
): Promise<number> {
  // Distinct wallets who have CpsRecords this season
  const rows = await prisma.cpsRecord.findMany({
    where: { seasonNumber },
    select: { wallet: true },
    distinct: ["wallet"],
  });

  let updated = 0;
  for (const { wallet } of rows) {
    try {
      const breakdown = await calculateSeasonCPS(wallet, seasonNumber);

      await prisma.seasonTraderSummary.upsert({
        where: { wallet_seasonNumber: { wallet, seasonNumber } },
        create: {
          wallet,
          seasonNumber,
          totalCps: breakdown.finalCps,
          totalTrades: 0,
          winningTrades: 0,
          division: null,
        },
        update: { totalCps: breakdown.finalCps },
      });

      updated++;
    } catch (err) {
      console.error(
        `[scoring] updateAllLeaderboardCPS failed for ${wallet}:`,
        err,
      );
    }
  }

  return updated;
}

// ── Achievement detection ──────────────────────────────────────────────────

export type AchievementKey =
  | "iron_hands"
  | "comeback_king"
  | "division_dominator"
  | "squad_mvp"
  | "perfect_streak"
  | "quest_completionist";

/**
 * Detect which achievements a wallet earned this season.
 * Persists Achievement rows (idempotent — upsert on unique[wallet,season,key]).
 * Returns array of earned achievement keys.
 */
export async function detectAchievements(
  wallet: string,
  seasonNumber: number,
): Promise<AchievementKey[]> {
  const earned: AchievementKey[] = [];

  const summary = await prisma.seasonTraderSummary.findUnique({
    where: { wallet_seasonNumber: { wallet, seasonNumber } },
    select: {
      totalTrades: true,
      winningTrades: true,
      rankInDivision: true,
      rankAtDay14: true,
      division: true,
      totalCps: true,
    },
  });

  // ── iron_hands ────────────────────────────────────────────────────────
  // Zero losing trades AND totalTrades >= 10
  if (summary) {
    const losingTrades = summary.totalTrades - summary.winningTrades;
    if (losingTrades === 0 && summary.totalTrades >= 10) {
      earned.push("iron_hands");
    }
  }

  // ── comeback_king ─────────────────────────────────────────────────────
  // Was in bottom 25% at Day 14, finished in top 25% of division
  if (
    summary?.rankAtDay14 != null &&
    summary?.rankInDivision != null &&
    summary.division
  ) {
    const totalInDiv = await prisma.seasonTraderSummary.count({
      where: { seasonNumber, division: summary.division },
    });
    if (totalInDiv > 0) {
      const day14Bottom25 = summary.rankAtDay14 > Math.floor(totalInDiv * 0.75);
      const finalTop25 = summary.rankInDivision <= Math.ceil(totalInDiv * 0.25);
      if (day14Bottom25 && finalTop25) {
        earned.push("comeback_king");
      }
    }
  }

  // ── division_dominator ────────────────────────────────────────────────
  // finalCps >= 1.2× second place in same division
  if (summary?.rankInDivision === 1 && summary.division) {
    const topTwo = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber, division: summary.division },
      orderBy: { totalCps: "desc" },
      take: 2,
      select: { totalCps: true },
    });
    if (topTwo.length === 2) {
      const first = Number(topTwo[0].totalCps);
      const second = Number(topTwo[1].totalCps);
      if (second > 0 && first >= second * 1.2) {
        earned.push("division_dominator");
      }
    }
  }

  // ── squad_mvp ─────────────────────────────────────────────────────────
  // Highest CPS in the rank-1 squad of their division
  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: { currentSquadId: true },
  });
  if (trader?.currentSquadId != null) {
    const squad = await prisma.squad.findUnique({
      where: { id: trader.currentSquadId },
      select: { rank: true, seasonNumber: true },
    });
    if (squad?.rank === 1 && squad.seasonNumber === seasonNumber) {
      // Find the top CPS among squad members this season
      const squadMembers = await prisma.squadMember.findMany({
        where: { squadId: trader.currentSquadId },
        select: { wallet: true },
      });
      const memberWallets = squadMembers.map((m) => m.wallet);
      if (memberWallets.length > 0) {
        const topMember = await prisma.seasonTraderSummary.findFirst({
          where: { seasonNumber, wallet: { in: memberWallets } },
          orderBy: { totalCps: "desc" },
          select: { wallet: true },
        });
        if (topMember?.wallet === wallet) {
          earned.push("squad_mvp");
        }
      }
    }
  }

  // ── perfect_streak ────────────────────────────────────────────────────
  // Approximation: traded every calendar day of the season.
  // NOTE: This is an approximation — we count distinct exit dates in
  // PositionCache for this wallet+season and compare against season length
  // in days. A more precise implementation would track daily activity events.
  const season = await prisma.season.findUnique({
    where: { seasonNumber },
    select: { startTs: true, endTs: true },
  });
  if (season) {
    const seasonLengthDays = Math.ceil(
      (season.endTs.getTime() - season.startTs.getTime()) / 86_400_000,
    );
    const tradeDays = await prisma.positionCache.findMany({
      where: { wallet, seasonNumber, exitDate: { not: null } },
      select: { exitDate: true },
      distinct: ["exitDate"],
    });
    // Group by calendar date
    const uniqueDays = new Set(
      tradeDays
        .filter((t) => t.exitDate)
        .map((t) => t.exitDate!.toISOString().slice(0, 10)),
    );
    if (uniqueDays.size >= seasonLengthDays) {
      earned.push("perfect_streak");
    }
  }

  // ── quest_completionist ───────────────────────────────────────────────
  // TODO: placeholder — implement once quest definitions are finalised.
  // Logic: count distinct questTypes completed this season and compare
  // against the canonical quest list for the season.
  // if (completedQuestTypes.size === TOTAL_QUEST_TYPES) {
  //   earned.push('quest_completionist')
  // }

  // ── Persist all earned achievements (idempotent) ──────────────────────
  for (const key of earned) {
    await prisma.achievement.upsert({
      where: {
        wallet_seasonNumber_achievementKey: {
          wallet,
          seasonNumber,
          achievementKey: key,
        },
      },
      create: { wallet, seasonNumber, achievementKey: key },
      update: {}, // no-op on conflict — idempotent
    });
  }

  return earned;
}

// ── Prize allocation ───────────────────────────────────────────────────────

/**
 * Allocate prizes for a closed season.
 *
 * Distribution:
 *   60% Individual rank prizes — top 3 per division, weighted by division tier
 *   20% Squad prizes           — top 3 squads per division
 *   10% Participation          — flat share for all wallets with ≥1 trade
 *   10% Achievement bonuses    — flat per achievement earned
 *
 * All allocations are idempotent (upsert on unique[wallet,season,prizeType,rank]).
 */
export async function allocatePrizes(
  seasonNumber: number,
  prizePoolUsdc: number,
): Promise<number> {
  let allocated = 0;

  const individualPool = prizePoolUsdc * 0.6;
  const squadPool = prizePoolUsdc * 0.2;
  const participationPool = prizePoolUsdc * 0.1;
  const achievementPool = prizePoolUsdc * 0.1;

  // Division tier weights (must sum to 1.0)
  const divisionShares: Record<number, number> = {
    1: 0.4,
    2: 0.25,
    3: 0.15,
    4: 0.12,
    5: 0.08,
  };
  const rankMultipliers = [0.5, 0.3, 0.2]; // 1st, 2nd, 3rd

  // ── 1. Individual rank prizes (60%) ─────────────────────────────────────
  for (const [div, divShare] of Object.entries(divisionShares)) {
    const divPool = individualPool * divShare;
    const topThree = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber, division: Number(div) },
      orderBy: { totalCps: "desc" },
      take: 3,
      select: { wallet: true },
    });
    for (let i = 0; i < topThree.length; i++) {
      await prisma.prizeAllocation
        .upsert({
          where: {
            wallet_seasonNumber_prizeType_rank: {
              wallet: topThree[i].wallet,
              seasonNumber,
              prizeType: "rank",
              rank: i + 1,
            },
          },
          create: {
            wallet: topThree[i].wallet,
            seasonNumber,
            prizeType: "rank",
            amountUsdc: divPool * rankMultipliers[i],
            rank: i + 1,
            status: "pending",
          },
          update: {},
        })
        .catch(() => {});
      allocated++;
    }
  }

  // ── 2. Squad prizes (20%) ────────────────────────────────────────────────
  for (const [div, divShare] of Object.entries(divisionShares)) {
    const divPool = squadPool * divShare;
    const topSquads = await prisma.squad.findMany({
      where: { seasonNumber, division: Number(div), disbanded: false },
      orderBy: { squadScore: "desc" },
      take: 3,
      include: { currentMembers: { select: { wallet: true } } },
    });

    for (let i = 0; i < topSquads.length; i++) {
      const squad = topSquads[i];
      const memberWallets = (squad.currentMembers as { wallet: string }[]).map(
        (m) => m.wallet,
      );
      if (memberWallets.length === 0) continue;

      const perMember = (divPool * rankMultipliers[i]) / memberWallets.length;

      for (const wallet of memberWallets) {
        await prisma.prizeAllocation
          .upsert({
            where: {
              wallet_seasonNumber_prizeType_rank: {
                wallet,
                seasonNumber,
                prizeType: "squad",
                rank: i + 1,
              },
            },
            create: {
              wallet,
              seasonNumber,
              prizeType: "squad",
              amountUsdc: perMember,
              rank: i + 1,
              squadId: squad.id,
              status: "pending",
            },
            update: {},
          })
          .catch(() => {});
        allocated++;
      }
    }
  }

  // ── 3. Participation prizes (10%) ────────────────────────────────────────
  const participants = await prisma.seasonTraderSummary.findMany({
    where: { seasonNumber, totalTrades: { gt: 0 } },
    select: { wallet: true },
  });
  if (participants.length > 0) {
    const perParticipant = participationPool / participants.length;
    for (const { wallet } of participants) {
      await prisma.prizeAllocation
        .upsert({
          where: {
            wallet_seasonNumber_prizeType_rank: {
              wallet,
              seasonNumber,
              prizeType: "participation",
              rank: 0,
            },
          },
          create: {
            wallet,
            seasonNumber,
            prizeType: "participation",
            amountUsdc: perParticipant,
            rank: 0,
            status: "pending",
          },
          update: {},
        })
        .catch(() => {});
      allocated++;
    }
  }

  // ── 4. Achievement bonuses (10%) ─────────────────────────────────────────
  const achievements = await prisma.achievement.findMany({
    where: { seasonNumber },
    select: { wallet: true, achievementKey: true },
  });
  if (achievements.length > 0) {
    const perAchievement = achievementPool / achievements.length;
    for (const { wallet, achievementKey } of achievements) {
      await prisma.prizeAllocation
        .upsert({
          where: {
            wallet_seasonNumber_prizeType_rank: {
              wallet,
              seasonNumber,
              prizeType: "achievement",
              rank: 0,
            },
          },
          create: {
            wallet,
            seasonNumber,
            prizeType: "achievement",
            amountUsdc: perAchievement,
            rank: 0,
            achievementKey,
            status: "pending",
          },
          update: {},
        })
        .catch(() => {});
      allocated++;
    }
  }

  console.log(
    `[scoring] allocatePrizes season=${seasonNumber}: ${allocated} allocations ` +
      `(individual=${individualPool?.toFixed(2)} squad=${squadPool?.toFixed(2)} ` +
      `participation=${participationPool?.toFixed(2)} achievement=${achievementPool?.toFixed(2)}) ` +
      `from $${prizePoolUsdc} USDC`,
  );
  return allocated;
}
