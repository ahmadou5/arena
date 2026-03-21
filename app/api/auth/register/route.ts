// app/api/auth/register/route.ts
// POST /api/auth/register — verify Solana wallet signature and issue JWT

import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { prisma } from "@/lib/prisma";
import { signJWT } from "@/lib/auth";
import { getActiveSeason } from "@/lib/season";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const { wallet, signedMessage, message } = body as Record<string, unknown>;

  if (typeof wallet !== "string" || !wallet.trim())
    return bad("wallet is required");
  if (typeof signedMessage !== "string" || !signedMessage.trim())
    return bad("signedMessage is required");
  if (typeof message !== "string" || !message.trim())
    return bad("message is required");

  // ── 1. Verify Solana ed25519 signature ────────────────────────────────
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signedMessage);
    const publicKeyBytes = bs58.decode(wallet);

    const valid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );
    if (!valid) {
      return bad("Signature verification failed", 401);
    }
  } catch {
    return bad("Invalid signature or wallet encoding", 401);
  }

  // ── 2. Extract nonce from message, validate + mark used ───────────────
  // Expected message format: "Arena Protocol login\nNonce: <nonce>\nWallet: <wallet>"
  const nonceMatch = message.match(/Nonce:\s*([A-Za-z0-9]{8})/);
  if (!nonceMatch) {
    return bad("Message does not contain a valid nonce");
  }
  const nonceValue = nonceMatch[1];

  const nonce = await prisma.nonce.findUnique({ where: { value: nonceValue } });
  if (!nonce) {
    return bad("Nonce not found", 401);
  }
  if (nonce.used) {
    return bad("Nonce already used", 401);
  }
  if (nonce.expiresAt < new Date()) {
    return bad("Nonce expired", 401);
  }

  // Mark nonce used (do this before creating trader to prevent replay on DB error)
  await prisma.nonce.update({
    where: { value: nonceValue },
    data: { used: true },
  });

  // ── 3. Upsert trader ──────────────────────────────────────────────────
  let registeredSeason: number | null = null;
  try {
    const activeSeason = await getActiveSeason();
    registeredSeason = activeSeason.seasonNumber;
  } catch {
    // No active season — register without season association
  }

  const trader = await prisma.trader.upsert({
    where: { wallet },
    create: {
      wallet,
      arenaRating: 400,
      currentDivision: 5,
      registeredSeason,
    },
    update: {}, // existing traders: no field changes on re-login
    select: {
      wallet: true,
      arenaRating: true,
      currentDivision: true,
      registeredSeason: true,
      totalSeasonsParticipated: true,
      lastActiveSeason: true,
      currentSquadId: true,
    },
  });

  // ── 4. Sign JWT ───────────────────────────────────────────────────────
  const token = signJWT(wallet);

  return NextResponse.json({ success: true, token, trader }, { status: 200 });
}
