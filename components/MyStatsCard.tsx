// src/components/MyStatsCard.tsx
"use client";
import { useState, useEffect, useTransition } from "react";

interface TraderStats {
  wallet: string;
  arenaRating: number;
  division: number;
  divisionName: string;
  streak: { streakDays: number; lastStreakDate: string | null } | null;
  squad: { name: string; rank: number | null; division: number } | null;
  currentSeason: {
    totalCps: number;
    rankInDivision: number | null;
    totalTrades: number;
    winRate: number;
  } | null;
}

const DIV_COLORS: Record<number, string> = {
  1: "#c8a96e",
  2: "#7ab0c8",
  3: "#a0a0c8",
  4: "#c8a06e",
  5: "#8a9a8a",
};

function StatBlock({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
        {label}
      </span>
      <span
        className="font-display font-black text-2xl leading-none text-[#2e3d47]"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: accent }}
      >
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[10px] text-[#b0aea5]">{sub}</span>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-[#dddbd5] p-6">
      <div className="skeleton h-4 w-32 mb-4 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-2 w-16 rounded" />
            <div className="skeleton h-7 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface MyStatsCardProps {
  wallet: string | null;
  seasonNumber: number;
}

export default function MyStatsCard({
  wallet,
  seasonNumber,
}: MyStatsCardProps) {
  const [stats, setStats] = useState<TraderStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!wallet) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    fetch(`/api/trader/${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        startTransition(() => {
          if (d.ok) setStats(d);
          else setError("Could not load your stats");
        });
      })
      .catch(() => startTransition(() => setError("Network error")))
      .finally(() => startTransition(() => setLoading(false)));
  }, [wallet]);

  if (!wallet) {
    return (
      <div className="bg-[#2e3d47] border border-[#2e3d47] p-6 flex items-center justify-between">
        <div>
          <p
            className="font-display font-bold text-lg text-white tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Connect Your Wallet
          </p>
          <p className="font-mono text-xs text-[#8a9aaa] mt-1">
            See your rank, CPS, streak, and squad
          </p>
        </div>
        <button className="font-mono text-xs uppercase tracking-widest px-5 py-2.5 bg-[#c8a96e] text-[#2e3d47] font-semibold hover:bg-[#d4b87a] transition-colors">
          Connect
        </button>
      </div>
    );
  }

  if (loading) return <SkeletonCard />;

  if (error || !stats) {
    return (
      <div className="bg-white border border-[#dddbd5] p-6">
        <p className="font-mono text-xs text-[#9b3d3d]">{error ?? "No data"}</p>
      </div>
    );
  }

  const cs = stats.currentSeason;
  const divColor = DIV_COLORS[stats.division] ?? "#8a9a8a";

  return (
    <div className="bg-white border border-[#dddbd5]">
      {/* Header bar */}
      <div className="px-6 py-3 border-b border-[#dddbd5] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: divColor }}
          />
          <span className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
            {stats.wallet.slice(0, 6)}…{stats.wallet.slice(-4)}
          </span>
        </div>
        <span
          className="font-display font-bold text-sm tracking-wide px-3 py-1 text-white text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: divColor,
          }}
        >
          {stats.divisionName}
        </span>
      </div>

      {/* Stats grid */}
      <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        <StatBlock
          label="Arena Rating"
          value={stats.arenaRating}
          accent={divColor}
        />
        <StatBlock
          label="Season Rank"
          value={cs?.rankInDivision ? `#${cs.rankInDivision}` : "—"}
          sub={cs ? `in ${stats.divisionName}` : undefined}
        />
        <StatBlock
          label="CPS"
          value={
            cs
              ? cs.totalCps >= 1_000_000
                ? `${(cs.totalCps / 1_000_000).toFixed(2)}M`
                : cs.totalCps.toFixed(0)
              : "—"
          }
          sub="this season"
        />
        <StatBlock
          label="Win Rate"
          value={cs ? `${(cs.winRate * 100).toFixed(0)}%` : "—"}
          sub={cs ? `${cs.totalTrades} trades` : undefined}
          accent={
            cs && cs.winRate >= 0.5 ? "#3d7a5c" : cs ? "#9b3d3d" : undefined
          }
        />
        <StatBlock
          label="Streak"
          value={stats.streak?.streakDays ?? 0}
          sub="days"
          accent={
            stats.streak && stats.streak.streakDays >= 7 ? "#c8a96e" : undefined
          }
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
            Squad
          </span>
          {stats.squad ? (
            <>
              <span className="font-medium text-[#2e3d47] text-sm leading-tight">
                {stats.squad.name}
              </span>
              <span className="font-mono text-[10px] text-[#b0aea5]">
                {stats.squad.rank ? `rank #${stats.squad.rank}` : "unranked"}
              </span>
            </>
          ) : (
            <span className="font-mono text-xs text-[#b0aea5] mt-1">
              No squad
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
