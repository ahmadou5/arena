// src/components/MidSeasonEvents.tsx
// Mid-season event UI: Gauntlet, Halfway Shake, Final Push banners + overlays
"use client";
import { useState, useEffect } from "react";
import Countdown from "@/components/Countdown";

interface EventData {
  phase: string;
  phaseLabel: string;
  seasonDay: number;
  seasonNumber: number;
  seasonEndTs?: string;
  standings: Array<{
    wallet: string;
    rankInDivision?: number;
    totalCps?: number;
    winRate?: number;
    totalTrades?: number;
    division?: number;
    improvement?: number;
  }>;
}

interface DivisionSummary {
  wallet: string;
  totalCps: number;
  rankInDivision: number | null;
  division: number;
  totalTrades: number;
  winningTrades: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}
function fmtCps(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

// ── Countdown to Gauntlet end ─────────────────────────────────────────────────

function gauntletEndDate(seasonNumber: number, startTs: Date): Date {
  // Day 10 end = startTs + 10 days
  return new Date(startTs.getTime() + 10 * 86_400_000);
}

// ══════════════════════════════════════════════════════════════════════════════
// GAUNTLET BANNER (Days 7–10)
// Full-width gold banner with live countdown + top 5 CPS gainers
// ══════════════════════════════════════════════════════════════════════════════

function GauntletBanner({
  data,
  gauntletEnd,
}: {
  data: EventData;
  gauntletEnd: Date;
}) {
  const top5 = data.standings.slice(0, 5);

  return (
    <div className="w-full" style={{ animation: "fadeInDown 0.4s ease-out" }}>
      {/* Main gold banner */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1a2830 0%, #2e3d47 40%, #3a4f5e 100%)",
        }}
      >
        {/* Diagonal stripe overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #c8a96e 0, #c8a96e 1px, transparent 0, transparent 50%)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Flash indicator */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background:
              "linear-gradient(90deg, transparent, #c8a96e, transparent)",
            animation: "shimmerBar 2s ease-in-out infinite",
          }}
        />

        <div className="relative px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="text-2xl"
              style={{ animation: "pulse 1.5s ease-in-out infinite" }}
            >
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="font-display font-black text-xl text-white tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  GAUNTLET LIVE
                </span>
                <span
                  className="font-mono text-[10px] px-2 py-0.5 text-[#c8a96e] uppercase tracking-widest"
                  style={{
                    border: "1px solid #c8a96e4a",
                    background: "#c8a96e18",
                  }}
                >
                  1.5× CPS
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#8a9aaa] mt-0.5 uppercase tracking-widest">
                Day {data.seasonDay} · All positions earn 1.5× normal CPS
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest hidden sm:block">
              Ends
            </span>
            <div className="font-mono text-sm text-[#c8a96e] font-semibold">
              <CountdownInline targetDate={gauntletEnd} />
            </div>
          </div>
        </div>

        {/* Top 5 mini-leaderboard */}
        {top5.length > 0 && (
          <div
            className="border-t px-6 pb-4 pt-3 grid grid-cols-5 gap-2"
            style={{ borderColor: "#c8a96e22" }}
          >
            {top5.map((entry, i) => (
              <div
                key={entry.wallet}
                className="flex flex-col items-center gap-1 text-center"
              >
                <span
                  className="font-display font-black text-base"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color:
                      i === 0
                        ? "#c8a96e"
                        : i === 1
                          ? "#a0b8c8"
                          : i === 2
                            ? "#c8a06e"
                            : "#6a8090",
                  }}
                >
                  {i === 0 ? "◆" : i === 1 ? "◇" : i === 2 ? "◈" : `${i + 1}`}
                </span>
                <span className="font-mono text-[9px] text-[#8a9aaa]">
                  {shortWallet(entry.wallet)}
                </span>
                <span className="font-mono text-[10px] font-semibold text-white">
                  {entry.totalCps !== undefined ? fmtCps(entry.totalCps) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline compact countdown (hh:mm:ss)
function CountdownInline({ targetDate }: { targetDate: Date }) {
  const [t, setT] = useState({ h: 0, m: 0, s: 0, expired: false });
  useEffect(() => {
    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setT({ h: 0, m: 0, s: 0, expired: true });
        return;
      }
      setT({
        h: Math.floor(diff / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1_000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate.getTime()]);
  if (t.expired) return <span>Ended</span>;
  return (
    <span>
      {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:
      {String(t.s).padStart(2, "0")}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HALFWAY SHAKE WARNING (Day 14)
// Returned as overlay data for My Stats card + leaderboard row decorators
// ══════════════════════════════════════════════════════════════════════════════

export interface HalfwayShakeStatus {
  isBottomQuintile: boolean; // bottom 15%
  isTopHalf: boolean; // top 50%
  totalInDivision: number;
  myRank: number | null;
}

export function computeHalfwayStatus(
  myRank: number | null,
  totalInDiv: number,
): HalfwayShakeStatus {
  if (!myRank || totalInDiv === 0) {
    return {
      isBottomQuintile: false,
      isTopHalf: false,
      totalInDivision: totalInDiv,
      myRank: null,
    };
  }
  const pct = myRank / totalInDiv;
  return {
    isBottomQuintile: pct >= 0.85,
    isTopHalf: pct <= 0.5,
    totalInDivision: totalInDiv,
    myRank,
  };
}

export function HalfwayShakeWarning({
  status,
}: {
  status: HalfwayShakeStatus;
}) {
  if (!status.isBottomQuintile) return null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-l-4"
      style={{ borderColor: "#e07820", background: "#e0782012" }}
    >
      <span className="text-base">⚠</span>
      <div>
        <p className="font-mono text-[10px] text-[#e07820] uppercase tracking-widest font-semibold">
          {`Halfway Shake — You're at risk`}
        </p>
        <p className="font-mono text-[9px] text-[#b0aea5] mt-0.5">
          Rank #{status.myRank} of {status.totalInDivision} · Bottom 15% at Day
          14
        </p>
      </div>
    </div>
  );
}

// Leaderboard row decorator props
export function getLeaderboardRowStyle(
  rank: number | null,
  totalInDiv: number,
  isSeasonDay14: boolean,
): { borderLeft?: string; checkmark?: boolean; danger?: boolean } {
  if (!rank || totalInDiv === 0 || !isSeasonDay14) return {};
  const pct = rank / totalInDiv;
  if (pct >= 0.85) return { borderLeft: "3px solid #e07820", danger: true };
  if (pct <= 0.5) return { checkmark: true };
  return {};
}

// ══════════════════════════════════════════════════════════════════════════════
// FINAL PUSH (Days 21–28)
// Trophy cards for top 3 per division above leaderboard
// Large countdown as dominant UI
// ══════════════════════════════════════════════════════════════════════════════

interface TrophyEntry {
  wallet: string;
  totalCps: number;
  rankInDivision: number;
}

function TrophyCard({
  entry,
  position,
}: {
  entry: TrophyEntry;
  position: 1 | 2 | 3;
}) {
  const meta: Record<
    number,
    { icon: string; label: string; color: string; bg: string }
  > = {
    1: { icon: "🥇", label: "1st", color: "#c8a96e", bg: "#c8a96e14" },
    2: { icon: "🥈", label: "2nd", color: "#a0b8c8", bg: "#a0b8c814" },
    3: { icon: "🥉", label: "3rd", color: "#c8906e", bg: "#c8906e14" },
  };
  const { icon, label, color, bg } = meta[position];

  return (
    <div
      className="flex-1 min-w-0 flex flex-col items-center gap-2 py-4 px-3 border text-center"
      style={{ borderColor: color + "4a", background: bg }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p
          className="font-display font-black text-base leading-tight"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}
        >
          {label}
        </p>
        <p className="font-mono text-[9px] text-[#8a8880] mt-0.5">
          {shortWallet(entry.wallet)}
        </p>
      </div>
      <p className="font-mono text-xs font-semibold text-[#2e3d47]">
        {fmtCps(entry.totalCps)}
      </p>
    </div>
  );
}

function FinalPushBanner({
  data,
  seasonEndTs,
}: {
  data: EventData;
  seasonEndTs: string;
}) {
  const top3 = data.standings.slice(0, 3) as TrophyEntry[];

  return (
    <div className="space-y-6">
      {/* Dominant countdown */}
      <div className="bg-[#2e3d47] px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest mb-1">
            Final Push · Day {data.seasonDay} of 28
          </p>
          <p
            className="font-display font-black text-3xl text-white tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            SEASON ENDS IN
          </p>
        </div>
        <div className="flex items-end gap-1">
          {/* Large countdown — reuses Countdown component with xl sizing */}
          <Countdown targetDate={seasonEndTs} label="" />
        </div>
      </div>

      {/* Trophy podium — top 3 */}
      {top3.length >= 1 && (
        <div>
          <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-3">
            Current Podium
          </p>
          <div className="flex gap-3">
            {top3.map((entry, i) => (
              <TrophyCard
                key={entry.wallet}
                entry={entry}
                position={(i + 1) as 1 | 2 | 3}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — MidSeasonEvents
// Fetches event data and renders the appropriate phase UI
// ══════════════════════════════════════════════════════════════════════════════

interface MidSeasonEventsProps {
  seasonNumber: number;
  seasonDay: number;
  seasonEndTs: string;
  seasonStartTs: string;
  myRank?: number | null;
  myTotalInDiv?: number;
}

export default function MidSeasonEvents({
  seasonNumber,
  seasonDay,
  seasonEndTs,
  seasonStartTs,
  myRank,
  myTotalInDiv = 0,
}: MidSeasonEventsProps) {
  const [data, setData] = useState<EventData | null>(null);

  useEffect(() => {
    fetch(`/api/leaderboard/${seasonNumber}/mid-season-event`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      });
  }, [seasonNumber]);

  if (!data) return null;

  const phase = data.phase;

  // Day 7–10: Gauntlet — fires on days 7-10 regardless of API phase label
  // (API returns 'momentum' on day 7+ but we want Gauntlet overlay for days 7-10)
  if (seasonDay >= 7 && seasonDay <= 10) {
    const startTs = new Date(seasonStartTs);
    const gEnd = gauntletEndDate(seasonNumber, startTs);
    return <GauntletBanner data={data} gauntletEnd={gEnd} />;
  }

  // Day 21–28: Final Push
  if (phase === "sprint" || seasonDay >= 21) {
    return <FinalPushBanner data={data} seasonEndTs={seasonEndTs} />;
  }

  return null;
}

// CSS for animations — injected via style tag in layout
export const midSeasonStyles = `
@keyframes fadeInDown {
  from { opacity:0; transform:translateY(-12px) }
  to   { opacity:1; transform:translateY(0) }
}
@keyframes shimmerBar {
  0%,100% { opacity:0.4 }
  50%      { opacity:1 }
}
`;
