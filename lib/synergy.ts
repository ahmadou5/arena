// lib/synergy.ts — Squad synergy detection and multiplier calculation

import { prisma } from "./prisma";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SynergyResult {
  questSynergy: boolean;
  streakSynergy: boolean;
  multiplier: number; // 1.0 base + 0.05 quest + 0.10 streak
  questWeeksCount: number; // number of weeks all members completed a quest
  streakPeak: number; // longest run of consecutive all-member trading days
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns ISO week string "YYYY-WNN" for a given date */
function isoWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  // Thursday-based ISO week
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Returns ISO date string "YYYY-MM-DD" for a given date */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getSquadMemberWallets(squadId: number): Promise<string[]> {
  const members = await prisma.squadMember.findMany({
    where: { squadId },
    select: { wallet: true },
  });
  return members.map((m) => m.wallet);
}

// ── Quest synergy ──────────────────────────────────────────────────────────

/**
 * Detect ISO weeks in which ALL squad members completed at least one quest.
 *
 * A "quest synergy week" = a week where every current member has a
 * QuestCompletion row with completedAt falling inside that week.
 *
 * Returns the count of synergy weeks found.
 */
export async function detectQuestSynergy(
  squadId: number,
  seasonNumber: number,
): Promise<number> {
  const wallets = await getSquadMemberWallets(squadId);
  if (wallets.length === 0) return 0;

  // Fetch all quest completions for squad members this season
  const completions = await prisma.questCompletion.findMany({
    where: { wallet: { in: wallets }, seasonNumber },
    select: { wallet: true, completedAt: true },
  });

  if (completions.length === 0) return 0;

  // Group completion weeks per wallet
  const walletWeeks = new Map<string, Set<string>>();
  for (const w of wallets) walletWeeks.set(w, new Set());

  for (const c of completions) {
    walletWeeks.get(c.wallet)?.add(isoWeek(c.completedAt));
  }

  // Find weeks present in ALL wallets' sets
  const firstSet = walletWeeks.get(wallets[0])!;
  let synergyWeeks = 0;
  for (const week of firstSet) {
    if (wallets.every((w) => walletWeeks.get(w)?.has(week))) {
      synergyWeeks++;
    }
  }

  return synergyWeeks;
}

// ── Streak synergy ─────────────────────────────────────────────────────────

/**
 * Find the longest streak of consecutive calendar days in which ALL squad
 * members made at least one trade (closed a position).
 *
 * Returns the length of the longest such streak (0 if none).
 * Synergy fires if the peak streak >= 7 days.
 */
export async function detectStreakSynergy(
  squadId: number,
  seasonNumber: number,
): Promise<number> {
  const wallets = await getSquadMemberWallets(squadId);
  if (wallets.length === 0) return 0;

  // Fetch all closed positions for squad members this season
  const positions = await prisma.positionCache.findMany({
    where: {
      wallet: { in: wallets },
      seasonNumber,
      status: "closed",
      exitDate: { not: null },
    },
    select: { wallet: true, exitDate: true },
  });

  if (positions.length === 0) return 0;

  // Build set of trade dates per wallet
  const walletDays = new Map<string, Set<string>>();
  for (const w of wallets) walletDays.set(w, new Set());

  for (const p of positions) {
    if (p.exitDate) {
      walletDays.get(p.wallet)?.add(isoDate(p.exitDate));
    }
  }

  // Find all dates where every member traded
  const allDates = new Set<string>();
  for (const [, days] of walletDays) {
    for (const d of days) allDates.add(d);
  }

  const sharedDates = Array.from(allDates)
    .filter((d) => wallets.every((w) => walletDays.get(w)?.has(d)))
    .sort();

  if (sharedDates.length === 0) return 0;

  // Find longest consecutive run in sharedDates
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sharedDates.length; i++) {
    const prev = new Date(sharedDates[i - 1]);
    const curr = new Date(sharedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

// ── Combined multiplier ────────────────────────────────────────────────────

/**
 * Calculate the full synergy multiplier for a squad this season.
 *
 * multiplier = 1.0
 *            + (questSynergy  ? 0.05 : 0)   // any synergy quest weeks
 *            + (streakSynergy ? 0.10 : 0)   // peak streak >= 7 days
 *
 * Also persists synergyQuestWeeks and synergyStreakPeak to the Squad row.
 */
export async function calculateSynergyMultiplier(
  squadId: number,
  seasonNumber: number,
): Promise<SynergyResult> {
  const [questWeeksCount, streakPeak] = await Promise.all([
    detectQuestSynergy(squadId, seasonNumber),
    detectStreakSynergy(squadId, seasonNumber),
  ]);

  const questSynergy = questWeeksCount > 0;
  const streakSynergy = streakPeak >= 7;

  const multiplier =
    1.0 + (questSynergy ? 0.05 : 0) + (streakSynergy ? 0.1 : 0);

  // Persist to Squad row for leaderboard / finalization queries
  await prisma.squad.update({
    where: { id: squadId },
    data: {
      synergyQuestWeeks: questWeeksCount,
      synergyStreakPeak: streakPeak,
    },
  });

  return {
    questSynergy,
    streakSynergy,
    multiplier,
    questWeeksCount,
    streakPeak,
  };
}
