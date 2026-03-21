// src/app/api/squads/leave/route.ts
// DELETE /api/squads/leave — JWT required
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { leaveSquad, SquadError } from "@/lib/squad";

export async function DELETE(req: NextRequest) {
  let wallet: string;
  try {
    wallet = requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  try {
    await leaveSquad(wallet);
    return NextResponse.json({ ok: true, message: "Left squad" });
  } catch (err) {
    if (err instanceof SquadError) {
      const status =
        err.code === "SQUAD_LOCKED"
          ? 423
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
