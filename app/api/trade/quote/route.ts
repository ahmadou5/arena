// src/app/api/trade/quote/route.ts
// GET /api/trade/quote — fetch a quote + prepared transaction from Adrena
// The transaction is returned to the client to sign with their wallet
import { NextRequest, NextResponse } from "next/server";
import { openLong, openShort, closeLong, closeShort } from "@/lib/adrena";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action"); // open-long | open-short | close-long | close-short
  const account = sp.get("account");

  if (!account)
    return NextResponse.json(
      { ok: false, error: "account required" },
      { status: 400 },
    );
  if (!action)
    return NextResponse.json(
      { ok: false, error: "action required" },
      { status: 400 },
    );

  try {
    let result;

    if (action === "open-long") {
      const collateralAmount = Number(sp.get("collateralAmount"));
      const collateralTokenSymbol = sp.get("collateralTokenSymbol") ?? "USDC";
      const tokenSymbol = sp.get("tokenSymbol") ?? "SOL";
      const leverage = Number(sp.get("leverage") ?? 2);
      const takeProfit = sp.get("takeProfit")
        ? Number(sp.get("takeProfit"))
        : undefined;
      const stopLoss = sp.get("stopLoss")
        ? Number(sp.get("stopLoss"))
        : undefined;

      if (!collateralAmount || collateralAmount <= 0)
        return NextResponse.json(
          { ok: false, error: "collateralAmount must be > 0" },
          { status: 400 },
        );

      result = await openLong({
        account,
        collateralAmount,
        collateralTokenSymbol,
        tokenSymbol,
        leverage,
        takeProfit,
        stopLoss,
      });
    } else if (action === "open-short") {
      const collateralAmount = Number(sp.get("collateralAmount"));
      const collateralTokenSymbol = sp.get("collateralTokenSymbol") ?? "USDC";
      const tokenSymbol = sp.get("tokenSymbol") ?? "SOL";
      const leverage = Number(sp.get("leverage") ?? 2);
      const takeProfit = sp.get("takeProfit")
        ? Number(sp.get("takeProfit"))
        : undefined;
      const stopLoss = sp.get("stopLoss")
        ? Number(sp.get("stopLoss"))
        : undefined;

      if (!collateralAmount || collateralAmount <= 0)
        return NextResponse.json(
          { ok: false, error: "collateralAmount must be > 0" },
          { status: 400 },
        );

      result = await openShort({
        account,
        collateralAmount,
        collateralTokenSymbol,
        tokenSymbol,
        leverage,
        takeProfit,
        stopLoss,
      });
    } else if (action === "close-long") {
      const collateralTokenSymbol = sp.get("collateralTokenSymbol") ?? "USDC";
      const tokenSymbol = sp.get("tokenSymbol") ?? "SOL";
      const percentage = sp.get("percentage")
        ? Number(sp.get("percentage"))
        : 100;

      result = await closeLong({
        account,
        collateralTokenSymbol,
        tokenSymbol,
        percentage,
      });
    } else if (action === "close-short") {
      const collateralTokenSymbol = sp.get("collateralTokenSymbol") ?? "USDC";
      const tokenSymbol = sp.get("tokenSymbol") ?? "SOL";
      const percentage = sp.get("percentage")
        ? Number(sp.get("percentage"))
        : 100;

      result = await closeShort({
        account,
        collateralTokenSymbol,
        tokenSymbol,
        percentage,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    if (!result.success || !result.data) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Adrena API error" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      quote: result.data.quote,
      transaction: result.data.transaction,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[trade/quote]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
