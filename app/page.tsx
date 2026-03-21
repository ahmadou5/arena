// src/app/page.tsx — Season Lobby (Server Component)
import { Suspense } from "react";
import Countdown from "@/components/Countdown";
import LeaderboardClient from "@/components/LeaderboardClient";
import MyStatsCard from "@/components/MyStatsCard";
import SeasonStatsBar from "@/components/SeasonStatsBar";
import MidSeasonBanner from "@/components/MidSeasonBanner";
import SquadPanel from "@/components/SquadPanel";

// ── Types ──────────────────────────────────────────────────────────────────

interface SeasonData {
  seasonNumber: number;
  name: string;
  endTs: string;
  prizePoolUsdc: number;
  seasonDay: number;
  isSquadLockDay: boolean;
  squadsLocked: boolean;
}

interface DivisionGroup {
  division: number;
  name: string;
  entries: {
    wallet: string;
    totalCps: number;
    rankInDivision: number | null;
    winRate: number;
    winningTrades: number;
    totalTrades: number;
  }[];
}

interface MidSeasonData {
  phase: string;
  phaseLabel: string;
  seasonDay: number;
  standings: unknown[];
}

// ── Server data fetching ───────────────────────────────────────────────────

async function fetchActiveSeason(): Promise<SeasonData | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const r = await fetch(`${base}/api/seasons/active`, {
      next: { revalidate: 60 },
    });
    const d = await r.json();
    return d.ok ? d.season : null;
  } catch {
    return null;
  }
}

async function fetchAllDivisions(
  seasonNumber: number,
): Promise<DivisionGroup[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const r = await fetch(`${base}/api/leaderboard/${seasonNumber}/all`, {
      next: { revalidate: 30 },
    });
    const d = await r.json();
    return d.ok ? d.divisions : [];
  } catch {
    return [];
  }
}

async function fetchMidSeason(
  seasonNumber: number,
): Promise<MidSeasonData | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const r = await fetch(
      `${base}/api/leaderboard/${seasonNumber}/mid-season-event`,
      { next: { revalidate: 60 } },
    );
    const d = await r.json();
    return d.ok ? d : null;
  } catch {
    return null;
  }
}

// ── Skeleton blocks ────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="skeleton h-8 w-56 rounded" />
      <div className="skeleton h-16 w-72 rounded" />
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
        {children}
      </span>
      <span className="flex-1 h-px bg-[#dddbd5]" />
    </div>
  );
}

// ── No active season ───────────────────────────────────────────────────────

