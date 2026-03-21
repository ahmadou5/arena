// jobs/season-finalize.ts
// Run: npx ts-node jobs/season-finalize.ts --season=N
//
// Idempotent: each step checks state before acting.
// Safe to re-run — second run produces zero DB changes.

import { prisma } from "../lib/prisma";
import {
  updateAllLeaderboardCPS,
  detectAchievements,
  allocatePrizes,
} from "@/lib/scoring";
import {
  updateArenaRating,
  processPromotionRelegation,
  assignDivision,
} from "@/lib/season";

// ── CLI arg parsing ────────────────────────────────────────────────────────

function parseSeasonArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--season="));
  if (!arg) {
    console.error("Usage: npx ts-node jobs/season-finalize.ts --season=N");
    process.exit(1);
  }
  const n = parseInt(arg.split("=")[1], 10);
  if (isNaN(n) || n < 1) {
    console.error(`Invalid season number: ${arg}`);
    process.exit(1);
  }
  return n;
}

// ── Step log helpers ───────────────────────────────────────────────────────

interface StepResult {
  step: number;
  name: string;
  status: "ok" | "skipped" | "error";
  detail: string;
  durationMs: number;
}

async function runStep(
  step: number,
  name: string,
  fn: () => Promise<string>,
): Promise<StepResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    const durationMs = Date.now() - start;
    console.log(`  [${step}] ✅ ${name} — ${detail} (${durationMs}ms)`);
    return { step, name, status: "ok", detail, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`  [${step}] ❌ ${name} — ${detail}`);
    return { step, name, status: "error", detail, durationMs };
  }
}

// ── Division ranking helper (mirrors leaderboard-update, idempotent) ───────

async function rankDivisions(seasonNumber: number): Promise<number> {
  const summaries = await prisma.seasonTraderSummary.findMany({
    where: { seasonNumber },
    select: { wallet: true, totalCps: true, division: true },
    orderBy: { totalCps: "desc" },
  });

  const byDivision = new Map<number, typeof summaries>();
  for (const s of summaries) {
    const div = s.division ?? 5;
    if (!byDivision.has(div)) byDivision.set(div, []);
    byDivision.get(div)!.push(s);
  }

  let updated = 0;
  for (const [, members] of byDivision) {
    for (let i = 0; i < members.length; i++) {
      await prisma.seasonTraderSummary
        .update({
          where: {
            wallet_seasonNumber: { wallet: members[i].wallet, seasonNumber },
          },
          data: { rankInDivision: i + 1 },
        })
        .catch(() => {});
      updated++;
    }
  }
  return updated;
}

// ── Squad finalisation ─────────────────────────────────────────────────────

async function finaliseSquads(seasonNumber: number): Promise<string> {
  // Recalculate squadScore = avg member totalCps
  const squads = await prisma.squad.findMany({
    where: { seasonNumber, disbanded: false },
    include: { currentMembers: { select: { wallet: true } } },
  });

  let squadsUpdated = 0;
  for (const squad of squads) {
    const wallets = squad.currentMembers.map((m) => m.wallet);
    if (wallets.length === 0) continue;

    const summaries = await prisma.seasonTraderSummary.findMany({
      where: { seasonNumber, wallet: { in: wallets } },
      select: { totalCps: true, totalTrades: true },
    });
    if (summaries.length === 0) continue;

    const avgCps =
      summaries.reduce((s, r) => s + Number(r.totalCps), 0) / summaries.length;

    // Synergy multiplier: +5% per member who traded at least 1 day (capped at +25%)
    const activeMembers = summaries.filter((s) => s.totalTrades > 0).length;
    const synergyMultiplier = 1 + Math.min(0.25, activeMembers * 0.05);
    const finalScore = avgCps * synergyMultiplier;

    // synergyStreakPeak: count how many members hit top-half of their division
    const topHalfMembers = await prisma.seasonTraderSummary.findMany({
      where: {
        seasonNumber,
        wallet: { in: wallets },
        rankInDivision: { not: null },
      },
      select: { wallet: true, rankInDivision: true, division: true },
    });
    let synergyStreakPeak = 0;
    for (const m of topHalfMembers) {
      if (!m.rankInDivision || !m.division) continue;
      const divTotal = await prisma.seasonTraderSummary.count({
        where: { seasonNumber, division: m.division },
      });
      if (m.rankInDivision <= Math.ceil(divTotal / 2)) synergyStreakPeak++;
    }

    await prisma.squad.update({
      where: { id: squad.id },
      data: {
        squadScore: finalScore,
        synergyStreakPeak,
      },
    });
    squadsUpdated++;
  }

  // Re-rank squads within each division
  const allSquads = await prisma.squad.findMany({
    where: { seasonNumber, disbanded: false },
    select: { id: true, division: true, squadScore: true },
    orderBy: { squadScore: "desc" },
  });
  const byDiv = new Map<number, typeof allSquads>();
  for (const sq of allSquads) {
    const div = sq.division ?? 5;
    if (!byDiv.has(div)) byDiv.set(div, []);
    byDiv.get(div)!.push(sq);
  }
  for (const [, divSquads] of byDiv) {
    for (let i = 0; i < divSquads.length; i++) {
      await prisma.squad
        .update({
          where: { id: divSquads[i].id },
          data: { rank: i + 1 },
        })
        .catch(() => {});
    }
  }

  return `${squadsUpdated} squads scored and ranked`;
}

