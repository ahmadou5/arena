// src/components/MyStatsCard.tsx
"use client";
import { useAuth } from "@/providers/AuthProvider";
import { useState, useEffect } from "react";

interface CurrentSeason {
  seasonNumber: number;
  name: string;
  totalCps: number;
  rankInDivision: number | null;
  totalTrades: number;
  winRate: number;
}

interface TraderStats {
  wallet: string;
  arenaRating: number;
  division: number;
  divisionName: string;
  streak: { streakDays: number; lastStreakDate: string | null } | null;
  squad: { name: string; rank: number | null; division: number } | null;
  currentSeason: CurrentSeason | null;
}

const DIV_COLORS: Record<number, string> = {
  1: "#c8a96e",
  2: "#7ab0c8",
  3: "#a0a0c8",
  4: "#c8a06e",
  5: "#8a9a8a",
};

// Safe number formatters — never produce NaN
function fmtCps(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000)?.toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000)?.toFixed(1)}K`;
  return n?.toFixed(0);
}

function fmtPct(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return "0%";
  return `${(n * 100)?.toFixed(0)}%`;
}

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
      <div className="h-4 w-32 mb-4 rounded bg-[#e8e6e0] animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2 w-16 rounded bg-[#e8e6e0] animate-pulse" />
            <div className="h-7 w-20 rounded bg-[#e8e6e0] animate-pulse" />
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
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();

  useEffect(() => {
    // Reset and skip fetch when wallet is absent — no synchronous setState
    if (!wallet) return;

    let cancelled = false;

    fetch(`/api/trader/${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setStats(d);
        else setError("Could not load your stats");
      })
      .catch(() => {
        if (!cancelled) setError("Network error");
      });

    // Cleanup: ignore stale response if wallet changes mid-flight
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  // ── Not connected ─────────────────────────────────────────────────────────
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
        <button
          onClick={() => signIn()}
          className="font-mono text-xs uppercase tracking-widest px-5 py-2.5 bg-[#c8a96e] text-[#2e3d47] font-semibold hover:bg-[#d4b87a] transition-colors"
        >
          Connect
        </button>
      </div>
    );
  }

  // ── Loading: wallet set but no data yet ──────────────────────────────────
  if (wallet && !stats && !error) return <SkeletonCard />;

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div className="bg-white border border-[#dddbd5] p-6">
        <p className="font-mono text-xs text-[#9b3d3d]">{error ?? "No data"}</p>
      </div>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────────────────
  const cs = stats.currentSeason;
  const divColor = DIV_COLORS[stats.division] ?? "#8a9a8a";

  // Safe values — never undefined/NaN reaching the UI
  const cps = cs?.totalCps ?? 0;
  const winRate = cs?.winRate ?? 0;
  const totalTrades = cs?.totalTrades ?? 0;
  const rank = cs?.rankInDivision ?? null;
  const streakDays = stats.streak?.streakDays ?? 0;
  const hasTrades = totalTrades > 0;

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
          className="font-display font-bold text-xs tracking-wide px-3 py-1 text-white"
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
          value={rank ? `#${rank}` : "—"}
          sub={rank ? `in ${stats.divisionName}` : "unranked"}
        />
        <StatBlock
          label="CPS"
          value={hasTrades ? fmtCps(cps) : "—"}
          sub="this season"
        />
        <StatBlock
          label="Win Rate"
          value={hasTrades ? fmtPct(winRate) : "—"}
          sub={hasTrades ? `${totalTrades} trades` : "no trades yet"}
          accent={
            hasTrades ? (winRate >= 0.5 ? "#3d7a5c" : "#9b3d3d") : undefined
          }
        />
        <StatBlock
          label="Streak"
          value={streakDays > 0 ? `${streakDays}d` : "—"}
          sub="days"
          accent={streakDays >= 7 ? "#c8a96e" : undefined}
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
