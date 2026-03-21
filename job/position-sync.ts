// jobs/position-sync.ts — scoring engine heartbeat, runs every 60 seconds

import { prisma } from "@/lib/prisma";
import { getPositions, type AdrenaPosition } from "../lib/adrena";
import { scorePosition } from "../lib/scoring";
import { getActiveSeason } from "../lib/season";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  walletsChecked: number;
  newClosures: number;
  errors: number;
}

interface ValidationFailure {
  reason: string;
  positionId: number;
  wallet: string;
}

// ── Module-level consecutive failure tracker ───────────────────────────────
// Keyed by wallet. Resets to 0 on any success for that wallet.
const consecutiveFailures = new Map<string, number>();
const MAX_CONSECUTIVE_FAILURES = 5;

// ── Helpers ────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate a closed position before scoring.
 * Returns a ValidationFailure if invalid, null if valid.
 */
function validatePosition(pos: AdrenaPosition): ValidationFailure | null {
  const fail = (reason: string): ValidationFailure => ({
    reason,
    positionId: pos.position_id,
    wallet: pos.wallet,
  });

  // pnl must not be null to score
  if (pos.pnl === null) {
    return fail("pnl is null — unresolved position");
  }

  // Minimum hold time: 60 seconds
  if (pos.entry_date && pos.exit_date) {
    const holdMs =
      new Date(pos.exit_date).getTime() - new Date(pos.entry_date).getTime();
    if (holdMs < 60_000) {
      return fail(`hold time ${holdMs}ms < 60s — flash trade filter`);
    }
  }

  // Minimum collateral
  if (pos.collateral_amount !== null && pos.collateral_amount < 100) {
    return fail(
      `collateralAmount ${pos.collateral_amount} < 100 — dust filter`,
    );
  }

  // Max leverage cap
  if (pos.entry_leverage !== null && pos.entry_leverage > 50) {
    return fail(`entryLeverage ${pos.entry_leverage} > 50 — leverage cap`);
  }

  return null;
}

// ── Per-wallet processing ──────────────────────────────────────────────────

async function processWallet(
  wallet: string,
  activeSeason: { seasonNumber: number },
): Promise<{ newClosures: number; error: boolean }> {
  try {
    const positions = await getPositions(wallet, 100);
    let newClosures = 0;

    for (const pos of positions) {
      // Always upsert the cache so we have a fresh snapshot
      const existing = await prisma.positionCache.findUnique({
        where: { positionId: pos.position_id },
        select: { status: true },
      });

      await prisma.positionCache.upsert({
        where: { positionId: pos.position_id },
        create: {
          positionId: pos.position_id,
          wallet: pos.wallet,
          seasonNumber: activeSeason.seasonNumber,
          symbol: pos.symbol,
          side: pos.side,
          status: pos.status,
          entryPrice: pos.entry_price,
          exitPrice: pos.exit_price,
          entrySize: pos.entry_size,
          pnl: pos.pnl,
          entryLeverage: pos.entry_leverage,
          entryDate: pos.entry_date ? new Date(pos.entry_date) : null,
          exitDate: pos.exit_date ? new Date(pos.exit_date) : null,
          fees: pos.fees,
          collateralAmount: pos.collateral_amount,
          lastSyncedAt: new Date(),
        },
        update: {
          status: pos.status,
          exitPrice: pos.exit_price,
          pnl: pos.pnl,
          exitDate: pos.exit_date ? new Date(pos.exit_date) : null,
          fees: pos.fees,
          lastSyncedAt: new Date(),
        },
      });

      // Detect new closure:
      // position is now closed with exitDate set AND was previously open (or unseen)
      const isNewlyClosed =
        pos.status === "closed" &&
        pos.exit_date !== null &&
        (existing === null || existing.status === "open");

      if (!isNewlyClosed) continue;

      // Validate before scoring
      const failure = validatePosition(pos);
      if (failure) {
        console.warn(
          `[position-sync] skip positionId=${failure.positionId} wallet=${failure.wallet}: ${failure.reason}`,
        );
        continue;
      }

      // Score the position
      try {
        await scorePosition(pos, activeSeason.seasonNumber);
        newClosures++;
      } catch (scoringErr) {
        console.error(
          `[position-sync] scoring failed positionId=${pos.position_id} wallet=${wallet}:`,
          scoringErr,
        );
      }
    }

    // Success — reset consecutive failure counter
    consecutiveFailures.set(wallet, 0);
    return { newClosures, error: false };
  } catch (err) {
    const prev = consecutiveFailures.get(wallet) ?? 0;
    const next = prev + 1;
    consecutiveFailures.set(wallet, next);

    const level = next >= MAX_CONSECUTIVE_FAILURES ? "error" : "warn";
    console[level](
      `[position-sync] wallet=${wallet} failed (${next} consecutive):`,
      err instanceof Error ? err.message : err,
    );

    return { newClosures: 0, error: true };
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export async function runSync(): Promise<SyncResult> {
  const startedAt = Date.now();
  let walletsChecked = 0;
  let newClosures = 0;
  let errors = 0;

  // Resolve active season once per sync run
  let activeSeason: { seasonNumber: number };
  try {
    activeSeason = await getActiveSeason();
  } catch (err) {
    console.error("[position-sync] no active season — aborting sync:", err);
    return { walletsChecked: 0, newClosures: 0, errors: 1 };
  }

  // 1. Fetch all registered wallets
  const traders = await prisma.trader.findMany({ select: { wallet: true } });
  const wallets = traders.map((t) => t.wallet);

  // 2. Chunk into groups of 10, pause 100ms between chunks
  const chunks = chunkArray(wallets, 10);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Process all wallets in this chunk concurrently
    const results = await Promise.all(
      chunk.map((wallet) => processWallet(wallet, activeSeason)),
    );

    for (const r of results) {
      walletsChecked++;
      newClosures += r.newClosures;
      if (r.error) errors++;
    }

    // Pause between chunks (skip after last chunk)
    if (i < chunks.length - 1) {
      await sleep(100);
    }
  }

  const elapsed = Date.now() - startedAt;
  console.log(
    `[position-sync] done in ${elapsed}ms — wallets=${walletsChecked} newClosures=${newClosures} errors=${errors}`,
  );

  return { walletsChecked, newClosures, errors };
}
