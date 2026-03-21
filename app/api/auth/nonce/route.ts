// app/api/auth/nonce/route.ts
// GET /api/auth/nonce — generate a one-time nonce for wallet signature challenge

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const NONCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const NONCE_LENGTH = 8;
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function generateNonce(): string {
  // Use crypto.getRandomValues when available (Edge/Node 19+), else Math.random fallback
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(NONCE_LENGTH);
    crypto.getRandomValues(buf);
    return Array.from(buf)
      .map((b) => NONCE_CHARS[b % NONCE_CHARS.length])
      .join("");
  }
  // Fallback for older Node environments
  return Array.from(
    { length: NONCE_LENGTH },
    () => NONCE_CHARS[Math.floor(Math.random() * NONCE_CHARS.length)],
  ).join("");
}

export const dynamic = "force-dynamic";

export async function GET() {
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  await prisma.nonce.create({
    data: { value: nonce, expiresAt },
  });

  return NextResponse.json({ nonce });
}
