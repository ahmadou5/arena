// src/app/trader/[wallet]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TraderHeader from "@/components/trader/TraderHeader";
import CurrentSeason from "@/components/trader/CurrentSeason";
import SeasonHistoryTable from "@/components/trader/SeasonHistoryTable";
import ARSparkline from "@/components/ARSparkline";
import AchievementsWall from "@/components/AchievementsWall";

// ── Types ──────────────────────────────────────────────────────────────────

interface TraderData {
  wallet: string;
  arenaRating: number;
  division: number;
  divisionName: string;
  totalSeasonsParticipated: number;
  lastActiveSeason: number | null;
  streak: { streakDays: number; lastStreakDate: string | null } | null;
  currentSeason: {
    seasonNumber: number;
    name: string;
    totalCps?: number;
    rankInDivision?: number | null;
    totalTrades?: number;
    winRate?: number;
  } | null;
  squad: {
    id: number;
    name: string;
    division: number;
    squadScore: number;
    rank: number | null;
    isLocked: boolean;
    memberCount: number;
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
}

// ── Data ───────────────────────────────────────────────────────────────────

const DIV_NAMES: Record<number, string> = {
  1: "Grandmaster",
  2: "Diamond",
  3: "Platinum",
  4: "Gold",
  5: "Silver",
};

async function getTrader(wallet: string): Promise<TraderData | null> {
  try {
    const [trader, seasonHistory, activeSeason] = await Promise.all([
      prisma.trader.findUnique({
        where: { wallet },
        select: {
          wallet: true,
          arenaRating: true,
          currentDivision: true,
          totalSeasonsParticipated: true,
          lastActiveSeason: true,
          createdAt: true,
          currentSquad: {
            select: {
              id: true,
              name: true,
              division: true,
              squadScore: true,
              rank: true,
              isLocked: true,
              _count: { select: { currentMembers: true } },
            },
          },
          streak: { select: { streakDays: true, lastStreakDate: true } },
          achievements: {
            orderBy: { earnedAt: "desc" },
            select: {
              achievementKey: true,
              seasonNumber: true,
              earnedAt: true,
            },
          },
        },
      }),
      prisma.seasonRecord.findMany({
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
      }),
      prisma.season.findFirst({
        where: { isActive: true },
        select: { seasonNumber: true, name: true },
      }),
    ]);

    if (!trader) return null;

    // Active season summary
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
              totalTrades: summary.totalTrades,
              winRate:
                summary.totalTrades > 0
                  ? summary.winningTrades / summary.totalTrades
                  : 0,
            }
          : {}),
      };
    }

    return {
      wallet: trader.wallet,
      arenaRating: trader.arenaRating,
      division: trader.currentDivision,
      divisionName: DIV_NAMES[trader.currentDivision] ?? "Silver",
      totalSeasonsParticipated: trader.totalSeasonsParticipated,
      lastActiveSeason: trader.lastActiveSeason,
      streak: trader.streak
        ? {
            streakDays: trader.streak.streakDays,
            lastStreakDate: trader.streak.lastStreakDate?.toISOString() ?? null,
          }
        : null,
      currentSeason,
      squad: trader.currentSquad
        ? {
            ...trader.currentSquad,
            squadScore: Number(trader.currentSquad.squadScore),
            memberCount: trader.currentSquad._count.currentMembers,
          }
        : null,
      seasonHistory: seasonHistory.map((r) => ({
        ...r,
        finalCps: r.finalCps !== null ? Number(r.finalCps) : null,
      })),
      achievements: trader.achievements.map((a) => ({
        ...a,
        earnedAt: a.earnedAt.toISOString(),
      })),
      arHistory: seasonHistory
        .filter((r) => r.arEnd !== null)
        .map((r) => ({
          season: r.seasonNumber,
          ar: r.arEnd as number,
          division: r.division,
        }))
        .reverse(),
    };
  } catch (e) {
    console.error("[trader page] error:", e);
    return null;
  }
}

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { wallet: string };
}): Promise<Metadata> {
  const t = await getTrader(params.wallet);
  if (!t) return { title: "Trader Not Found — Arena Protocol" };
  return {
    title: `${t.wallet.slice(0, 6)}…${t.wallet.slice(-4)} · ${t.divisionName} · Arena Protocol`,
    description: `Arena Rating: ${t.arenaRating} · ${t.totalSeasonsParticipated} seasons`,
  };
}

// ── Shared UI helpers ──────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────

export default async function TraderProfilePage({
  params,
}: {
  params: { wallet: string };
}) {
  const trader = await getTrader(params.wallet);
  if (!trader) notFound();

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
        {/* Header */}
        <section>
          <TraderHeader
            wallet={trader.wallet}
            arenaRating={trader.arenaRating}
            division={trader.division}
            divisionName={trader.divisionName}
            totalSeasonsParticipated={trader.totalSeasonsParticipated}
            lastActiveSeason={trader.lastActiveSeason}
            achievementsCount={trader.achievements.length}
            streak={trader.streak}
            arTrend={arTrend}
          />
        </section>

        {/* Current Season */}
        {trader.currentSeason && (
          <section>
            <SectionLabel>
              Current Season — {trader.currentSeason.name}
            </SectionLabel>
            <CurrentSeason season={trader.currentSeason} squad={trader.squad} />
          </section>
        )}

        {/* AR Sparkline */}
        {trader.arHistory.length >= 2 && (
          <section>
            <SectionLabel>Arena Rating History</SectionLabel>
            <div className="bg-white border border-[#dddbd5] p-6">
              <ARSparkline data={trader.arHistory} />
            </div>
          </section>
        )}

        {/* Season History */}
        {trader.seasonHistory.length > 0 && (
          <section>
            <SectionLabel>Season History</SectionLabel>
            <SeasonHistoryTable history={trader.seasonHistory} />
          </section>
        )}

        {/* Achievements */}
        <section>
          <SectionLabel>Achievements</SectionLabel>
          <div className="bg-white border border-[#dddbd5] p-6">
            <AchievementsWall achievements={trader.achievements} />
          </div>
        </section>
      </main>

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
            {trader.wallet.slice(0, 6)}…{trader.wallet.slice(-6)}
          </span>
        </div>
      </footer>
    </div>
  );
}
