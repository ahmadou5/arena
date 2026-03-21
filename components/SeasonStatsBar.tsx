// src/components/SeasonStatsBar.tsx
"use client";
import { useState, useEffect } from "react";

interface SeasonStatsBarProps {
  seasonNumber: number;
  initialTraderCount?: number;
  initialSquadCount?: number;
}

export default function SeasonStatsBar({
  seasonNumber,
  initialTraderCount = 0,
  initialSquadCount = 0,
}: SeasonStatsBarProps) {
  const [traderCount, setTraderCount] = useState(initialTraderCount);
  const [squadCount, setSquadCount] = useState(initialSquadCount);
  const [divBreakdown, setDivBreakdown] = useState<
    { division: number; count: number }[]
  >([]);

  useEffect(() => {
    // Fetch breakdown by division for the bar chart
    const fetchStats = async () => {
      const r = await fetch(`/api/seasons/${seasonNumber}`);
      const d = await r.json();
      if (d.ok) {
        setTraderCount(d.season.traderCount);
        setSquadCount(d.season.squadCount);
      }
      // Fetch all-divisions to get counts per division
      const r2 = await fetch(`/api/leaderboard/${seasonNumber}/all`);
      const d2 = await r2.json();
      if (d2.ok) {
        setDivBreakdown(
          d2.divisions.map((dv: { division: number; entries: unknown[] }) => ({
            division: dv.division,
            count: dv.entries.length,
          })),
        );
      }
    };
    fetchStats();
  }, [seasonNumber]);

  const DIV_NAMES: Record<number, string> = {
    1: "GM",
    2: "D",
    3: "P",
    4: "G",
    5: "S",
  };
  const DIV_COLORS: Record<number, string> = {
    1: "#c8a96e",
    2: "#7ab0c8",
    3: "#a0a0c8",
    4: "#c8a06e",
    5: "#8a9a8a",
  };

  const stats = [
    { label: "Traders", value: traderCount.toLocaleString() },
    { label: "Squads", value: squadCount.toLocaleString() },
    { label: "Season", value: `#${seasonNumber}` },
  ];

  return (
    <div className="bg-[#2e3d47] px-6 py-4 flex flex-wrap items-center gap-8">
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-2">
          <span
            className="font-display font-black text-xl text-white"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {s.value}
          </span>
          <span className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest">
            {s.label}
          </span>
        </div>
      ))}

      {/* Division mini bars */}
      {divBreakdown.length > 0 && (
        <div className="flex items-center gap-1 ml-auto">
          <span className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest mr-2">
            Divisions
          </span>
          {divBreakdown.map((d) => (
            <div key={d.division} className="flex flex-col items-center gap-1">
              <div className="w-6 text-center">
                <div
                  className="w-full rounded-sm"
                  style={{
                    background: DIV_COLORS[d.division],
                    height: `${Math.max(4, d.count * 2)}px`,
                    maxHeight: 24,
                  }}
                />
              </div>
              <span
                className="font-mono text-[9px]"
                style={{ color: DIV_COLORS[d.division] }}
              >
                {DIV_NAMES[d.division]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
