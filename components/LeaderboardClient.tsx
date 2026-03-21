// src/components/LeaderboardClient.tsx
"use client";
import { useState, useEffect, useCallback } from "react";

interface LeaderboardEntry {
  wallet: string;
  totalCps: number;
  rankInDivision: number | null;
  winRate?: number;
  winningTrades?: number;
  totalTrades?: number;
}

interface SquadEntry {
  id: number;
  name: string;
  division: number;
  squadScore: number;
  rank: number | null;
  memberCount: number;
  synergyQuestWeeks: number;
  synergyStreakPeak: number;
}

interface DivisionGroup {
  division: number;
  name: string;
  entries: LeaderboardEntry[];
}

const DIV_NAMES: Record<number, string> = {
  1: "Grandmaster",
  2: "Diamond",
  3: "Platinum",
  4: "Gold",
  5: "Silver",
};

const DIV_COLORS: Record<number, string> = {
  1: "#c8a96e",
  2: "#7ab0c8",
  3: "#a0a0c8",
  4: "#c8a06e",
  5: "#8a9a8a",
};

function fmtCps(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000)?.toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000)?.toFixed(1)}K`;
  return n?.toFixed(0);
}

function shortWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#dddbd5]">
      {[40, 120, 80, 70, 70].map((w, i) => (
        <td key={i} className="py-3 px-4">
          <div className="skeleton h-3 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#3d7a5c] uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-full bg-[#3d7a5c] pulse-dot inline-block" />
      live
    </span>
  );
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
function Tab({ active, onClick, children }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 px-1 font-mono text-xs uppercase tracking-widest transition-colors ${
        active
          ? "tab-active text-[#2e3d47] font-medium"
          : "text-[#8a8880] hover:text-[#2e3d47]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Division table ────────────────────────────────────────────────────────────

function DivisionTable({
  entries,
  ownWallet,
  loading,
  page,
  totalPages,
  onPage,
  myRank,
  totalTraders,
  division,
}: {
  entries: LeaderboardEntry[];
  ownWallet: string | null;
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  myRank: number | null;
  totalTraders: number;
  division: number;
}) {
  const ownOnPage = entries.some((e) => e.wallet === ownWallet);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className="font-display font-bold text-sm tracking-wide text-[#2e3d47]"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: DIV_COLORS[division],
            }}
          >
            {DIV_NAMES[division]}
          </span>
          <span className="font-mono text-[10px] text-[#8a8880]">
            {totalTraders} traders
          </span>
          {ownWallet && myRank && (
            <span className="font-mono text-[10px] text-[#7a9ab0]">
              your rank #{myRank}
            </span>
          )}
        </div>
        <LiveDot />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#2e3d47]">
              {["#", "Wallet", "CPS", "Win Rate", "Trades"].map((h) => (
                <th
                  key={h}
                  className="py-2 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#8a8880]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
              : entries.map((e) => {
                  const isOwn = e.wallet === ownWallet;
                  return (
                    <tr
                      key={e.wallet}
                      className={`border-b border-[#dddbd5] transition-colors ${
                        isOwn ? "own-row" : "hover:bg-[#f0eeea]"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-xs font-medium w-12">
                        {e.rankInDivision ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono text-xs ${isOwn ? "text-white" : "text-[#2e3d47]"}`}
                        >
                          {shortWallet(e.wallet)}
                          {isOwn && (
                            <span className="ml-2 text-[10px] text-[#c8a96e] font-medium uppercase tracking-wider">
                              you
                            </span>
                          )}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 font-mono text-xs font-semibold ${isOwn ? "text-white" : "text-[#2e3d47]"}`}
                      >
                        {fmtCps(e.totalCps)}
                      </td>
                      <td
                        className={`py-3 px-4 font-mono text-xs ${
                          isOwn
                            ? "text-white"
                            : (e.winRate ?? 0) >= 0.5
                              ? "text-[#3d7a5c]"
                              : "text-[#9b3d3d]"
                        }`}
                      >
                        {((e.winRate ?? 0) * 100)?.toFixed(0)}%
                      </td>
                      <td
                        className={`py-3 px-4 font-mono text-xs ${isOwn ? "text-[#d3d3d3]" : "text-[#8a8880]"}`}
                      >
                        {e.totalTrades}
                      </td>
                    </tr>
                  );
                })}
            {/* Own wallet off-page indicator */}
            {!loading && ownWallet && myRank && !ownOnPage && (
              <tr className="border-t-2 border-[#2e3d47] bg-[#2e3d47]">
                <td className="py-3 px-4 font-mono text-xs text-white">
                  #{myRank}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-white">
                  {shortWallet(ownWallet)}
                  <span className="ml-2 text-[10px] text-[#c8a96e] uppercase tracking-wider">
                    you
                  </span>
                </td>
                <td
                  colSpan={3}
                  className="py-3 px-4 font-mono text-[10px] text-[#7a9ab0]"
                >
                  {`off-page — you're ranked #${myRank} of ${totalTraders}`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#dddbd5]">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="font-mono text-xs text-[#8a8880] hover:text-[#2e3d47] disabled:opacity-30 uppercase tracking-wider transition-colors"
          >
            ← prev
          </button>
          <span className="font-mono text-xs text-[#8a8880]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="font-mono text-xs text-[#8a8880] hover:text-[#2e3d47] disabled:opacity-30 uppercase tracking-wider transition-colors"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Squads table ──────────────────────────────────────────────────────────────

function SquadsTable({
  squads,
  loading,
}: {
  squads: SquadEntry[];
  loading: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#2e3d47]">
            {["#", "Squad", "Div", "Score", "Members", "Synergy"].map((h) => (
              <th
                key={h}
                className="py-2 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#8a8880]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
            : squads.map((sq) => (
                <tr
                  key={sq.id}
                  className="border-b border-[#dddbd5] hover:bg-[#f0eeea] transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs w-12">
                    {sq.rank ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-[#2e3d47] text-sm">
                      {sq.name}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: DIV_COLORS[sq.division] + "20",
                        color: DIV_COLORS[sq.division],
                      }}
                    >
                      {DIV_NAMES[sq.division]?.slice(0, 4).toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[#2e3d47]">
                    {fmtCps(sq.squadScore)}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#8a8880]">
                    {sq.memberCount}/5
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {sq.synergyQuestWeeks > 0 && (
                        <span
                          className="font-mono text-[10px] text-[#3d7a5c]"
                          title="Quest synergy weeks"
                        >
                          Q{sq.synergyQuestWeeks}
                        </span>
                      )}
                      {sq.synergyStreakPeak >= 7 && (
                        <span
                          className="font-mono text-[10px] text-[#7a9ab0]"
                          title="Streak synergy"
                        >
                          S{sq.synergyStreakPeak}d
                        </span>
                      )}
                      {sq.synergyQuestWeeks === 0 &&
                        sq.synergyStreakPeak < 7 && (
                          <span className="font-mono text-[10px] text-[#b0aea5]">
                            —
                          </span>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && squads.length === 0 && (
        <div className="py-12 text-center font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
          No squads yet this season
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface LeaderboardClientProps {
  seasonNumber: number;
  initialAll: DivisionGroup[];
  ownWallet: string | null;
  ownDivision: number | null;
}

export default function LeaderboardClient({
  seasonNumber,
  initialAll,
  ownWallet,
  ownDivision,
}: LeaderboardClientProps) {
  type Tab = "mine" | "all" | "squads";
  const defaultTab: Tab = ownDivision ? "mine" : "all";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [divData, setDivData] = useState<LeaderboardEntry[]>([]);
  const [allData, setAllData] = useState<DivisionGroup[]>(initialAll);
  const [squadsData, setSquadsData] = useState<SquadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTraders, setTotalTraders] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const activeDivision = ownDivision ?? 5;

  const fetchDivision = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const walletQ = ownWallet ? `&wallet=${ownWallet}` : "";
        const r = await fetch(
          `/api/leaderboard/${seasonNumber}/division/${activeDivision}?page=${p}&limit=50${walletQ}`,
        );
        const d = await r.json();
        if (d.ok) {
          setDivData(d.leaderboard);
          setTotalPages(d.totalPages);
          setTotalTraders(d.totalTraders);
          setMyRank(d.myRank);
          setPage(p);
        }
      } finally {
        setLoading(false);
      }
    },
    [seasonNumber, activeDivision, ownWallet],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard/${seasonNumber}/all`);
      const d = await r.json();
      if (d.ok) setAllData(d.divisions);
    } finally {
      setLoading(false);
    }
  }, [seasonNumber]);

  const fetchSquads = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard/${seasonNumber}/squads?limit=50`);
      const d = await r.json();
      if (d.ok) setSquadsData(d.squads);
    } finally {
      setLoading(false);
    }
  }, [seasonNumber]);

  // Initial load per tab
  useEffect(() => {
    if (tab === "mine") fetchDivision(1);
    if (tab === "all") fetchAll();
    if (tab === "squads") fetchSquads();
  }, [tab]);

  // 30s silent refresh
  useEffect(() => {
    const id = setInterval(() => {
      if (tab === "mine") fetchDivision(page);
      if (tab === "all") fetchAll();
      if (tab === "squads") fetchSquads();
    }, 30_000);
    return () => clearInterval(id);
  }, [tab, page, fetchDivision, fetchAll, fetchSquads]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-6 border-b border-[#dddbd5] mb-6">
        <Tab active={tab === "mine"} onClick={() => setTab("mine")}>
          My Division
        </Tab>
        <Tab active={tab === "all"} onClick={() => setTab("all")}>
          All Divisions
        </Tab>
        <Tab active={tab === "squads"} onClick={() => setTab("squads")}>
          Squads
        </Tab>
      </div>

      {/* My Division */}
      {tab === "mine" && (
        <DivisionTable
          entries={divData}
          ownWallet={ownWallet}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPage={(p) => fetchDivision(p)}
          myRank={myRank}
          totalTraders={totalTraders}
          division={activeDivision}
        />
      )}

      {/* All Divisions */}
      {tab === "all" && (
        <div className="space-y-8">
          {(loading && allData.length === 0
            ? [1, 2, 3, 4, 5].map((d) => ({
                division: d,
                name: DIV_NAMES[d],
                entries: [],
              }))
            : allData
          ).map((div) => (
            <div key={div.division}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-1 h-4 rounded-full"
                  style={{ background: DIV_COLORS[div.division] }}
                />
                <span
                  className="font-display font-bold text-sm tracking-wide"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: DIV_COLORS[div.division],
                  }}
                >
                  {div.name}
                </span>
                <span className="font-mono text-[10px] text-[#8a8880]">
                  Top 10
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dddbd5]">
                    {["#", "Wallet", "CPS", "Win%", "Trades"].map((h) => (
                      <th
                        key={h}
                        className="py-1.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#b0aea5]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && div.entries.length === 0
                    ? Array.from({ length: 5 }, (_, i) => (
                        <SkeletonRow key={i} />
                      ))
                    : div.entries.map((e) => {
                        const isOwn = e.wallet === ownWallet;
                        return (
                          <tr
                            key={e.wallet}
                            className={`border-b border-[#f0eeea] transition-colors ${isOwn ? "own-row" : "hover:bg-[#f7f6f2]"}`}
                          >
                            <td className="py-2.5 px-4 font-mono text-xs w-10">
                              {e.rankInDivision}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs">
                              {shortWallet(e.wallet)}
                              {isOwn && (
                                <span className="ml-2 text-[10px] text-[#c8a96e]">
                                  you
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs font-semibold">
                              {fmtCps(e.totalCps)}
                            </td>
                            <td
                              className={`py-2.5 px-4 font-mono text-xs ${!isOwn && ((e.winRate ?? 0) >= 0.5 ? "text-[#3d7a5c]" : "text-[#9b3d3d]")}`}
                            >
                              {((e.winRate ?? 0) * 100)?.toFixed(0)}%
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs text-[#8a8880]">
                              {e.totalTrades}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Squads */}
      {tab === "squads" && (
        <SquadsTable squads={squadsData} loading={loading} />
      )}
    </div>
  );
}
