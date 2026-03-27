"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

interface TradingChartProps {
  symbol: string;
}

const TV_SYMBOL_MAP: Record<string, string> = {
  SOL: "BINANCE:SOLUSDT",
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  BONK: "BINANCE:BONKUSDT",
  JTO: "BINANCE:JTOUSDT",
};

const INTERVALS = [
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1d", value: "1D" },
];

// ── Theme colours ─────────────────────────────────────────────────────────────

const LIGHT = {
  tvTheme: "light",
  bg: "#f7f6f2",
  bgCard: "#ffffff",
  border: "#dddbd5",
  text: "#2e3d47",
  textMuted: "#8a8880",
  textDim: "#b0aea5",
  activeBg: "#2e3d47",
  activeText: "#ffffff",
};

const DARK = {
  tvTheme: "dark",
  bg: "#0f1519",
  bgCard: "#1a2330",
  border: "#2a3a48",
  text: "#dde4ea",
  textMuted: "#8a9aaa",
  textDim: "#3a4a58",
  activeBg: "#c8a96e",
  activeText: "#1a2330",
};

// useSyncExternalStore — detects client mount without setState in effect
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function TradingChart({ symbol }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeInterval, setActiveInterval] = useState("60");
  const { resolvedTheme } = useTheme();
  const isMounted = useIsMounted();

  // Use light until mounted (avoids hydration flash)
  const colors = isMounted && resolvedTheme === "dark" ? DARK : LIGHT;
  const tvSymbol = TV_SYMBOL_MAP[symbol] ?? "BINANCE:SOLUSDT";

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: activeInterval,
      timezone: "Etc/UTC",
      theme: colors.tvTheme, // ← "light" or "dark"
      style: "1",
      locale: "en",
      backgroundColor: colors.bg, // ← matches page bg
      gridColor: colors.border,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
    // Re-render widget when symbol, interval, OR theme changes
  }, [tvSymbol, activeInterval, colors.tvTheme]);

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        minHeight: "clamp(320px, 50vw, 480px)",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgCard,
        }}
      >
        <span
          className="font-mono text-xs font-semibold uppercase tracking-widest"
          style={{ color: colors.text }}
        >
          {symbol}-PERP · Price Chart
        </span>

        <div className="flex items-center gap-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setActiveInterval(iv.value)}
              className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 transition-colors"
              style={{
                borderRadius: 4,
                background:
                  activeInterval === iv.value ? colors.activeBg : "transparent",
                color:
                  activeInterval === iv.value
                    ? colors.activeText
                    : colors.textMuted,
              }}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView widget */}
      <div
        ref={containerRef}
        className="tradingview-widget-container flex-1"
        style={{ width: "100%", background: colors.bg }}
      />

      {/* Footer */}
      <div
        className="flex items-center justify-end px-4 py-1.5 shrink-0"
        style={{
          borderTop: `1px solid ${colors.border}`,
          background: colors.bgCard,
        }}
      >
        <a
          href="https://www.tradingview.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono transition-colors"
          style={{ fontSize: 9, color: colors.textDim }}
        >
          Powered by TradingView
        </a>
      </div>
    </div>
  );
}