function NoSeasonState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p
          className="font-display font-black text-5xl text-[#2e3d47] tracking-tight"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          ARENA PROTOCOL
        </p>
        <p className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
          No active season · Stand by
        </p>
        <div className="flex items-center justify-center gap-2 pt-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8a8880] pulse-dot" />
          <span className="font-mono text-[10px] text-[#b0aea5]">
            Waiting for season open
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default async function SeasonLobby() {
  const [season, midSeason] = await Promise.all([
    fetchActiveSeason(),
    null as MidSeasonData | null, // fetched conditionally below
  ]);

  if (!season) return <NoSeasonState />;

  const [allDivisions, midSeasonData] = await Promise.all([
    fetchAllDivisions(season.seasonNumber),
    fetchMidSeason(season.seasonNumber),
  ]);

  const prizeFormatted =
    season.prizePoolUsdc >= 1000
      ? `$${(season.prizePoolUsdc / 1000).toFixed(0)}K`
      : `$${season.prizePoolUsdc}`;

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      {/* ── Top navigation bar ── */}
      <nav className="bg-white border-b border-[#dddbd5] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span
            className="font-display font-black text-lg tracking-tight text-[#2e3d47]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            ARENA
          </span>
          <span className="w-px h-4 bg-[#dddbd5]" />
          <span
            className="font-display font-light text-lg tracking-tight text-[#8a8880]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            PROTOCOL
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest hidden sm:block">
            Season {season.seasonNumber} · Day {season.seasonDay}
          </span>
          {/* Wallet connection placeholder — integrate with Adrena wallet adapter */}
          <button
            id="connect-wallet-btn"
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#2e3d47] text-[#2e3d47] hover:bg-[#2e3d47] hover:text-white transition-colors"
          >
            Connect
          </button>
        </div>
      </nav>

      {/* ── Season Stats Bar ── */}
      <SeasonStatsBar
        seasonNumber={season.seasonNumber}
        initialTraderCount={0}
        initialSquadCount={0}
      />

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* ── SECTION 1: Season Header ── */}
        <section>
          <SectionLabel>Active Season</SectionLabel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left: name + countdown */}
            <div className="space-y-6">
              {/* Lock day badge */}
              {season.isSquadLockDay && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#9b3d3d] text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white pulse-dot" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">
                    Squad Lock Day — Squads lock at midnight UTC
                  </span>
                </div>
              )}
              {season.squadsLocked && !season.isSquadLockDay && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#dddbd5]">
                  <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                    Squads locked · Day {season.seasonDay}
                  </span>
                </div>
              )}

              <div>
                <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-1">
                  Season {season.seasonNumber}
                </p>
                <h1
                  className="font-display font-black text-5xl sm:text-6xl text-[#2e3d47] leading-none tracking-tight"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {season.name.toUpperCase()}
                </h1>
              </div>

              <Countdown targetDate={season.endTs} label="ends in" />
            </div>

            {/* Right: prize pool + metrics */}
            <div className="space-y-4">
              <div className="bg-[#2e3d47] p-6">
                <p className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest mb-2">
                  Prize Pool
                </p>
                <p
                  className="font-display font-black text-5xl text-[#c8a96e] leading-none"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {prizeFormatted}
                  <span className="text-xl font-light text-[#8a9aaa] ml-2">
                    USDC
                  </span>
                </p>
                <div className="mt-4 pt-4 border-t border-[#3e4d57] grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[#8a9aaa] uppercase tracking-wider text-[10px]">
                      Individual
                    </span>
                    <p className="text-white font-semibold mt-0.5">60%</p>
                  </div>
                  <div>
                    <span className="text-[#8a9aaa] uppercase tracking-wider text-[10px]">
                      Squad
                    </span>
                    <p className="text-white font-semibold mt-0.5">20%</p>
                  </div>
                  <div>
                    <span className="text-[#8a9aaa] uppercase tracking-wider text-[10px]">
                      Participation
                    </span>
                    <p className="text-white font-semibold mt-0.5">10%</p>
                  </div>
                  <div>
                    <span className="text-[#8a9aaa] uppercase tracking-wider text-[10px]">
                      Achievements
                    </span>
                    <p className="text-white font-semibold mt-0.5">10%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mid-season event banner */}
          {midSeasonData && midSeasonData.phase !== "offseason" && (
            <div className="mt-6">
              <MidSeasonBanner
                phase={midSeasonData.phase}
                phaseLabel={midSeasonData.phaseLabel}
                seasonDay={midSeasonData.seasonDay}
              />
            </div>
          )}
        </section>

        {/* ── SECTION 2: My Stats Card ── */}
        <section>
          <SectionLabel>My Stats</SectionLabel>
          {/* wallet=null — wallet injection happens client-side via Adrena wallet adapter */}
          <MyStatsCard wallet={null} seasonNumber={season.seasonNumber} />
        </section>

        {/* ── SECTION 3: Leaderboard ── */}
        <section id="leaderboard">
          <SectionLabel>Leaderboard</SectionLabel>
          <div className="bg-white border border-[#dddbd5] p-6">
            <LeaderboardClient
              seasonNumber={season.seasonNumber}
              initialAll={allDivisions}
              ownWallet={null}
              ownDivision={null}
            />
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      {/* SquadPanel — floating slide-over, wallet/token injected client-side */}
      <SquadPanel
        seasonNumber={season.seasonNumber}
        wallet={null}
        token={null}
        isSquadLocked={season.squadsLocked}
        lockDay={3}
        seasonDay={season.seasonDay}
      />

      <footer className="border-t border-[#dddbd5] px-6 py-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="font-display font-black text-sm text-[#2e3d47] tracking-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              ARENA PROTOCOL
            </span>
            <span className="font-mono text-[10px] text-[#b0aea5]">
              Solana · Season {season.seasonNumber}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://adrena.trade"
              className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-widest transition-colors"
            >
              Adrena.trade
            </a>
            <a
              href="/api/config"
              className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-widest transition-colors"
            >
              Scoring Config
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
