// app/api/admin/season/close/route.ts — POST /api/admin/season/close
// Protected by ADMIN_TOKEN bearer auth.

import { type NextRequest } from "next/server";
import { closeSeason } from "@/lib/season";

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function badRequest(msg: string) {
  return Response.json({ ok: false, error: msg }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.ADMIN_TOKEN}`
  ) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { seasonNumber } = body as Record<string, unknown>;

  if (
    typeof seasonNumber !== "number" ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber < 1
  ) {
    return badRequest("seasonNumber must be a positive integer");
  }

  try {
    const season = await closeSeason(seasonNumber);
    return Response.json({ ok: true, season });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/season/close]", msg);

    if (msg.includes("not found"))
      return Response.json({ ok: false, error: msg }, { status: 404 });
    if (msg.includes("already closed"))
      return Response.json({ ok: false, error: msg }, { status: 409 });
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
