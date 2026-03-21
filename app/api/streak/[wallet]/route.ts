// src/app/api/streak/[wallet]/route.ts
// GET /api/streak/:wallet — public
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  if (!wallet)
    return NextResponse.json(
      { ok: false, error: "Wallet required" },
      { status: 400 },
    );

  const streak = await prisma.streak.findUnique({
    where: { wallet },
    select: { streakDays: true, lastStreakDate: true, updatedAt: true },
  });

  if (!streak) {
    return NextResponse.json({
      ok: true,
      wallet,
      streakDays: 0,
      lastStreakDate: null,
      active: false,
    });
  }

  // Active = last trade was today or yesterday
  const lastDate = streak.lastStreakDate?.toISOString().slice(0, 10) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const active = lastDate === today || lastDate === yesterday;

  return NextResponse.json({ ok: true, wallet, ...streak, active });
}
