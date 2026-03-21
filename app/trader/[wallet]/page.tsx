// src/app/trader/[wallet]/page.tsx — Public Trader Profile (Server Component)
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DivisionBadge from "@/components/DivisionBadge";
import AchievementsWall from "@/components/AchievementsWall";
import ARSparkline from "@/components/ARSparkline";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface SeasonRecord {
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
}

interface TraderData {
  wallet: string;
  arenaRating: number;
  division: number;
  divisionName: string;
  createdAt: string;
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
  seasonHistory: SeasonRecord[];
  achievements: {
    achievementKey: string;
    seasonNumber: number;
    earnedAt: string;
  }[];
  arHistory: { season: number; ar: number; division: number | null }[];
  squad: {
    id: number;
    name: string;
    division: number;
    squadScore: number;
    rank: number | null;
    isLocked: boolean;
    memberCount: number;
  } | null;
  streak: { streakDays: number; lastStreakDate: string | null } | null;
}

// ── Data fetch ─────────────────────────────────────────────────────────────

async function fetchTrader(wallet: string): Promise<TraderData | null> {
  try {
    const trader = await prisma.trader.findUnique({
      where: { wallet },
      select: {
        wallet: true,
        arenaRating: true,
        currentDivision: true,
        registeredSeason: true,
        totalSeasonsParticipated: true,
        lastActiveSeason: true,
        currentSquadId: true,
        createdAt: true,
        currentSquad: {
          select: {
            id: true,
            name: true,
            division: true,
            squadScore: true,
            rank: true,
            isLocked: true,
            synergyQuestWeeks: true,
            synergyStreakPeak: true,
            _count: { select: { currentMembers: true } },
          },
        },
        streak: { select: { streakDays: true, lastStreakDate: true } },
        achievements: {
          orderBy: { earnedAt: "desc" },
          select: { achievementKey: true, seasonNumber: true, earnedAt: true },
        },
      },
    });
    if (!trader) return null;

    // Season history — last 10
    const seasonHistory = await prisma.seasonRecord.findMany({
      where: { wallet },
      orderBy: { seasonNumber: "desc" },
      take: 10,
      select: {
        seasonNumber: true,
        finalCps: true,
        finalRank: true,
        division: true,
        arStart: true,
        arEnd: true,
        promoted: true,
        relegated: true,
        totalTrades: true,
        winningTrades: true,
      },
    });

    // AR history from season records
    const arHistory = seasonHistory
      .filter((r) => r.arEnd !== null)
      .map((r) => ({
        season: r.seasonNumber,
        ar: r.arEnd as number,
        division: r.division,
      }))
      .reverse();

    // Active season summary
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
      select: { seasonNumber: true, name: true },
    });
    let currentSeason = null;
    if (activeSeason) {
      const summary = await prisma.seasonTraderSummary.findUnique({
        where: {
          wallet_seasonNumber: {
            wallet,
            seasonNumber: activeSeason.seasonNumber,
          },
        },
        select: {
          totalCps: true,
          rankInDivision: true,
          division: true,
          totalTrades: true,
          winningTrades: true,
        },
      });
      currentSeason = {
        seasonNumber: activeSeason.seasonNumber,
        name: activeSeason.name,
        ...(summary
          ? {
              totalCps: Number(summary.totalCps),
              rankInDivision: summary.rankInDivision,
              division: summary.division,
              totalTrades: summary.totalTrades,
              winRate:
                summary.totalTrades > 0
                  ? summary.winningTrades / summary.totalTrades
                  : 0,
            }
          : {}),
      };
    }

    const DIV_NAMES: Record<number, string> = {
      1: "Grandmaster",
      2: "Diamond",
      3: "Platinum",
      4: "Gold",
      5: "Silver",
    };

    return {
      wallet: trader.wallet,
      arenaRating: trader.arenaRating,
      division: trader.currentDivision,
      divisionName: DIV_NAMES[trader.currentDivision] ?? "Silver",
      createdAt: trader.createdAt.toISOString(),
      totalSeasonsParticipated: trader.totalSeasonsParticipated,
      lastActiveSeason: trader.lastActiveSeason,
      currentSeason,
      seasonHistory: seasonHistory.map((r) => ({
        ...r,
        finalCps: r.finalCps !== null ? Number(r.finalCps) : null,
      })),
      achievements: trader.achievements.map((a) => ({
        ...a,
        earnedAt: a.earnedAt.toISOString(),
      })),
      arHistory,
      squad: trader.currentSquad
        ? {
            ...trader.currentSquad,
            squadScore: Number(trader.currentSquad.squadScore),
            memberCount: trader.currentSquad._count.currentMembers,
          }
        : null,
      streak: trader.streak
        ? {
            streakDays: trader.streak.streakDays,
            lastStreakDate: trader.streak.lastStreakDate?.toISOString() ?? null,
          }
        : null,
    };
  } catch (e) {
    console.error("[trader page] fetchTrader error:", e);
    return null;
  }
}

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { wallet: string };
}): Promise<Metadata> {
  const t = await fetchTrader(params.wallet);
  if (!t) return { title: "Trader Not Found — Arena Protocol" };
  return {
    title: `${t.wallet.slice(0, 6)}…${t.wallet.slice(-4)} · ${t.divisionName} · Arena Protocol`,
    description: `Arena Rating: ${t.arenaRating} · ${t.totalSeasonsParticipated} seasons · ${t.achievements.length} achievements`,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-4 mb-5">
      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[#dddbd5]" />
    </div>
  );
}

const DIV_COLORS: Record<number, string> = {
  1: "#2a3840",
  2: "#2858a0",
  3: "#6080a8",
  4: "#b08010",
  5: "#906020",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default async function TraderProfilePage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  const trader = await fetchTrader(wallet);
  if (!trader) notFound();

  const divColor = DIV_COLORS[trader.division] ?? "#708090";
  const arTrend =
    trader.arHistory.length >= 2
      ? trader.arHistory[trader.arHistory.length - 1].ar -
        trader.arHistory[trader.arHistory.length - 2].ar
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* ══ SECTION 1: HEADER ══ */}
        <section>
          <div className="bg-white border border-[#dddbd5]">
            {/* Division colour bar */}
            <div className="h-1" style={{ background: divColor }} />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Badge — large */}
                <div className="flex-shrink-0">
                  <DivisionBadge
                    division={trader.division}
                    size="xl"
                    showLabel
                  />
                </div>

                {/* Core info */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Wallet address */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-base text-[#2e3d47] tracking-wide break-all">
                      {shortWallet(trader.wallet)}
                    </span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(trader.wallet)
                      }
                      className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-wider transition-colors border border-[#dddbd5] px-2 py-1 hover:border-[#2e3d47]"
                      title="Copy full wallet address"
                    >
                      copy
                    </button>
                  </div>

                  {/* AR + trend */}
                  <div className="flex items-baseline gap-4 flex-wrap">
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
                          {trader.arenaRating}
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
                        className="font-display font-bold text-2xl text-[#2e3d47]"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          color: divColor,
                        }}
                      >
                        {trader.divisionName.toUpperCase()}
                      </span>
                    </div>
                    {trader.streak && trader.streak.streakDays > 0 && (
                      <div>
                        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                          Streak
                        </p>
                        <span
                          className="font-display font-bold text-2xl"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            color:
                              trader.streak.streakDays >= 7
                                ? "#c8a96e"
                                : "#2e3d47",
                          }}
                        >
                          {trader.streak.streakDays}d
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-6 flex-wrap">
                    <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                      {trader.totalSeasonsParticipated} seasons
                    </span>
                    <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                      {trader.achievements.length} achievements
                    </span>
                    {trader.lastActiveSeason && (
                      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                        Last active: S{trader.lastActiveSeason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECTION 2: CURRENT SEASON ══ */}
        {trader.currentSeason && (
          <section>
            <SectionLabel>
              Current Season — {trader.currentSeason.name}
            </SectionLabel>
            <div className="bg-white border border-[#dddbd5] p-6">
              {trader.currentSeason.totalCps !== undefined ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {[
                    {
                      label: "CPS",
                      value: fmtCps(trader.currentSeason.totalCps ?? null),
                    },
                    {
                      label: "Division Rank",
                      value: trader.currentSeason.rankInDivision
                        ? `#${trader.currentSeason.rankInDivision}`
                        : "—",
                    },
                    {
                      label: "Win Rate",
                      value:
                        trader.currentSeason.winRate !== undefined
                          ? `${(trader.currentSeason.winRate * 100).toFixed(0)}%`
                          : "—",
                      color:
                        trader.currentSeason.winRate !== undefined &&
                        trader.currentSeason.winRate >= 0.5
                          ? "#3d7a5c"
                          : "#9b3d3d",
                    },
                    {
                      label: "Trades",
                      value:
                        trader.currentSeason.totalTrades?.toString() ?? "—",
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
                <div className="py-4">
                  <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                    No trades recorded this season yet
                  </p>
                </div>
              )}

              {/* Squad */}
              {trader.squad && (
                <div className="mt-6 pt-6 border-t border-[#dddbd5] flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-1">
                      Squad
                    </p>
                    <p className="font-medium text-[#2e3d47] text-sm">
                      {trader.squad.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                        Rank
                      </p>
                      <p className="font-mono text-sm text-[#2e3d47]">
                        {trader.squad.rank ? `#${trader.squad.rank}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                        Members
                      </p>
                      <p className="font-mono text-sm text-[#2e3d47]">
                        {trader.squad.memberCount}/5
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                        Status
                      </p>
                      <p
                        className="font-mono text-xs"
                        style={{
                          color: trader.squad.isLocked ? "#9b3d3d" : "#3d7a5c",
                        }}
                      >
                        {trader.squad.isLocked ? "Locked" : "Open"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!trader.squad && (
                <div className="mt-6 pt-6 border-t border-[#dddbd5] flex items-center justify-between">
                  <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                    No squad this season
                  </p>
                  <Link
                    href="/"
                    className="font-mono text-[10px] uppercase tracking-widest text-[#2e3d47] border border-[#2e3d47] px-3 py-1.5 hover:bg-[#2e3d47] hover:text-white transition-colors"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Join a squad →
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══ SECTION 3: AR SPARKLINE ══ */}
        {trader.arHistory.length >= 2 && (
          <section>
            <SectionLabel>Arena Rating History</SectionLabel>
            <div className="bg-white border border-[#dddbd5] p-6">
              <ARSparkline data={trader.arHistory} />
            </div>
          </section>
        )}

        {/* ══ SECTION 4: SEASON HISTORY TABLE ══ */}
        {trader.seasonHistory.length > 0 && (
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
                  {trader.seasonHistory.map((r) => {
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
                              {["", "GM", "D", "P", "G", "S"][r.division ?? 5]}
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

        {/* ══ SECTION 5: ACHIEVEMENTS WALL ══ */}
        <section>
          <SectionLabel>Achievements</SectionLabel>
          <div className="bg-white border border-[#dddbd5] p-6">
            <AchievementsWall achievements={trader.achievements} />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#dddbd5] px-6 py-6 mt-12">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display font-black text-sm text-[#2e3d47] tracking-tight"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            ← Arena Protocol
          </Link>
          <span className="font-mono text-[10px] text-[#b0aea5]">
            {shortWallet(trader.wallet)}
          </span>
        </div>
      </footer>
    </div>
  );
}
