"use client";

import { useEffect, useRef, useState } from "react";

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

export default function TradingChart({ symbol }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeInterval, setActiveInterval] = useState("60");

  const tvSymbol = TV_SYMBOL_MAP[symbol] ?? "BINANCE:SOLUSDT";

  useEffect(() => {
    if (!containerRef.current) return;

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
      theme: "light",
      style: "1",
      locale: "en",
      backgroundColor: "#f7f6f2",
      gridColor: "#e8e6e0",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [tvSymbol, activeInterval]);

  return (
    <div
      className="w-full flex flex-col"
      style={{
        background: "#f7f6f2",
        border: "1px solid #dddbd5",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid #dddbd5", background: "#ffffff" }}
      >
        {/* Symbol label */}
        <span
          className="font-mono text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#2e3d47" }}
        >
          {symbol}-PERP · Price Chart
        </span>

        {/* Interval tabs */}
        <div className="flex items-center gap-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setActiveInterval(iv.value)}
              className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 transition-colors"
              style={{
                borderRadius: 4,
                background:
                  activeInterval === iv.value ? "#2e3d47" : "transparent",
                color: activeInterval === iv.value ? "#ffffff" : "#8a8880",
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
        className="tradingview-widget-container"
        style={{ height: 460, width: "100%", background: "#f7f6f2" }}
      />

      {/* Footer attribution */}
      <div
        className="flex items-center justify-end px-4 py-1.5"
        style={{ borderTop: "1px solid #dddbd5", background: "#ffffff" }}
      >
        <a
          href="https://www.tradingview.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono transition-colors"
          style={{ fontSize: 9, color: "#b0aea5" }}
        >
          Powered by TradingView
        </a>
      </div>
    </div>
  );
}
