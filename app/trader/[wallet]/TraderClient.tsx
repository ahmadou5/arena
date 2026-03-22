// src/app/trader/[wallet]/TraderClient.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import DivisionBadge from "@/components/DivisionBadge";
import ARSparkline from "@/components/ARSparkline";
import AchievementsWall from "@/components/AchievementsWall";
import CopyButton from "@/components/CopyButton";

// ── Types ──────────────────────────────────────────────────────────────────

interface TraderData {
  ok: boolean;
  wallet: string;
  arenaRating: number;
  division: number;
  divisionName: string;
  totalSeasonsParticipated: number;
  lastActiveSeason: number | null;
  currentSeason: {
    seasonNumber: number;
    name: string;
    totalCps?: number;
    rankInDivision?: number | null;
    totalTrades?: number;
    winRate?: number;
  } | null;
  squad: {
    name: string;
    rank: number | null;
    memberCount: number;
    isLocked: boolean;
  } | null;
  seasonHistory: {
    seasonNumber: number;
    finalCps: number | null;
    finalRank: number | null;
    division: number | null;
    arStart: number | null;
    arEnd: number | null;
    promoted: boolean;
    relegated: boolean;
    totalTrades: number;
    winningTrades: number;
  }[];
  achievements: {
    achievementKey: string;
    seasonNumber: number;
    earnedAt: string;
  }[];
  arHistory: { season: number; ar: number; division: number | null }[];
  streak: { streakDays: number } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DIV_COLORS: Record<number, string> = {
  1: "#1a2830",
  2: "#1a4070",
  3: "#506080",
  4: "#806010",
  5: "#705018",
};
const DIV_SHORT = ["", "GM", "D", "P", "G", "S"];

function fmtCps(n: number | null) {
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function shortWallet(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-6)}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[#dddbd5]" />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">
      <div className="bg-white border border-[#dddbd5] p-8">
        <div className="flex gap-6">
          <div className="w-40 h-40 bg-[#e8e6e0] rounded-sm flex-shrink-0" />
          <div className="flex-1 space-y-4 pt-2">
            <div className="h-4 bg-[#e8e6e0] rounded w-64" />
            <div className="h-16 bg-[#e8e6e0] rounded w-32" />
            <div className="h-3 bg-[#e8e6e0] rounded w-48" />
          </div>
        </div>
      </div>
      <div className="bg-white border border-[#dddbd5] p-6">
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-2 bg-[#e8e6e0] rounded w-16" />
              <div className="h-8 bg-[#e8e6e0] rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Error / Not found ──────────────────────────────────────────────────────

function ErrorState({ wallet, message }: { wallet: string; message: string }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white border border-[#dddbd5] p-8 text-center space-y-4">
        <p
          className="font-display font-black text-3xl text-[#2e3d47]"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Trader Not Found
        </p>
        <p className="font-mono text-xs text-[#8a8880]">
          {shortWallet(wallet)}
        </p>
        <p className="font-mono text-[10px] text-[#9b3d3d]">{message}</p>
        <Link
          href="/"
          className="inline-block mt-4 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#2e3d47] text-[#2e3d47] hover:bg-[#2e3d47] hover:text-white transition-colors"
        >
          ← Back to Arena
        </Link>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function TraderClient({ wallet }: { wallet: string }) {
  const [data, setData] = useState<TraderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trader/${wallet}`)
      .then((r) => r.json())
      .then((d: TraderData) => {
        if (!d.ok) setError("Trader not found");
        else setData(d);
      })
      .catch(() => setError("Failed to load trader data"))
      .finally(() => setLoading(false));
  }, [wallet]);

  const divColor = data ? (DIV_COLORS[data.division] ?? "#708090") : "#708090";

  const arTrend =
    data && data.arHistory.length >= 2
      ? data.arHistory[data.arHistory.length - 1].ar -
        data.arHistory[data.arHistory.length - 2].ar
      : null;

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      {/* Nav */}
      <nav className="bg-white border-b border-[#dddbd5] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="font-display font-black text-lg tracking-tight text-[#2e3d47]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            ARENA
          </span>
          <span className="w-px h-4 bg-[#dddbd5]" />
          <span
            className="font-display font-light text-lg text-[#8a8880]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            PROTOCOL
          </span>
        </Link>
        <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest hidden sm:block">
          Trader Profile
        </span>
      </nav>

      {/* Loading */}
      {loading && <PageSkeleton />}

      {/* Error */}
      {!loading && error && <ErrorState wallet={wallet} message={error} />}

      {/* Content */}
      {!loading && data && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* ── HEADER ── */}
          <section>
            <div className="bg-white border border-[#dddbd5]">
              <div className="h-1" style={{ background: divColor }} />
              <div className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="flex-shrink-0">
                    <DivisionBadge
                      division={data.division}
                      size="xl"
                      showLabel
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    {/* Wallet */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-base text-[#2e3d47] tracking-wide break-all">
                        {shortWallet(data.wallet)}
                      </span>
                      <CopyButton text={data.wallet} />
                    </div>
                    {/* Stats row */}
                    <div className="flex items-baseline gap-6 flex-wrap">
                      <div>
                        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                          Arena Rating
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span
                            className="font-display font-black text-5xl leading-none text-[#2e3d47]"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                            }}
                          >
                            {data.arenaRating}
                          </span>
                          {arTrend !== null && (
                            <span
                              className={`font-mono text-sm font-semibold ${arTrend >= 0 ? "text-[#3d7a5c]" : "text-[#9b3d3d]"}`}
                            >
                              {arTrend >= 0 ? "▲" : "▼"} {Math.abs(arTrend)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                          Division
                        </p>
                        <span
                          className="font-display font-bold text-2xl"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            color: divColor,
                          }}
                        >
                          {data.divisionName.toUpperCase()}
                        </span>
                      </div>
                      {data.streak && data.streak.streakDays > 0 && (
                        <div>
                          <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                            Streak
                          </p>
                          <span
                            className="font-display font-bold text-2xl"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              color:
                                data.streak.streakDays >= 7
                                  ? "#c8a96e"
                                  : "#2e3d47",
                            }}
                          >
                            {data.streak.streakDays}d
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Meta */}
                    <div className="flex items-center gap-6 flex-wrap">
                      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                        {data.totalSeasonsParticipated} seasons
                      </span>
                      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                        {data.achievements.length} achievements
                      </span>
                      {data.lastActiveSeason && (
                        <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                          Last active: S{data.lastActiveSeason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── CURRENT SEASON ── */}
          {data.currentSeason && (
            <section>
              <SectionLabel>
                Current Season — {data.currentSeason.name}
              </SectionLabel>
              <div className="bg-white border border-[#dddbd5] p-6">
                {data.currentSeason.totalCps !== undefined ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    {[
                      {
                        label: "CPS",
                        value: fmtCps(data.currentSeason.totalCps ?? null),
                      },
                      {
                        label: "Division Rank",
                        value: data.currentSeason.rankInDivision
                          ? `#${data.currentSeason.rankInDivision}`
                          : "—",
                      },
                      {
                        label: "Win Rate",
                        value:
                          data.currentSeason.winRate !== undefined
                            ? `${(data.currentSeason.winRate * 100).toFixed(0)}%`
                            : "—",
                        color:
                          data.currentSeason.winRate !== undefined
                            ? data.currentSeason.winRate >= 0.5
                              ? "#3d7a5c"
                              : "#9b3d3d"
                            : undefined,
                      },
                      {
                        label: "Trades",
                        value:
                          data.currentSeason.totalTrades?.toString() ?? "—",
                      },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-1">
                          {s.label}
                        </p>
                        <p
                          className="font-display font-black text-3xl leading-none text-[#2e3d47]"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            color: s.color,
                          }}
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest py-2">
                    No trades recorded this season yet
                  </p>
                )}

