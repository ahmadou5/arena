"use client";

import { useEffect, useRef, useState } from "react";

interface TradingChartProps {
  symbol: string;
}

// Map our internal symbols to TradingView symbols
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
  const [activeInterval, setActiveInterval] = useState("60"); // default 1h

  const tvSymbol = TV_SYMBOL_MAP[symbol] ?? "BINANCE:SOLUSDT";

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any previous widget instance before injecting a new one
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
      theme: "dark",
      style: "1", // 1 = Candlestick
      locale: "en",
      backgroundColor: "#253248",
      gridColor: "#334158",
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
    <div className="w-full border border-[#485c7b] rounded-lg overflow-hidden bg-[#253248] flex flex-col">
      {/* Interval selector tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#485c7b]">
        <span className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest mr-2">
          Interval
        </span>
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => setActiveInterval(iv.value)}
            className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 transition-colors rounded-sm ${
              activeInterval === iv.value
                ? "bg-[#485c7b] text-white"
                : "text-[#8a9aaa] hover:text-white hover:bg-[#334158]"
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {/* Widget mount point — explicit height is required */}
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: 480, width: "100%" }}
      />

      {/* TradingView attribution — required by their ToS */}
      <div className="px-3 py-1.5 border-t border-[#334158] flex items-center justify-end">
        <a
          href="https://www.tradingview.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[9px] text-[#485c7b] hover:text-[#8a9aaa] transition-colors"
        >
          Powered by TradingView
        </a>
      </div>
    </div>
  );
}
