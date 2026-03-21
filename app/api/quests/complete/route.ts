// src/app/api/quests/complete/route.ts
// POST /api/quests/complete — X-Adrena-Secret webhook
// Called by the Adrena protocol when a user completes an on-chain quest.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSeason } from "@/lib/season";

function webhookAuth(req: NextRequest): boolean {
  return (
    req.headers.get("X-Adrena-Secret") === process.env.ADRENA_WEBHOOK_SECRET
  );
}

export async function POST(req: NextRequest) {
  if (!webhookAuth(req)) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { wallet, questId, questType } = body as Record<string, unknown>;

  if (typeof wallet !== "string" || !wallet)
    return NextResponse.json(
      { ok: false, error: "wallet required" },
      { status: 400 },
    );
  if (typeof questId !== "string" || !questId)
    return NextResponse.json(
      { ok: false, error: "questId required" },
      { status: 400 },
    );
  if (typeof questType !== "string" || !questType)
    return NextResponse.json(
      { ok: false, error: "questType required" },
      { status: 400 },
    );

  let seasonNumber: number;
  try {
    const season = await getActiveSeason();
    seasonNumber = season.seasonNumber;
  } catch {
    return NextResponse.json(
      { ok: false, error: "No active season" },
      { status: 404 },
    );
  }

  // Ensure trader exists
  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: { wallet: true },
  });
  if (!trader)
    return NextResponse.json(
      { ok: false, error: "Trader not found" },
      { status: 404 },
    );

  // Idempotent — @@id([wallet, seasonNumber, questId]) prevents duplicates
  try {
    await prisma.questCompletion.create({
      data: { wallet, seasonNumber, questId, questType },
    });
  } catch {
    // P2002 unique constraint = already recorded; treat as success
  }

  console.log(
    `[quests] completed wallet=${wallet} questId=${questId} season=${seasonNumber}`,
  );
  return NextResponse.json({ ok: true, wallet, questId, seasonNumber });
}
