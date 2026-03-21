// src/components/adrena-integration/AccountArenaStats.tsx
// Adrena UI integration: Arena section in account/profile page
// Team: import and add <AccountArenaStats wallet={wallet} /> to account page
// Integration point: Adrena account page component (confirm file path with team)
"use client";
import { useState, useEffect } from "react";
import DivisionBadge from "../DivisionBadge";

interface TraderProfile {
  arenaRating: number;
  division: number;
  divisionName: string;
  currentSeason: {
    seasonNumber: number;
    totalCps?: number;
    rankInDivision?: number | null;
    totalTrades?: number;
  } | null;
  streak: { streakDays: number } | null;
  achievements: { achievementKey: string }[];
}

interface AccountArenaStatsProps {
  wallet: string | null;
}

export default function AccountArenaStats({ wallet }: AccountArenaStatsProps) {
  const [data, setData] = useState<TraderProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/trader/${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wallet]);

  if (!wallet) return null;
  if (loading)
    return (
      <div className="space-y-2 p-4 border border-[#dddbd5]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-3 rounded-sm" />
        ))}
      </div>
    );
  if (!data) return null;

  const cs = data.currentSeason;

  return (
    <div className="border border-[#dddbd5] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#2e3d47]">
        <span
          className="font-display font-black text-base text-white tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          ARENA PROTOCOL
        </span>
        <a
          href={`/trader/${wallet}`}
          className="font-mono text-[10px] text-[#8a9aaa] hover:text-white transition-colors uppercase tracking-wider"
        >
          Full profile →
        </a>
      </div>

      {/* Stats */}
      <div className="p-4 flex items-center gap-5">
        <DivisionBadge division={data.division} size="lg" showLabel />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <p className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest">
              Arena Rating
            </p>
            <p
              className="font-display font-black text-2xl text-[#2e3d47] leading-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {data.arenaRating}
            </p>
          </div>
          {cs && cs.rankInDivision && (
            <div>
              <p className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest">
                Season Rank
              </p>
              <p
                className="font-display font-black text-2xl text-[#2e3d47] leading-tight"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                #{cs.rankInDivision}
              </p>
            </div>
          )}
          {cs && cs.totalCps !== undefined && (
            <div>
              <p className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest">
                Season CPS
              </p>
              <p className="font-mono text-sm font-semibold text-[#2e3d47]">
                {cs.totalCps >= 1_000_000
                  ? `${(cs.totalCps / 1_000_000).toFixed(2)}M`
                  : cs.totalCps >= 1_000
                    ? `${(cs.totalCps / 1_000).toFixed(1)}K`
                    : cs.totalCps.toFixed(0)}
              </p>
            </div>
          )}
          {data.streak && data.streak.streakDays > 0 && (
            <div>
              <p className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest">
                Streak
              </p>
              <p
                className="font-mono text-sm font-semibold"
                style={{
                  color: data.streak.streakDays >= 7 ? "#c8a96e" : "#2e3d47",
                }}
              >
                {data.streak.streakDays}d
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Achievements count */}
      {data.achievements.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#dddbd5] flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
            {data.achievements.length} achievement
            {data.achievements.length !== 1 ? "s" : ""}
          </span>
          <a
            href={`/trader/${wallet}#achievements`}
            className="font-mono text-[10px] text-[#7a9ab0] hover:text-[#2e3d47] transition-colors uppercase tracking-wider"
          >
            View all →
          </a>
        </div>
      )}
    </div>
  );
}
