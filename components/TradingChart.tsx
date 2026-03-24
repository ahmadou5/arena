// src/components/TradingChart.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartData {
  ok: boolean;
  symbol: string;
  interval: string;
  candles: Candle[];
  currentPrice: number | null;
  change24h: number | null;
}

interface TradingChartProps {
  symbol: string;
  /** Called when user hovers — gives the hovered price for CPS calc preview */
  onPriceHover?: (price: number | null) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INTERVALS = [
  { label: "5M", value: "5m" },
  { label: "15M", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

const CHART_COLORS = {
  bg: "#ffffff",
  grid: "#f0eeea",
  border: "#dddbd5",
  text: "#8a8880",
  crosshair: "#2e3d47",
  upCandle: "#3d7a5c",
  downCandle: "#9b3d3d",
  upWick: "#3d7a5c",
  downWick: "#9b3d3d",
  volume: "#2e3d4730",
};

function fmtPrice(n: number | null) {
  if (n === null) return "—";
  if (n >= 1000)
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TradingChart({
  symbol,
  onPriceHover,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [interval, setIntervalState] = useState("1h");
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredOHLC, setHoveredOHLC] = useState<Candle | null>(null);

  // ── Fetch candle data ───────────────────────────────────────────────────────

  const fetchCandles = useCallback(async () => {
    // We don't set loading true on auto-refreshes to avoid flickering the UI
    // Only set loading if we don't have data yet or if the symbol/interval changed
    setLoading((prev) => !data || prev);
    setError(null);

    try {
      const res = await fetch(
        `/api/trade/chart?symbol=${symbol}&interval=${interval}&limit=150`,
      );
      const d: ChartData = await res.json();

      if (d.ok) {
        setData(d);
      } else {
        setError("Failed to load chart data");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, data]);

  // Initial fetch and dependency-based fetch
  useEffect(() => {
    fetchCandles();
  }, [symbol, interval]); // Re-run when symbol or interval changes

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchCandles, 30_000);
    return () => clearInterval(id);
  }, [fetchCandles]);

  // ── Create chart ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.bg },
        textColor: CHART_COLORS.text,
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_COLORS.crosshair, width: 1, style: 3 },
        horzLine: { color: CHART_COLORS.crosshair, width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        textColor: CHART_COLORS.text,
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const d = new Date(time * 1000);
          return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upCandle,
      downColor: CHART_COLORS.downCandle,
      borderUpColor: CHART_COLORS.upWick,
      borderDownColor: CHART_COLORS.downWick,
      wickUpColor: CHART_COLORS.upWick,
      wickDownColor: CHART_COLORS.downWick,
    });

    const volumeSeries = chart.addHistogramSeries({
      color: CHART_COLORS.volume,
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Subscription to crosshair
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.seriesData) {
        setHoveredOHLC(null);
        onPriceHover?.(null);
        return;
      }

      const cd = param.seriesData.get(candleSeries) as
        | CandlestickData<Time>
        | undefined;
      if (cd) {
        setHoveredOHLC({
          time: cd.time as number,
          open: cd.open,
          high: cd.high,
          low: cd.low,
          close: cd.close,
          volume: 0,
        });
        onPriceHover?.(cd.close);
      }
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [onPriceHover]); // Setup only once (or if onPriceHover reference changes)

  // ── Push data into chart ────────────────────────────────────────────────────

  useEffect(() => {
    if (!data?.candles || !candleRef.current || !volumeRef.current) return;

    const candles = data.candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumes = data.candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color:
        c.close >= c.open
          ? CHART_COLORS.upCandle + "40"
          : CHART_COLORS.downCandle + "40",
    }));

    candleRef.current.setData(candles);
    volumeRef.current.setData(volumes);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const displayPrice = hoveredOHLC?.close ?? data?.currentPrice;
  const displayChange = data?.change24h;
  const isUp = (displayChange ?? 0) >= 0;

  return (
    <div className="bg-white border border-[#dddbd5] flex flex-col w-full overflow-hidden">
      {/* Chart header */}
      <div className="px-4 py-3 border-b border-[#dddbd5] flex items-center justify-between flex-wrap gap-3">
        {/* Price + OHLC */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span
              className="font-display font-black text-2xl text-[#2e3d47] leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {fmtPrice(displayPrice ?? null)}
            </span>
            {displayChange !== null && displayChange !== undefined && (
              <span
                className={`font-mono text-xs font-semibold ${isUp ? "text-[#3d7a5c]" : "text-[#9b3d3d]"}`}
              >
                {isUp ? "▲" : "▼"} {Math.abs(displayChange).toFixed(2)}%
              </span>
            )}
          </div>

          {/* OHLC on hover */}
          {hoveredOHLC && (
            <div className="hidden sm:flex items-center gap-3">
              {[
                { label: "O", value: hoveredOHLC.open, color: "#8a8880" },
                { label: "H", value: hoveredOHLC.high, color: "#3d7a5c" },
                { label: "L", value: hoveredOHLC.low, color: "#9b3d3d" },
                { label: "C", value: hoveredOHLC.close, color: "#2e3d47" },
              ].map((p) => (
                <span
                  key={p.label}
                  className="font-mono text-[10px]"
                  style={{ color: p.color }}
                >
                  {p.label} {fmtPrice(p.value)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Interval selector */}
        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setIntervalState(iv.value)}
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 transition-colors ${
                interval === iv.value
                  ? "bg-[#2e3d47] text-white"
                  : "text-[#8a8880] hover:text-[#2e3d47] border border-transparent hover:border-[#dddbd5]"
              }`}
            >
              {iv.label}
            </button>
          ))}
          <button
            onClick={() => fetchCandles()}
            disabled={loading}
            className="ml-1 font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] transition-colors px-1 disabled:opacity-40"
            title="Refresh"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Chart container */}
      <div className="relative w-full">
        <div ref={containerRef} style={{ height: 380 }} className="w-full" />

        {/* Loading overlay */}
        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest animate-pulse">
              Loading {symbol} chart…
            </span>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 z-10">
            <p className="font-mono text-xs text-[#9b3d3d]">{error}</p>
            <button
              onClick={() => fetchCandles()}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47] hover:text-[#2e3d47] transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#dddbd5] flex items-center justify-between bg-[#fbfaf8]">
        <span className="font-mono text-[9px] text-[#b0aea5] uppercase tracking-widest">
          {symbol}/USD · BINANCE · REFRESES EVERY 30S
        </span>
        {loading && data && (
          <span className="font-mono text-[9px] text-[#b0aea5] animate-pulse">
            UPDATING…
          </span>
        )}
      </div>
    </div>
  );
}