                <div className="mt-6 pt-6 border-t border-[#dddbd5] flex items-center justify-between flex-wrap gap-4">
                  {data.squad ? (
                    <>
                      <div>
                        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-1">
                          Squad
                        </p>
                        <p className="font-medium text-[#2e3d47] text-sm">
                          {data.squad.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        {[
                          {
                            label: "Rank",
                            value: data.squad.rank
                              ? `#${data.squad.rank}`
                              : "—",
                          },
                          {
                            label: "Members",
                            value: `${data.squad.memberCount}/5`,
                          },
                          {
                            label: "Status",
                            value: data.squad.isLocked ? "Locked" : "Open",
                            color: data.squad.isLocked ? "#9b3d3d" : "#3d7a5c",
                          },
                        ].map((s) => (
                          <div key={s.label}>
                            <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                              {s.label}
                            </p>
                            <p
                              className="font-mono text-sm text-[#2e3d47]"
                              style={{ color: s.color }}
                            >
                              {s.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                        No squad this season
                      </p>
                      <Link
                        href="/"
                        className="font-mono text-[10px] uppercase tracking-widest text-[#2e3d47] border border-[#2e3d47] px-3 py-1.5 hover:bg-[#2e3d47] hover:text-white transition-colors"
                      >
                        Join a squad →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── AR SPARKLINE ── */}
          {data.arHistory.length >= 2 && (
            <section>
              <SectionLabel>Arena Rating History</SectionLabel>
              <div className="bg-white border border-[#dddbd5] p-6">
                <ARSparkline data={data.arHistory} />
              </div>
            </section>
          )}

          {/* ── SEASON HISTORY ── */}
          {data.seasonHistory.length > 0 && (
            <section>
              <SectionLabel>Season History</SectionLabel>
              <div className="bg-white border border-[#dddbd5] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#2e3d47]">
                      {[
                        "Season",
                        "Division",
                        "Rank",
                        "CPS",
                        "AR Delta",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="py-3 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#8a8880]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.seasonHistory.map((r) => {
                      const arDelta =
                        r.arEnd !== null && r.arStart !== null
                          ? r.arEnd - r.arStart
                          : null;
                      const status = r.promoted
                        ? "promoted"
                        : r.relegated
                          ? "relegated"
                          : "stable";
                      return (
                        <tr
                          key={r.seasonNumber}
                          className="border-b border-[#dddbd5] hover:bg-[#f7f6f2] transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-xs font-medium">
                            S{r.seasonNumber}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <DivisionBadge
                                division={r.division ?? 5}
                                size="sm"
                              />
                              <span className="font-mono text-[10px] text-[#8a8880]">
                                {DIV_SHORT[r.division ?? 5]}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {r.finalRank ? `#${r.finalRank}` : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-[#2e3d47]">
                            {fmtCps(r.finalCps)}
                          </td>
                          <td className="py-3 px-4">
                            {arDelta !== null ? (
                              <span
                                className={`font-mono text-xs font-semibold ${arDelta >= 0 ? "text-[#3d7a5c]" : "text-[#9b3d3d]"}`}
                              >
                                {arDelta >= 0 ? "+" : ""}
                                {arDelta}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-[#b0aea5]">
                                —
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 ${
                                status === "promoted"
                                  ? "bg-[#3d7a5c20] text-[#3d7a5c]"
                                  : status === "relegated"
                                    ? "bg-[#9b3d3d20] text-[#9b3d3d]"
                                    : "text-[#8a8880]"
                              }`}
                            >
                              {status === "promoted"
                                ? "↑ Promoted"
                                : status === "relegated"
                                  ? "↓ Relegated"
                                  : "— Stable"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── ACHIEVEMENTS ── */}
          <section>
            <SectionLabel>Achievements</SectionLabel>
            <div className="bg-white border border-[#dddbd5] p-6">
              <AchievementsWall achievements={data.achievements} />
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      {data && (
        <footer className="border-t border-[#dddbd5] px-6 py-6 mt-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <Link
              href="/"
              className="font-display font-black text-sm text-[#2e3d47] tracking-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              ← Arena Protocol
            </Link>
            <span className="font-mono text-[10px] text-[#b0aea5]">
              {shortWallet(data.wallet)}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
