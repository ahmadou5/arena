// src/app/api/trade/chart/route.ts
// GET /api/trade/chart?symbol=SOL&interval=1h&limit=100
// Proxies OHLCV data from Binance — free, no API key needed
// Binance pairs: SOLUSDT, BTCUSDT, ETHUSDT, BONKUSDT, JTOUSDT

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYMBOL_MAP: Record<string, string> = {
  SOL: "SOLUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  BONK: "BONKUSDT",
  JTO: "JTOUSDT",
};

const INTERVAL_MAP: Record<string, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = (sp.get("symbol") ?? "SOL").toUpperCase();
  const interval = INTERVAL_MAP[sp.get("interval") ?? "1h"] ?? "1h";
  const limit = Math.min(500, Math.max(10, Number(sp.get("limit") ?? 100)));

  const pair = SYMBOL_MAP[symbol];
  if (!pair) {
    return NextResponse.json(
      { ok: false, error: `Unknown symbol: ${symbol}` },
      { status: 400 },
    );
  }

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;

    // FIX: Route is already `force-dynamic`, so `next: { revalidate }` on
    // the inner fetch conflicts and can cause stale/missing responses.
    // Use `cache: "no-store"` to stay consistent with force-dynamic.
    const res = await fetch(url, {
      headers: { "User-Agent": "Arena Protocol/1.0" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Binance error: ${res.status}` },
        { status: 502 },
      );
    }

    // Binance kline format:
    // [openTime, open, high, low, close, volume, closeTime, ...]
    const raw: [
      number,
      string,
      string,
      string,
      string,
      string,
      ...unknown[],
    ][] = await res.json();

    const candles = raw.map((k) => ({
      time: Math.floor(k[0] / 1000), // ms → seconds for lightweight-charts
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    const currentPrice =
      candles.length > 0 ? candles[candles.length - 1].close : null;
    const prevClose =
      candles.length > 1 ? candles[candles.length - 2].close : null;
    const change24h =
      currentPrice && prevClose
        ? ((currentPrice - prevClose) / prevClose) * 100
        : null;

    return NextResponse.json(
      {
        ok: true,
        symbol,
        pair,
        interval,
        candles,
        currentPrice,
        change24h,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[trade/chart]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
