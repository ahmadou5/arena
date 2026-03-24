"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

interface TradingChartProps {
  symbol: string;
}

export default function TradingChart({ symbol }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Using 'any' here for the series refs prevents the "Property does not exist" TS error
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);

  // ── 1. Setup Chart Instance ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize the chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: "#253248" },
        textColor: "rgba(255, 255, 255, 0.9)",
      },
      grid: {
        vertLines: { color: "#334158" },
        horzLines: { color: "#334158" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#485c7b",
      },
      timeScale: {
        borderColor: "#485c7b",
        timeVisible: true,
      },
    });

    // FIX: Using 'addSeries' with the Series Class is the v4 standard
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#385263",
      priceFormat: { type: "volume" },
      priceScaleId: "volume-pane",
    });

    chart.priceScale("volume-pane").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // ── 2. Data Fetching Logic ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchChartData() {
      if (!candleSeriesRef.current) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/trade/chart?symbol=${symbol}&interval=1h&limit=150`,
        );
        const d = await res.json();

        if (d.ok && Array.isArray(d.candles)) {
          // Format data for the chart
          const prices = d.candles.map((c: any) => ({
            time: c.time as Time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));

          const volumes = d.candles.map((c: any) => ({
            time: c.time as Time,
            value: Number(c.volume),
            color: c.close >= c.open ? "#26a69a50" : "#ef535050",
          }));

          // Pushing arrays to the series
          candleSeriesRef.current.setData(prices);
          volumeSeriesRef.current.setData(volumes);

          chartRef.current?.timeScale().fitContent();
        }
      } catch (err) {
        console.error("Error fetching chart:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchChartData();
    const interval = setInterval(fetchChartData, 60000);
    return () => clearInterval(interval);
  }, [symbol]); // Runs when the market symbol changes

  return (
    <div className="w-full relative border border-[#485c7b] rounded-lg overflow-hidden bg-[#253248]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#253248]/60 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin" />
            <span className="font-mono text-[10px] text-white uppercase tracking-widest">
              Loading {symbol}...
            </span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
