// lib/squad.ts — Squad lifecycle management

import { prisma } from "./prisma";
import { getActiveSeason, getSeasonDay, isSquadLockDay } from "./season";
import type { Squad } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateSquadParams {
  creatorWallet: string;
  name: string;
  seasonNumber: number;
}

export interface JoinSquadParams {
  wallet: string;
  squadId: number;
}

export class SquadError extends Error {
  constructor(
    public code: string,
    msg: string,
  ) {
    super(msg);
    this.name = "SquadError";
  }
}

const MAX_SQUAD_SIZE = 5;
const NAME_MIN = 3;
const NAME_MAX = 32;

// ── Validation helpers ─────────────────────────────────────────────────────

function validateName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    throw new SquadError(
      "INVALID_NAME",
      `Squad name must be ${NAME_MIN}–${NAME_MAX} characters (got ${trimmed.length})`,
    );
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
    throw new SquadError(
      "INVALID_NAME",
      "Squad name may only contain letters, numbers, spaces, _ and -",
    );
  }
}

async function assertNotInSquad(
  wallet: string,
  seasonNumber: number,
): Promise<void> {
  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: { currentSquadId: true },
  });
  if (!trader) throw new SquadError("NOT_FOUND", `Trader not found: ${wallet}`);

  if (trader.currentSquadId != null) {
    const sq = await prisma.squad.findUnique({
      where: { id: trader.currentSquadId },
      select: { seasonNumber: true, name: true },
    });
    if (sq?.seasonNumber === seasonNumber) {
      throw new SquadError(
        "ALREADY_IN_SQUAD",
        `Wallet ${wallet} is already in squad "${sq.name}" this season`,
      );
    }
  }
}

async function assertNotLocked(
  squad: Pick<Squad, "isLocked" | "id">,
): Promise<void> {
  if (squad.isLocked) {
    throw new SquadError(
      "SQUAD_LOCKED",
      `Squad ${squad.id} is locked and cannot be modified`,
    );
  }
}

async function assertSeasonNotPastLockDay(
  season: Awaited<ReturnType<typeof getActiveSeason>>,
): Promise<void> {
  if (getSeasonDay(season) > 3) {
    throw new SquadError(
      "PAST_LOCK_DAY",
      "Squads cannot be created or modified after Day 3 of the season",
    );
  }
}

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * Create a new squad for the given season.
 * Creator is automatically added as the first member.
 */
export async function createSquad(params: CreateSquadParams): Promise<Squad> {
  const { creatorWallet, name, seasonNumber } = params;
  const trimmedName = name.trim();

  // Validate name format
  validateName(trimmedName);

  // Season must be active
  const season = await getActiveSeason();
  if (season.seasonNumber !== seasonNumber) {
    throw new SquadError(
      "SEASON_MISMATCH",
      `Season ${seasonNumber} is not the active season`,
    );
  }

  // Must be before lock day
  await assertSeasonNotPastLockDay(season);

  // Creator must not already be in a squad this season
  await assertNotInSquad(creatorWallet, seasonNumber);

  // Resolve creator's division
  const creator = await prisma.trader.findUnique({
    where: { wallet: creatorWallet },
    select: { currentDivision: true },
  });
  if (!creator)
    throw new SquadError("NOT_FOUND", `Trader not found: ${creatorWallet}`);

  // Name uniqueness within season (prisma will throw on @@unique violation, but give a friendly error)
  const nameConflict = await prisma.squad.findFirst({
    where: { seasonNumber, name: trimmedName },
  });
  if (nameConflict) {
    throw new SquadError(
      "NAME_TAKEN",
      `A squad named "${trimmedName}" already exists this season`,
    );
  }

  // Create squad + first member + update trader in a transaction
  const squad = await prisma.$transaction(async (tx) => {
    const sq = await tx.squad.create({
      data: {
        seasonNumber,
        name: trimmedName,
        creatorWallet,
        division: creator.currentDivision,
        isLocked: false,
        disbanded: false,
      },
    });

    await tx.squadMember.create({
      data: { squadId: sq.id, wallet: creatorWallet },
    });

    await tx.trader.update({
      where: { wallet: creatorWallet },
      data: { currentSquadId: sq.id },
    });

    return sq;
  });

  console.log(
    `[squad] created squad ${squad.id} "${trimmedName}" season=${seasonNumber} creator=${creatorWallet}`,
  );
  return squad;
}

// ── Join ───────────────────────────────────────────────────────────────────

/**
 * Join an existing squad.
 * Anti-sybil: wallet must have ≥1 lifetime closed position.
 */
