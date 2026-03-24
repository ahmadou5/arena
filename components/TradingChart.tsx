"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";

export default function TradingChart({ priceData, volumeData }: any) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Create Chart with v4+ Options
    // We cast as IChartApi to help the linter
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        // Corrected for v4: background is an object
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
      // Note: in v4, 'priceScale' is often accessed via 'rightPriceScale' or 'leftPriceScale'
      rightPriceScale: {
        borderColor: "#485c7b",
      },
      timeScale: {
        borderColor: "#485c7b",
      },
    });

    // 2. Add Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#4bffb5",
      downColor: "#ff4976",
      borderDownColor: "#ff4976",
      borderUpColor: "#4bffb5",
      wickDownColor: "#838ca1",
      wickUpColor: "#838ca1",
    });

    const volumeSeries = chart.addHistogramSeries({
      color: "#182233",
      priceFormat: { type: "volume" },
      priceScaleId: "", // Set as overlay
    });

    // Configure volume scale margins
    chart.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 3. Set Data
    if (priceData) candleSeries.setData(priceData);
    if (volumeData) volumeSeries.setData(volumeData);

    chartRef.current = chart;

    // 4. Integrated Resize Observer
    const handleResize = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      // Minor delay to ensure timescale calculates correctly
      requestAnimationFrame(() => {
        chart.timeScale().fitContent();
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    // 5. Cleanup
    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [priceData, volumeData]); // Re-run if data changes significantly

  return (
    <div className="w-full relative border border-[#485c7b] rounded-lg overflow-hidden">
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
