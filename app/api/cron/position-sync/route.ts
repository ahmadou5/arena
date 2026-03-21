// app/api/cron/position-sync/route.ts — Vercel Cron endpoint
// Invoked every minute by Vercel Cron (see vercel.json).
// Protected by CRON_SECRET bearer token.

import { type NextRequest } from "next/server";
import { runSync } from "@/job/position-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 55; // Vercel max for hobby; use 300 on Pro

export async function GET(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runSync();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/position-sync] unhandled error:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