export async function joinSquad(params: JoinSquadParams): Promise<void> {
  const { wallet, squadId } = params;

  // Anti-sybil: must have at least 1 closed position in history
  const closedCount = await prisma.positionCache.count({
    where: { wallet, status: "closed" },
  });
  if (closedCount === 0) {
    throw new SquadError(
      "ANTI_SYBIL",
      "Wallet must have at least one closed trading position before joining a squad",
    );
  }

  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: { members: true },
  });
  if (!squad) throw new SquadError("NOT_FOUND", `Squad ${squadId} not found`);
  if (squad.disbanded)
    throw new SquadError("DISBANDED", `Squad ${squadId} is disbanded`);

  // Squad must not be locked
  await assertNotLocked(squad);

  // Season lock day check
  const season = await getActiveSeason();
  if (season.seasonNumber !== squad.seasonNumber) {
    throw new SquadError(
      "SEASON_MISMATCH",
      "Squad is not in the active season",
    );
  }
  await assertSeasonNotPastLockDay(season);

  // Size check
  if (squad.members.length >= MAX_SQUAD_SIZE) {
    throw new SquadError(
      "SQUAD_FULL",
      `Squad "${squad.name}" is full (max ${MAX_SQUAD_SIZE} members)`,
    );
  }

  // Wallet must not already be in a squad this season
  await assertNotInSquad(wallet, squad.seasonNumber);

  // Add member + update trader + recalculate division in a transaction
  const allMemberWallets = [...squad.members.map((m) => m.wallet), wallet];
  const memberDivisions = await prisma.trader.findMany({
    where: { wallet: { in: allMemberWallets } },
    select: { currentDivision: true },
  });
  const newDivision = Math.min(
    ...memberDivisions.map((m) => m.currentDivision),
  );

  await prisma.$transaction(async (tx) => {
    await tx.squadMember.create({ data: { squadId, wallet } });
    await tx.trader.update({
      where: { wallet },
      data: { currentSquadId: squadId },
    });
    await tx.squad.update({
      where: { id: squadId },
      data: { division: newDivision },
    });
  });

  console.log(
    `[squad] ${wallet} joined squad ${squadId} "${squad.name}" — division now ${newDivision}`,
  );
}

// ── Leave ──────────────────────────────────────────────────────────────────

/**
 * Remove a wallet from their current squad.
 * If the squad becomes empty: set disbanded=true.
 */
export async function leaveSquad(wallet: string): Promise<void> {
  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: { currentSquadId: true },
  });
  if (!trader?.currentSquadId) {
    throw new SquadError(
      "NOT_IN_SQUAD",
      `Wallet ${wallet} is not in any squad`,
    );
  }

  const squadId = trader.currentSquadId;
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: { members: true },
  });
  if (!squad) throw new SquadError("NOT_FOUND", `Squad ${squadId} not found`);

  await assertNotLocked(squad);

  const remainingMembers = squad.members.filter((m) => m.wallet !== wallet);

  await prisma.$transaction(async (tx) => {
    await tx.squadMember.deleteMany({ where: { squadId, wallet } });
    await tx.trader.update({
      where: { wallet },
      data: { currentSquadId: null },
    });

    if (remainingMembers.length === 0) {
      await tx.squad.update({
        where: { id: squadId },
        data: { disbanded: true },
      });
      console.log(`[squad] squad ${squadId} disbanded — last member left`);
    } else {
      // Recalculate division with remaining members
      const divisions = await tx.trader.findMany({
        where: { wallet: { in: remainingMembers.map((m) => m.wallet) } },
        select: { currentDivision: true },
      });
      const newDivision = Math.min(...divisions.map((d) => d.currentDivision));
      await tx.squad.update({
        where: { id: squadId },
        data: { division: newDivision },
      });
    }
  });

  console.log(`[squad] ${wallet} left squad ${squadId}`);
}

// ── Score recalculation ────────────────────────────────────────────────────

/**
 * Recalculate squadScore = SUM of member totalCps for the active season.
 */
export async function recalculateSquadScore(squadId: number): Promise<void> {
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    select: { seasonNumber: true, disbanded: true },
    include: { currentMembers: { select: { wallet: true } } },
  } as Parameters<typeof prisma.squad.findUnique>[0]);

  const sq = squad as
    | (typeof squad & { currentMembers: { wallet: string }[] })
    | null;
  if (!sq || sq.disbanded) return;

  const wallets = sq.currentMembers.map((m) => m.wallet);
  if (wallets.length === 0) return;

  const summaries = await prisma.seasonTraderSummary.findMany({
    where: { seasonNumber: sq.seasonNumber, wallet: { in: wallets } },
    select: { totalCps: true },
  });

  const totalCps = summaries.reduce((sum, s) => sum + Number(s.totalCps), 0);

  await prisma.squad.update({
    where: { id: squadId },
    data: { squadScore: totalCps },
  });
}

/**
 * Recalculate scores for all non-disbanded squads in a season.
 * Returns count updated.
 */
export async function recalculateAllSquadScores(
  seasonNumber: number,
): Promise<number> {
  const squads = await prisma.squad.findMany({
    where: { seasonNumber, disbanded: false },
    select: { id: true },
  });

  let updated = 0;
  for (const { id } of squads) {
    await recalculateSquadScore(id).catch((err) =>
      console.error(`[squad] recalculate score failed squadId=${id}:`, err),
    );
    updated++;
  }

  return updated;
}