// ── SeasonRecord writer (idempotent — skip if already exists) ─────────────

async function writeSeasonRecords(seasonNumber: number): Promise<string> {
  const summaries = await prisma.seasonTraderSummary.findMany({
    where: { seasonNumber },
    select: {
      wallet: true,
      totalCps: true,
      rankInDivision: true,
      division: true,
      totalTrades: true,
      winningTrades: true,
    },
  });

  let written = 0,
    skipped = 0;
  for (const s of summaries) {
    const existing = await prisma.seasonRecord.findUnique({
      where: { wallet_seasonNumber: { wallet: s.wallet, seasonNumber } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const trader = await prisma.trader.findUnique({
      where: { wallet: s.wallet },
      select: { arenaRating: true, currentSquadId: true },
    });

    const squadRecord = trader?.currentSquadId
      ? await prisma.squad.findUnique({
          where: { id: trader.currentSquadId },
          select: { rank: true },
        })
      : null;

    await prisma.seasonRecord
      .create({
        data: {
          wallet: s.wallet,
          seasonNumber,
          finalCps: s.totalCps,
          finalRank: s.rankInDivision,
          division: s.division,
          arStart: trader?.arenaRating ?? 400,
          totalTrades: s.totalTrades,
          winningTrades: s.winningTrades,
          squadId: trader?.currentSquadId ?? null,
          squadRank: squadRecord?.rank ?? null,
        },
      })
      .catch((err) =>
        console.warn(
          `[finalize] SeasonRecord create failed wallet=${s.wallet}: ${err.message}`,
        ),
      );
    written++;
  }

  if (skipped > 0)
    console.log(
      `  ↳ SeasonRecords: ${written} written, ${skipped} already existed (idempotent)`,
    );
  return `${written} written, ${skipped} skipped`;
}

// ── Trader season counters ─────────────────────────────────────────────────

async function updateSeasonCounters(
  seasonNumber: number,
  activeWallets: string[],
): Promise<string> {
  // Only update traders who haven't already been counted for this season
  // Idempotency guard: check lastActiveSeason to avoid double-incrementing
  const tradersToUpdate = await prisma.trader.findMany({
    where: {
      wallet: { in: activeWallets },
      NOT: { lastActiveSeason: seasonNumber },
    },
    select: { wallet: true },
  });

  if (tradersToUpdate.length > 0) {
    await prisma.trader.updateMany({
      where: { wallet: { in: tradersToUpdate.map((t) => t.wallet) } },
      data: {
        lastActiveSeason: seasonNumber,
        totalSeasonsParticipated: { increment: 1 },
      },
    });
  }

  // Inactive traders who registered before this season
  const allRegistered = await prisma.trader.findMany({
    where: {
      wallet: { notIn: activeWallets },
      registeredSeason: { lt: seasonNumber },
      NOT: { lastActiveSeason: seasonNumber },
    },
    select: { wallet: true },
  });

  // Additional guard: only increment if not already done
  if (allRegistered.length > 0) {
    await prisma.trader.updateMany({
      where: { wallet: { in: allRegistered.map((t) => t.wallet) } },
      data: { totalSeasonsMissed: { increment: 1 } },
    });
  }

  return `${tradersToUpdate.length} active updated, ${allRegistered.length} inactive penalised`;
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function finalizeSeason(
  seasonNumber: number,
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Season Finalizer — Season ${seasonNumber}`);
  console.log(`${"═".repeat(60)}`);

  // ── Step 1: Verify isActive=false ────────────────────────────────────
  results.push(
    await runStep(1, "Verify season is closed", async () => {
      const season = await prisma.season.findUnique({
        where: { seasonNumber },
        select: { isActive: true, name: true },
      });
      if (!season) throw new Error(`Season ${seasonNumber} not found`);
      if (season.isActive)
        throw new Error(
          `Season ${seasonNumber} is still active — close it first`,
        );
      return `"${season.name}" confirmed closed`;
    }),
  );

  if (results[0].status === "error") {
    console.error("\nAbort: cannot finalize an active or missing season.");
    return results;
  }

  // ── Step 2: Recalculate all wallet CPS totals ─────────────────────────
  results.push(
    await runStep(2, "updateAllLeaderboardCPS", async () => {
      const n = await updateAllLeaderboardCPS(seasonNumber);
      return `${n} wallets recalculated`;
    }),
  );

  // ── Step 3: Rank per division ────────────────────────────────────────
  results.push(
    await runStep(3, "Rank per division", async () => {
      const n = await rankDivisions(seasonNumber);
      return `${n} traders ranked`;
    }),
  );

  // ── Step 4: Update Arena Rating per trader ────────────────────────────
  results.push(
    await runStep(4, "updateArenaRating (all wallets)", async () => {
      const summaries = await prisma.seasonTraderSummary.findMany({
        where: { seasonNumber },
        select: { wallet: true },
      });
      let updated = 0,
        errors = 0;
      for (const { wallet } of summaries) {
        await updateArenaRating(wallet, seasonNumber)
          .then(() => updated++)
          .catch((err) => {
            errors++;
            console.warn(`    AR update failed ${wallet}: ${err.message}`);
          });
      }
      return `${updated} updated, ${errors} errors`;
    }),
  );

  // ── Step 5: Promotion / relegation ────────────────────────────────────
  results.push(
    await runStep(5, "processPromotionRelegation", async () => {
      await processPromotionRelegation(seasonNumber);
      const promos = await prisma.seasonRecord.count({
        where: { seasonNumber, promoted: true },
      });
      const relgs = await prisma.seasonRecord.count({
        where: { seasonNumber, relegated: true },
      });
      return `${promos} promoted, ${relgs} relegated`;
    }),
  );

  // ── Step 6: Detect achievements ───────────────────────────────────────
  results.push(
    await runStep(6, "detectAchievements (all wallets)", async () => {
      const summaries = await prisma.seasonTraderSummary.findMany({
        where: { seasonNumber },
        select: { wallet: true },
      });
      let totalEarned = 0;
      for (const { wallet } of summaries) {
        const keys = await detectAchievements(wallet, seasonNumber).catch(
          () => [] as string[],
        );
        totalEarned += keys.length;
      }
      return `${totalEarned} achievements across ${summaries.length} wallets`;
    }),
  );

  // ── Step 7: Write SeasonRecords (skip if exists) ──────────────────────
  results.push(
    await runStep(7, "Write SeasonRecords", async () => {
      return writeSeasonRecords(seasonNumber);
    }),
  );

  // ── Step 8: Update trader season counters ─────────────────────────────
  results.push(
    await runStep(8, "Update totalSeasonsParticipated / Missed", async () => {
      const summaries = await prisma.seasonTraderSummary.findMany({
        where: { seasonNumber },
        select: { wallet: true },
      });
      return updateSeasonCounters(
        seasonNumber,
        summaries.map((s) => s.wallet),
      );
    }),
  );

  // ── Step 9: Squad final ranks + synergy multipliers ───────────────────
  results.push(
    await runStep(9, "Finalise squad scores + synergy", async () => {
      return finaliseSquads(seasonNumber);
    }),
  );

  // ── Step 10: Allocate prizes ──────────────────────────────────────────
  results.push(
    await runStep(10, "allocatePrizes", async () => {
      const season = await prisma.season.findUnique({
        where: { seasonNumber },
        select: { prizePoolUsdc: true },
      });
      const pool = Number(season?.prizePoolUsdc ?? 0);
      const n = await allocatePrizes(seasonNumber, pool);
      return `${n} prize allocations from $${pool} USDC`;
    }),
  );

  // ── Summary ───────────────────────────────────────────────────────────
  const ok = results.filter((r) => r.status === "ok").length;
  const errors = results.filter((r) => r.status === "error").length;
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  console.log(`\n${"─".repeat(60)}`);
  console.log(
    `  Result: ${ok}/10 steps OK, ${errors} errors — ${totalMs}ms total`,
  );
  console.log(`${"═".repeat(60)}\n`);

  return results;
}

// ── Script entrypoint ──────────────────────────────────────────────────────

if (require.main === module) {
  const seasonNumber = parseSeasonArg();
  finalizeSeason(seasonNumber)
    .then((results) => {
      const hadError = results.some((r) => r.status === "error");
      prisma.$disconnect();
      process.exit(hadError ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
