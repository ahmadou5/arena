"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CandlestickSeries,
  type Time,
} from "lightweight-charts";

// 1. Define the shape of a single candle to keep the props clean
interface Candle {
  time: Time | { year: number; month: number; day: number };
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Volume {
  time: Time;
  value: number;
  color?: string;
}

export default function TradingChart({
  priceData,
  volumeData,
}: {
  // FIXED: priceData must be an ARRAY []
  priceData: Candle[];
  volumeData: Volume[];
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
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
      },
    });

    // 2. Add Candlestick Series (v4 Plugin Syntax)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // 3. Set Data (Ensuring we only set if data exists)
    if (priceData && Array.isArray(priceData)) {
      candlestickSeries.setData(priceData);
    }

    chartRef.current = chart;

    // 4. Handle Resize
    const handleResize = (entries: ResizeObserverEntry[]) => {
      if (!entries[0] || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      requestAnimationFrame(() => {
        chart.timeScale().fitContent();
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [priceData]); // Only re-run if priceData reference changes

  return (
    <div className="w-full relative border border-[#485c7b] rounded-lg overflow-hidden bg-[#253248]">
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
