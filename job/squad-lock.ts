// jobs/squad-lock.ts — Lock all squads when season day >= 7
// Vercel Cron: hourly ("0 * * * *")
//
// Idempotent: updateMany only touches squads where isLocked=false.

import { prisma } from "../lib/prisma";
import { getActiveSeason, getSeasonDay } from "../lib/season";

export interface SquadLockResult {
  seasonNumber: number;
  seasonDay: number;
  squadsLocked: number;
  alreadyLocked: number;
  skipped: boolean; // true if day < 7
}

export async function runSquadLock(): Promise<SquadLockResult> {
  let season: Awaited<ReturnType<typeof getActiveSeason>>;
  try {
    season = await getActiveSeason();
  } catch {
    console.warn("[squad-lock] no active season — skipping");
    return {
      seasonNumber: 0,
      seasonDay: 0,
      squadsLocked: 0,
      alreadyLocked: 0,
      skipped: true,
    };
  }

  const { seasonNumber } = season;
  const day = getSeasonDay(season);

  if (day < 7) {
    return {
      seasonNumber,
      seasonDay: day,
      squadsLocked: 0,
      alreadyLocked: 0,
      skipped: true,
    };
  }

  // Count already-locked squads for the report
  const alreadyLocked = await prisma.squad.count({
    where: { seasonNumber, isLocked: true, disbanded: false },
  });

  // Lock all unlocked, non-disbanded squads in this season
  const { count } = await prisma.squad.updateMany({
    where: { seasonNumber, isLocked: false, disbanded: false },
    data: { isLocked: true },
  });

  if (count > 0) {
    console.log(
      `[squad-lock] day=${day} season=${seasonNumber}: locked ${count} squads`,
    );
  }

  return {
    seasonNumber,
    seasonDay: day,
    squadsLocked: count,
    alreadyLocked,
    skipped: false,
  };
}
