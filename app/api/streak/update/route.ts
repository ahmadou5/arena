// src/app/api/streak/update/route.ts
// POST /api/streak/update — X-Adrena-Secret webhook
// Called when a wallet closes a position; updates their streak.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function webhookAuth(req: NextRequest): boolean {
  return (
    req.headers.get("X-Adrena-Secret") === process.env.ADRENA_WEBHOOK_SECRET
  );
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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

  const { wallet } = body as Record<string, unknown>;
  if (typeof wallet !== "string" || !wallet)
    return NextResponse.json(
      { ok: false, error: "wallet required" },
      { status: 400 },
    );

  const trader = await prisma.trader.findUnique({
    where: { wallet },
    select: { wallet: true },
  });
  if (!trader)
    return NextResponse.json(
      { ok: false, error: "Trader not found" },
      { status: 404 },
    );

  const today = todayUTC();
  const yesterday = yesterdayUTC();

  const existing = await prisma.streak.findUnique({
    where: { wallet },
    select: { streakDays: true, lastStreakDate: true },
  });

  let newStreak: number;
  const lastDate = existing?.lastStreakDate?.toISOString().slice(0, 10) ?? null;

  if (lastDate === today) {
    // Already updated today — no change
    return NextResponse.json({
      ok: true,
      wallet,
      streakDays: existing!.streakDays,
      updated: false,
    });
  } else if (lastDate === yesterday) {
    // Consecutive day — extend
    newStreak = (existing?.streakDays ?? 0) + 1;
  } else {
    // Gap — reset
    newStreak = 1;
  }

  await prisma.streak.upsert({
    where: { wallet },
    create: { wallet, streakDays: newStreak, lastStreakDate: new Date() },
    update: { streakDays: newStreak, lastStreakDate: new Date() },
  });

  return NextResponse.json({
    ok: true,
    wallet,
    streakDays: newStreak,
    updated: true,
  });
}
