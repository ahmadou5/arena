// lib/auth.ts — JWT helpers for Arena Protocol auth

import jwt from "jsonwebtoken";
import { type NextRequest } from "next/server";

export interface JWTPayload {
  wallet: string;
  iat: number;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

/**
 * Verify a JWT token and return the payload, or null if invalid/expired.
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as JWTPayload;
    if (!payload.wallet || typeof payload.wallet !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Sign a JWT for the given wallet with 7-day expiry.
 */
export function signJWT(wallet: string): string {
  return jwt.sign({ wallet } satisfies Omit<JWTPayload, "iat">, jwtSecret(), {
    expiresIn: "7d",
  });
}

/**
 * Extract and verify the Bearer JWT from an incoming request.
 * Returns the wallet string on success.
 * Throws a Response with status 401 on failure — catch and return it.
 */
export function requireAuth(req: NextRequest): string {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({
        ok: false,
        error: "Missing or malformed Authorization header",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = header.slice(7);
  const payload = verifyJWT(token);
  if (!payload) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return payload.wallet;
}
