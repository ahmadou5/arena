// app/api/admin/season/open/route.ts — POST /api/admin/season/open
// Protected by ADMIN_TOKEN bearer auth.

import { type NextRequest } from "next/server";
import { openSeason, type OpenSeasonParams } from "../../../../../lib/season";

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

  const { seasonNumber, name, startTs, endTs, offseasonEndTs, prizePoolUsdc } =
    body as Record<string, unknown>;

  // Validate required fields
  if (
    typeof seasonNumber !== "number" ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber < 1
  ) {
    return badRequest("seasonNumber must be a positive integer");
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return badRequest("name is required");
  }
  if (!startTs || !endTs || !offseasonEndTs) {
    return badRequest("startTs, endTs, and offseasonEndTs are required");
  }

  const start = new Date(startTs as string);
  const end = new Date(endTs as string);
  const offseason = new Date(offseasonEndTs as string);

  if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    isNaN(offseason.getTime())
  ) {
    return badRequest("Invalid date format — use ISO 8601");
  }
  if (end <= start) {
    return badRequest("endTs must be after startTs");
  }
  if (offseason <= end) {
    return badRequest("offseasonEndTs must be after endTs");
  }

  const params: OpenSeasonParams = {
    seasonNumber,
    name: name.trim(),
    startTs: start,
    endTs: end,
    offseasonEndTs: offseason,
    prizePoolUsdc: typeof prizePoolUsdc === "number" ? prizePoolUsdc : 0,
  };

  try {
    const season = await openSeason(params);
    return Response.json({ ok: true, season }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/season/open]", msg);
    // Conflict errors (already exists, already active) → 409
    const status = msg.includes("already") ? 409 : 500;
    return Response.json({ ok: false, error: msg }, { status });
  }
}
