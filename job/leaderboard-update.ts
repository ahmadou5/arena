// jobs/leaderboard-update.ts — leaderboard recalculation, runs every 5 minutes

import { prisma } from '../lib/prisma'
import { updateAllLeaderboardCPS } from '../lib/scoring'
import { getActiveSeason } from '../lib/season'

export interface LeaderboardUpdateResult {
  walletsUpdated: number
  squadsUpdated: number
  day14Snapshot: boolean
  errors: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the integer day of the season (1-indexed), or null if out of range. */
function seasonDay(startTs: Date): number {
  const elapsed = Date.now() - startTs.getTime()
  return Math.floor(elapsed / 86_400_000) + 1
}

// ── Per-division ranking ───────────────────────────────────────────────────

async function rankDivisions(
  seasonNumber: number,
  day: number,
): Promise<{ day14Snapshot: boolean; errors: number }> {
  let errors = 0
  let day14Snapshot = false

  // Fetch all summaries for this season, ordered by totalCps desc
  const summaries = await prisma.seasonTraderSummary.findMany({
    where:   { seasonNumber },
    select:  { wallet: true, totalCps: true, division: true },
    orderBy: { totalCps: 'desc' },
  })

  // Group by division
  const byDivision = new Map<number, typeof summaries>()
  for (const s of summaries) {
    const div = s.division ?? 5
    if (!byDivision.has(div)) byDivision.set(div, [])
    byDivision.get(div)!.push(s)
  }

  // Assign rankInDivision within each division group
  for (const [, members] of byDivision) {
    // Already ordered desc by totalCps from the query
    for (let i = 0; i < members.length; i++) {
      const { wallet } = members[i]
      const rank = i + 1

      try {
        const updateData: {
          rankInDivision: number
          rankAtDay14?: number
        } = { rankInDivision: rank }

        // Day 14 snapshot: copy current rank to rankAtDay14
        if (day === 14) {
          updateData.rankAtDay14 = rank
          day14Snapshot = true
        }

        await prisma.seasonTraderSummary.update({
          where:  { wallet_seasonNumber: { wallet, seasonNumber } },
          data:   updateData,
        })
      } catch (err) {
        console.error(`[leaderboard] rank update failed wallet=${wallet}:`, err)
        errors++
      }
    }
  }

  if (day14Snapshot) {
    console.log(`[leaderboard] Day 14 snapshot captured for season ${seasonNumber}`)
  }

  return { day14Snapshot, errors }
}

// ── Squad score recalculation ──────────────────────────────────────────────

async function recalculateSquadScores(seasonNumber: number): Promise<number> {
  const squads = await prisma.squad.findMany({
    where:   { seasonNumber, disbanded: false },
    include: { currentMembers: { select: { wallet: true } } },
  })

  let updated = 0
  for (const squad of squads) {
    if (squad.currentMembers.length === 0) continue

    try {
      // Squad score = average of member totalCps
      const summaries = await prisma.seasonTraderSummary.findMany({
        where:  {
          seasonNumber,
          wallet: { in: squad.currentMembers.map(m => m.wallet) },
        },
        select: { totalCps: true },
      })

      if (summaries.length === 0) continue

      const avgCps =
        summaries.reduce((sum, s) => sum + Number(s.totalCps), 0) /
        summaries.length

      await prisma.squad.update({
        where: { id: squad.id },
        data:  { squadScore: avgCps },
      })
      updated++
    } catch (err) {
      console.error(`[leaderboard] squad score failed squadId=${squad.id}:`, err)
    }
  }

  // Re-rank squads within each division by squadScore desc
  const allSquads = await prisma.squad.findMany({
    where:   { seasonNumber, disbanded: false },
    select:  { id: true, division: true, squadScore: true },
    orderBy: { squadScore: 'desc' },
  })

  const squadsByDiv = new Map<number, typeof allSquads>()
  for (const sq of allSquads) {
    const div = sq.division ?? 5
    if (!squadsByDiv.has(div)) squadsByDiv.set(div, [])
    squadsByDiv.get(div)!.push(sq)
  }

  for (const [, divSquads] of squadsByDiv) {
    for (let i = 0; i < divSquads.length; i++) {
      await prisma.squad.update({
        where: { id: divSquads[i].id },
        data:  { rank: i + 1 },
      }).catch(() => {})
    }
  }

  return updated
}

// ── Main export ────────────────────────────────────────────────────────────

export async function runLeaderboardUpdate(): Promise<LeaderboardUpdateResult> {
  const startedAt = Date.now()

  let season: Awaited<ReturnType<typeof getActiveSeason>>
  try {
    season = await getActiveSeason()
  } catch {
    console.error('[leaderboard] no active season — aborting')
    return { walletsUpdated: 0, squadsUpdated: 0, day14Snapshot: false, errors: 1 }
  }

  const { seasonNumber, startTs } = season
  const day = seasonDay(startTs)

  // 1. Recalculate all wallet CPS totals
  const walletsUpdated = await updateAllLeaderboardCPS(seasonNumber)

  // 2. Rank within each division, handle Day 14 snapshot
  const { day14Snapshot, errors: rankErrors } = await rankDivisions(seasonNumber, day)

  // 3. Recalculate + re-rank squad scores
  const squadsUpdated = await recalculateSquadScores(seasonNumber)

  const elapsed = Date.now() - startedAt
  console.log(
    `[leaderboard] done in ${elapsed}ms — ` +
    `wallets=${walletsUpdated} squads=${squadsUpdated} ` +
    `day=${day} day14Snapshot=${day14Snapshot} errors=${rankErrors}`,
  )

  return {
    walletsUpdated,
    squadsUpdated,
    day14Snapshot,
    errors: rankErrors,
  }
}