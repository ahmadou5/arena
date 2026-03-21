// src/components/adrena-integration/QuestCpsIndicator.tsx
// Adrena UI integration: CPS indicator on quest cards
// Team: import and add <QuestCpsIndicator wallet={wallet} seasonNumber={season} /> to quest card components
// Integration point: Adrena quest card component (confirm file path with team)
"use client";
import { useState, useEffect } from "react";

interface QuestCpsIndicatorProps {
  wallet: string | null;
  seasonNumber: number;
  /** Optional: show as inline badge (default) or full stats */
  variant?: "badge" | "full";
}

export default function QuestCpsIndicator({
  wallet,
  seasonNumber,
  variant = "badge",
}: QuestCpsIndicatorProps) {
  const [cps, setCps] = useState<number | null>(null);

  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/trader/${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.currentSeason?.totalCps !== undefined) {
          setCps(d.currentSeason.totalCps);
        }
      })
      .catch(() => {});
  }, [wallet, seasonNumber]);

  if (!wallet) return null;
  if (cps === null) return null;

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000)?.toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000)?.toFixed(1)}K`;
    return n?.toFixed(0);
  };

  if (variant === "badge") {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 uppercase tracking-wider"
        style={{
          background: "#2e3d4714",
          border: "1px solid #2e3d4730",
          color: "#2e3d47",
        }}
      >
        <span className="text-[#c8a96e]">+</span>
        {fmt(cps)} CPS this season
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-3 py-2 border-t"
      style={{ borderColor: "#dddbd5" }}
    >
      <div>
        <p className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest">
          Season CPS
        </p>
        <p className="font-mono text-sm font-semibold text-[#2e3d47]">
          {fmt(cps)}
        </p>
      </div>
      <a
        href={`/trader/${wallet}`}
        className="font-mono text-[10px] text-[#7a9ab0] hover:text-[#2e3d47] transition-colors uppercase tracking-wider"
      >
        View profile →
      </a>
    </div>
  );
}
