// src/app/api/squads/create/route.ts
// POST /api/squads/create — JWT required
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createSquad, SquadError } from "@/lib/squad";

export async function POST(req: NextRequest) {
  let wallet: string;
  try {
    wallet = requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { name, seasonNumber } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim())
    return NextResponse.json(
      { ok: false, error: "name is required" },
      { status: 400 },
    );
  if (typeof seasonNumber !== "number")
    return NextResponse.json(
      { ok: false, error: "seasonNumber is required" },
      { status: 400 },
    );

  try {
    const squad = await createSquad({
      creatorWallet: wallet,
      name,
      seasonNumber,
    });
    return NextResponse.json({ ok: true, squad }, { status: 201 });
  } catch (err) {
    if (err instanceof SquadError) {
      const status =
        err.code === "NAME_TAKEN"
          ? 409
          : err.code === "PAST_LOCK_DAY"
            ? 423
            : err.code === "ALREADY_IN_SQUAD"
              ? 409
              : 400;
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
