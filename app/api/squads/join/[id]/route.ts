// src/app/api/squads/join/[id]/route.ts
// POST /api/squads/join/:id — JWT required
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { joinSquad, SquadError } from "@/lib/squad";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let wallet: string;
  try {
    wallet = requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;

  const squadId = parseInt(id, 10);
  if (!Number.isFinite(squadId))
    return NextResponse.json(
      { ok: false, error: "Invalid squad id" },
      { status: 400 },
    );

  try {
    await joinSquad({ wallet, squadId });
    return NextResponse.json({ ok: true, message: `Joined squad ${squadId}` });
  } catch (err) {
    if (err instanceof SquadError) {
      const status =
        err.code === "ANTI_SYBIL"
          ? 403
          : err.code === "SQUAD_LOCKED"
            ? 423
            : err.code === "SQUAD_FULL"
              ? 409
              : err.code === "ALREADY_IN_SQUAD"
                ? 409
                : err.code === "NOT_FOUND"
                  ? 404
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
