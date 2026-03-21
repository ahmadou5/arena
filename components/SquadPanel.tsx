// src/components/SquadPanel.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import DivisionBadge from "./DivisionBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Squad {
  id: number;
  name: string;
  division: number;
  squadScore: number;
  rank: number | null;
  memberCount: number;
  spotsLeft: number;
  isLocked: boolean;
  synergyQuestWeeks: number;
  synergyStreakPeak: number;
  creatorWallet: string;
}

interface MySquadData {
  id: number;
  name: string;
  division: number;
  squadScore: number;
  rank: number | null;
  isLocked: boolean;
  synergyQuestWeeks: number;
  synergyStreakPeak: number;
  memberCount: number;
  members?: { wallet: string; joinedAt: string }[];
  questSyncCount?: number; // members who completed quest this week (0–5)
  tradeSyncStreak?: number; // consecutive days all members traded (0–7+)
}

interface LeaderboardSquad {
  id: number;
  name: string;
  division: number;
  squadScore: number;
  rank: number | null;
  memberCount: number;
  synergyQuestWeeks: number;
  synergyStreakPeak: number;
}

interface SquadPanelProps {
  seasonNumber: number;
  wallet: string | null;
  token: string | null;
  isSquadLocked: boolean;
  lockDay: number;
  seasonDay: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIV_NAMES: Record<number, string> = {
  1: "Grandmaster",
  2: "Diamond",
  3: "Platinum",
  4: "Gold",
  5: "Silver",
};

function shortWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function fmtScore(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000)?.toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000)?.toFixed(1)}K`;
  return n?.toFixed(0);
}

// ── Animated synergy bar ──────────────────────────────────────────────────────

function SynergyBar({
  label,
  value,
  max,
  active,
  color,
  icon,
  sublabel,
}: {
  label: string;
  value: number;
  max: number;
  active: boolean;
  color: string;
  icon: string;
  sublabel: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const filled = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-sm"
            style={{ color: active ? color : "#b0aea5" }}
          >
            {icon}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: active ? "#2e3d47" : "#b0aea5" }}
          >
            {label}
          </span>
          {filled && (
            <span
              className="font-mono text-[9px] px-1.5 py-0.5 uppercase tracking-wider"
              style={{ background: color + "20", color }}
            >
              Active
            </span>
          )}
        </div>
        <span
          className="font-mono text-[10px]"
          style={{ color: active ? color : "#b0aea5" }}
        >
          {value}/{max}
        </span>
      </div>

      {/* Track */}
      <div className="h-1.5 bg-[#eeece8] relative overflow-hidden rounded-sm">
        <div
          className="h-full rounded-sm transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: filled
              ? color
              : `linear-gradient(90deg, ${color}80, ${color})`,
          }}
        />
        {/* Animated shimmer when active */}
        {active && !filled && (
          <div
            className="absolute inset-0 animate-pulse opacity-20"
            style={{ background: color }}
          />
        )}
      </div>

      <p className="font-mono text-[9px] text-[#b0aea5]">{sublabel}</p>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-2.5 px-1 font-mono text-[10px] uppercase tracking-widest transition-colors border-b-2 ${
        active
          ? "border-[#2e3d47] text-[#2e3d47]"
          : "border-transparent text-[#8a8880] hover:text-[#2e3d47]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Connect prompt ────────────────────────────────────────────────────────────

function ConnectPrompt({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <div className="w-16 h-16 border-2 border-[#2e3d47] flex items-center justify-center">
        <span className="text-2xl text-[#2e3d47]">◈</span>
      </div>
      <div className="space-y-2">
        <p
          className="font-display font-black text-xl text-[#2e3d47] tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Connect Wallet
        </p>
        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest leading-relaxed">
          Connect your wallet to create
          <br />
          or join a squad
        </p>
      </div>
      <button
        className="font-mono text-xs uppercase tracking-widest px-6 py-3 bg-[#2e3d47] text-white hover:bg-[#3e5060] transition-colors w-full"
        onClick={() => document.getElementById("connect-wallet-btn")?.click()}
      >
        Connect
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 12 }: { w?: string | number; h?: number }) {
  return (
    <div className="skeleton rounded-sm" style={{ width: w, height: h }} />
  );
}

// ── My Squad view ─────────────────────────────────────────────────────────────

function MySquadView({
  squad,
  wallet,
  token,
  isSquadLocked,
  seasonDay,
  lockDay,
  onLeft,
}: {
  squad: MySquadData;
  wallet: string;
  token: string;
  isSquadLocked: boolean;
  seasonDay: number;
  lockDay: number;
  onLeft: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const daysUntilLock = Math.max(0, lockDay - seasonDay);

  const handleLeave = async () => {
    if (!confirm("Leave this squad? This cannot be undone after lock day."))
      return;
    setLeaving(true);
    setError(null);
    try {
      const r = await fetch("/api/squads/leave", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.ok) onLeft();
      else setError(d.error ?? "Could not leave squad");
    } catch {
      setError("Network error");
    } finally {
      setLeaving(false);
    }
  };

  // Synergy values
  const questSync = squad.questSyncCount ?? 0;
  const tradeSync = squad.tradeSyncStreak ?? 0;
  const maxMembers = 5;
  const questActive = questSync >= squad.memberCount;
  const tradeActive = tradeSync >= 7;

  return (
    <div className="flex flex-col gap-0 flex-1 overflow-y-auto">
      {/* Squad identity card */}
      <div className="bg-[#2e3d47] p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[10px] text-[#8a9aaa] uppercase tracking-widest mb-1">
              Your Squad · Season{" "}
              {squad.division > 0 ? DIV_NAMES[squad.division] : ""}
            </p>
            <h3
              className="font-display font-black text-2xl text-white tracking-wide leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {squad.name}
            </h3>
          </div>
          <DivisionBadge division={squad.division} size="md" />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#3e5060]">
          {[
            { label: "Rank", value: squad.rank ? `#${squad.rank}` : "—" },
            { label: "Score", value: fmtScore(squad.squadScore) },
            { label: "Members", value: `${squad.memberCount}/${maxMembers}` },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-mono text-[9px] text-[#8a9aaa] uppercase tracking-widest">
                {s.label}
              </p>
              <p
                className="font-display font-bold text-lg text-white leading-none mt-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="px-5 py-4 border-b border-[#dddbd5]">
        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-3">
          Members
        </p>
        <div className="space-y-2">
          {(squad.members ?? []).map((m, i) => (
            <div
              key={m.wallet}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] text-[#b0aea5] w-4">
                  {i + 1}
                </span>
                <a
                  href={`/trader/${m.wallet}`}
                  className="font-mono text-xs text-[#2e3d47] hover:text-[#7a9ab0] transition-colors"
                >
                  {shortWallet(m.wallet)}
                  {m.wallet === wallet && (
                    <span className="ml-1.5 text-[9px] text-[#c8a96e] uppercase tracking-wider">
                      you
                    </span>
                  )}
                </a>
              </div>
              <span className="font-mono text-[9px] text-[#b0aea5]">
                {new Date(m.joinedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
          {squad.memberCount < maxMembers && !squad.isLocked && (
            <div className="py-1.5 border border-dashed border-[#dddbd5] flex items-center justify-center">
              <span className="font-mono text-[10px] text-[#b0aea5] uppercase tracking-widest">
                {maxMembers - squad.memberCount} spot
                {maxMembers - squad.memberCount !== 1 ? "s" : ""} open
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Synergy meters */}
      <div className="px-5 py-4 border-b border-[#dddbd5] space-y-5">
        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
          Synergy
        </p>

        <SynergyBar
          label="Quest Sync"
          value={questSync}
          max={squad.memberCount}
          active={questActive}
          color="#3d7a5c"
          icon="◎"
          sublabel={
            questActive
              ? `All ${squad.memberCount} members synced this week · +5% squad score`
              : `${squad.memberCount - questSync} member${squad.memberCount - questSync !== 1 ? "s" : ""} yet to complete weekly quest`
          }
        />

        <SynergyBar
          label="Trade Streak"
          value={tradeSync}
          max={7}
          active={tradeActive}
          color="#7a9ab0"
          icon="⬡"
          sublabel={
            tradeActive
              ? `${tradeSync} consecutive days all members trading · +10% squad score`
              : `${tradeSync}/7 consecutive days — need ${7 - tradeSync} more day${7 - tradeSync !== 1 ? "s" : ""}`
          }
        />
      </div>

      {/* Leave button / lock notice */}
      <div className="px-5 py-4 mt-auto">
        {error && (
          <p className="font-mono text-[10px] text-[#9b3d3d] mb-3 uppercase tracking-wider">
            {error}
          </p>
        )}
        {!isSquadLocked ? (
          <div className="space-y-2">
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="w-full font-mono text-xs uppercase tracking-widest py-2.5 border border-[#9b3d3d] text-[#9b3d3d] hover:bg-[#9b3d3d] hover:text-white transition-colors disabled:opacity-40"
            >
              {leaving ? "Leaving…" : "Leave Squad"}
            </button>
            {daysUntilLock > 0 && (
              <p className="font-mono text-[9px] text-[#b0aea5] text-center">
                Squads lock in {daysUntilLock} day
                {daysUntilLock !== 1 ? "s" : ""} · Day {lockDay}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2.5 border border-[#dddbd5]">
            <span className="text-[11px] text-[#b0aea5]">🔒</span>
            <span className="font-mono text-[10px] text-[#b0aea5] uppercase tracking-widest">
              Squads locked · Day {lockDay}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Find / Join view ──────────────────────────────────────────────────────────

function FindSquadView({
  seasonNumber,
  wallet,
  token,
  onJoined,
}: {
  seasonNumber: number;
  wallet: string;
  token: string;
  onJoined: () => void;
}) {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [divFilter, setDivFilter] = useState<number | null>(null);
  const [joining, setJoining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const divQ = divFilter ? `&division=${divFilter}` : "";
      const r = await fetch(`/api/squads/open/${seasonNumber}?limit=30${divQ}`);
      const d = await r.json();
      if (d.ok) setSquads(d.squads);
    } finally {
      setLoading(false);
    }
  }, [seasonNumber, divFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (squadId: number) => {
    setJoining(squadId);
    setError(null);
    try {
      const r = await fetch(`/api/squads/join/${squadId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.ok) onJoined();
      else setError(d.error ?? "Could not join squad");
    } catch {
      setError("Network error");
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Division filter */}
      <div className="px-5 py-3 border-b border-[#dddbd5]">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setDivFilter(null)}
            className={`font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 transition-colors ${
              divFilter === null
                ? "bg-[#2e3d47] text-white"
                : "border border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47] hover:text-[#2e3d47]"
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              onClick={() => setDivFilter(divFilter === d ? null : d)}
              className={`font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 transition-colors ${
                divFilter === d
                  ? "bg-[#2e3d47] text-white"
                  : "border border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47] hover:text-[#2e3d47]"
              }`}
            >
              {["", "GM", "D", "P", "G", "S"][d]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-2 border-b border-[#9b3d3d20] bg-[#9b3d3d08]">
          <p className="font-mono text-[10px] text-[#9b3d3d] uppercase tracking-wider">
            {error}
          </p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="px-5 py-4 border-b border-[#dddbd5] space-y-2"
              >
                <Skeleton w={120} h={10} />
                <Skeleton w={80} h={8} />
              </div>
            ))}
          </div>
        ) : squads.length === 0 ? (
          <div className="px-5 py-12 text-center space-y-2">
            <p
              className="font-display font-bold text-lg text-[#2e3d47]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              No open squads
            </p>
            <p className="font-mono text-[10px] text-[#b0aea5] uppercase tracking-widest">
              {divFilter ? "Try another division" : "Be the first — create one"}
            </p>
          </div>
        ) : (
          <div>
            {squads.map((sq) => (
              <div
                key={sq.id}
                className="px-5 py-3.5 border-b border-[#dddbd5] hover:bg-[#f7f6f2] transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <DivisionBadge division={sq.division} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-[#2e3d47] text-sm leading-tight truncate">
                      {sq.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-[9px] text-[#8a8880]">
                        {sq.memberCount}/{5} members
                      </span>
                      <span className="font-mono text-[9px] text-[#8a8880]">
                        {DIV_NAMES[sq.division]?.slice(0, 4)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(sq.id)}
                  disabled={joining === sq.id}
                  className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-[#2e3d47] text-[#2e3d47] hover:bg-[#2e3d47] hover:text-white transition-colors disabled:opacity-40"
                >
                  {joining === sq.id ? "…" : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Squad view ─────────────────────────────────────────────────────────

function CreateSquadView({
  seasonNumber,
  token,
  onCreated,
}: {
  seasonNumber: number;
  token: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 32) {
      setError("Name must be 3–32 characters");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/squads/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed, seasonNumber }),
      });
      const d = await r.json();
      if (d.ok) onCreated();
      else setError(d.error ?? "Could not create squad");
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-5 py-5 space-y-5">
      <div>
        <label className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest block mb-2">
          Squad Name
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          maxLength={32}
          placeholder="e.g. Sigma Scalpers"
          className="w-full font-mono text-sm px-3 py-2.5 border border-[#dddbd5] bg-white text-[#2e3d47] placeholder-[#b0aea5] focus:outline-none focus:border-[#2e3d47] transition-colors"
        />
        <div className="flex justify-between mt-1.5">
          <span className="font-mono text-[9px] text-[#b0aea5]">
            3–32 characters · letters, numbers, spaces, _ -
          </span>
          <span
            className={`font-mono text-[9px] ${name.length > 28 ? "text-[#9b3d3d]" : "text-[#b0aea5]"}`}
          >
            {name.length}/32
          </span>
        </div>
      </div>

      {error && (
        <p className="font-mono text-[10px] text-[#9b3d3d] uppercase tracking-wider">
          {error}
        </p>
      )}

      <button
        onClick={handleCreate}
        disabled={creating || name.trim().length < 3}
        className="w-full font-mono text-xs uppercase tracking-widest py-3 bg-[#2e3d47] text-white hover:bg-[#3e5060] transition-colors disabled:opacity-40"
      >
        {creating ? "Creating…" : "Create Squad"}
      </button>

      <div className="space-y-1.5 pt-2 border-t border-[#dddbd5]">
        {[
          "Your division determines the squad division",
          "You are automatically added as the first member",
          `Squads lock on Day ${3} — no changes after`,
          "Members must have ≥1 closed position to join",
        ].map((note, i) => (
          <p
            key={i}
            className="font-mono text-[9px] text-[#b0aea5] flex items-start gap-2"
          >
            <span className="text-[#dddbd5] mt-0.5">—</span>
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Squad Leaderboard tab ─────────────────────────────────────────────────────

function SquadLeaderboard({
  seasonNumber,
  mySquadId,
}: {
  seasonNumber: number;
  mySquadId: number | null;
}) {
  const [squads, setSquads] = useState<LeaderboardSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/leaderboard/${seasonNumber}/squads?page=${p}&limit=20`,
        );
        const d = await r.json();
        if (d.ok) {
          setSquads(d.squads);
          setTotalPages(d.totalPages);
          setPage(p);
        }
      } finally {
        setLoading(false);
      }
    },
    [seasonNumber],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-[#2e3d47] grid grid-cols-[24px_1fr_60px_52px] gap-0">
          {["#", "Squad", "Score", "Syn"].map((h) => (
            <div
              key={h}
              className="py-2 px-3 font-mono text-[9px] uppercase tracking-widest text-[#8a8880]"
            >
              {h}
            </div>
          ))}
        </div>

        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="px-3 py-3 border-b border-[#dddbd5] flex items-center gap-3"
              >
                <Skeleton w={20} h={8} />
                <Skeleton w={100} h={8} />
                <Skeleton w={50} h={8} />
              </div>
            ))
          : squads.map((sq) => {
              const isOwn = sq.id === mySquadId;
              const hasSyn =
                sq.synergyQuestWeeks > 0 || sq.synergyStreakPeak >= 7;
              return (
                <div
                  key={sq.id}
                  className={`grid grid-cols-[24px_1fr_60px_52px] gap-0 border-b transition-colors ${
                    isOwn
                      ? "bg-[#2e3d47] border-[#3e5060]"
                      : "border-[#dddbd5] hover:bg-[#f7f6f2]"
                  }`}
                >
                  <div
                    className={`py-3 px-3 font-mono text-[10px] ${isOwn ? "text-[#8a9aaa]" : "text-[#b0aea5]"}`}
                  >
                    {sq.rank ?? "—"}
                  </div>
                  <div className="py-3 px-3 flex items-center gap-2 min-w-0">
                    <DivisionBadge division={sq.division} size="sm" />
                    <div className="min-w-0">
                      <p
                        className={`font-medium text-xs leading-tight truncate ${isOwn ? "text-white" : "text-[#2e3d47]"}`}
                      >
                        {sq.name}
                        {isOwn && (
                          <span className="ml-1.5 text-[9px] text-[#c8a96e]">
                            you
                          </span>
                        )}
                      </p>
                      <p
                        className={`font-mono text-[9px] ${isOwn ? "text-[#8a9aaa]" : "text-[#b0aea5]"}`}
                      >
                        {sq.memberCount}/5
                      </p>
                    </div>
                  </div>
                  <div
                    className={`py-3 px-3 font-mono text-[10px] font-semibold ${isOwn ? "text-white" : "text-[#2e3d47]"}`}
                  >
                    {fmtScore(sq.squadScore)}
                  </div>
                  <div className="py-3 px-3 flex items-center gap-1">
                    {hasSyn ? (
                      <>
                        {sq.synergyQuestWeeks > 0 && (
                          <span
                            className="text-[10px] text-[#3d7a5c]"
                            title="Quest synergy"
                          >
                            Q
                          </span>
                        )}
                        {sq.synergyStreakPeak >= 7 && (
                          <span
                            className="text-[10px] text-[#7a9ab0]"
                            title="Streak synergy"
                          >
                            S
                          </span>
                        )}
                      </>
                    ) : (
                      <span
                        className={`font-mono text-[9px] ${isOwn ? "text-[#8a9aaa]" : "text-[#b0aea5]"}`}
                      >
                        —
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#dddbd5]">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1}
            className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] disabled:opacity-30 uppercase tracking-wider"
          >
            ← prev
          </button>
          <span className="font-mono text-[10px] text-[#8a8880]">
            {page}/{totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= totalPages}
            className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] disabled:opacity-30 uppercase tracking-wider"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main SquadPanel ───────────────────────────────────────────────────────────

export default function SquadPanel({
  seasonNumber,
  wallet,
  token,
  isSquadLocked,
  lockDay,
  seasonDay,
}: SquadPanelProps) {
  type PanelView = "my-squad" | "find" | "create";
  type TabId = "squad" | "leaderboard";

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("squad");
  const [view, setView] = useState<PanelView>("find");
  const [mySquad, setMySquad] = useState<MySquadData | null>(null);
  const [loadingMySquad, setLoadingMySquad] = useState(false);

  // Fetch user's squad status when wallet is connected
  const loadMySquad = useCallback(async () => {
    if (!wallet) return;
    setLoadingMySquad(true);
    try {
      const r = await fetch(`/api/trader/${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.ok && d.squad) {
        const squadDetail: MySquadData = {
          id: d.squad.id,
          name: d.squad.name,
          division: d.squad.division ?? 5,
          squadScore: Number(d.squad.squadScore ?? 0),
          rank: d.squad.rank ?? null,
          isLocked: d.squad.isLocked ?? false,
          synergyQuestWeeks: d.squad.synergyQuestWeeks ?? 0,
          synergyStreakPeak: d.squad.synergyStreakPeak ?? 0,
          memberCount: d.squad.memberCount ?? 1,
          members: [],
          questSyncCount:
            d.squad.synergyQuestWeeks > 0 ? (d.squad.memberCount ?? 1) : 0,
          tradeSyncStreak: d.squad.synergyStreakPeak ?? 0,
        };
        setMySquad(squadDetail);
        setView("my-squad");
      } else {
        setMySquad(null);
        setView("find");
      }
    } catch (err) {
      console.error("[SquadPanel] loadMySquad failed:", err);
      setMySquad(null);
      setView("find");
    } finally {
      setLoadingMySquad(false);
    }
  }, [wallet, seasonNumber]);

  useEffect(() => {
    if (wallet) loadMySquad();
    else {
      setMySquad(null);
      setView("find");
    }
  }, [wallet, loadMySquad]);

  const handleLeft = () => {
    setMySquad(null);
    setView("find");
    loadMySquad();
  };
  const handleJoined = () => loadMySquad();
  const handleCreated = () => loadMySquad();

  // Trap escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Trigger button — floating */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-5 py-3 bg-[#2e3d47] text-white shadow-lg hover:bg-[#3e5060] transition-all group"
        style={{ boxShadow: "0 4px 20px rgba(46,61,71,0.35)" }}
      >
        <span className="text-base">◈</span>
        <span className="font-mono text-xs uppercase tracking-widest">
          Squads
        </span>
        {mySquad && (
          <span className="font-mono text-[9px] text-[#c8a96e] ml-1 uppercase tracking-wider truncate max-w-[80px]">
            {mySquad.name}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-over panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-white border-l border-[#dddbd5]"
        style={{
          width: "min(420px, 100vw)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: isOpen ? "-8px 0 40px rgba(0,0,0,0.12)" : "none",
        }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dddbd5] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="font-display font-black text-lg text-[#2e3d47] tracking-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              SQUADS
            </span>
            <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
              S{seasonNumber}
            </span>
            {isSquadLocked && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 border border-[#dddbd5] text-[#9b3d3d] uppercase tracking-wider">
                Locked
              </span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="font-mono text-[#8a8880] hover:text-[#2e3d47] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Top tabs */}
        <div className="flex gap-5 px-5 border-b border-[#dddbd5] flex-shrink-0">
          <PanelTab active={tab === "squad"} onClick={() => setTab("squad")}>
            My Squad
          </PanelTab>
          <PanelTab
            active={tab === "leaderboard"}
            onClick={() => setTab("leaderboard")}
          >
            Leaderboard
          </PanelTab>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === "leaderboard" ? (
            <SquadLeaderboard
              seasonNumber={seasonNumber}
              mySquadId={mySquad?.id ?? null}
            />
          ) : (
            <>
              {/* No wallet */}
              {!wallet ? (
                <ConnectPrompt onClose={() => setIsOpen(false)} />
              ) : loadingMySquad ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="space-y-3 w-full px-8">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} h={14} />
                    ))}
                  </div>
                </div>
              ) : mySquad ? (
                <MySquadView
                  squad={mySquad}
                  wallet={wallet}
                  token={token!}
                  isSquadLocked={isSquadLocked}
                  seasonDay={seasonDay}
                  lockDay={lockDay}
                  onLeft={handleLeft}
                />
              ) : (
                <>
                  {/* Sub-tabs: Find vs Create */}
                  <div className="flex border-b border-[#dddbd5] flex-shrink-0">
                    {(["find", "create"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`flex-1 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                          view === v
                            ? "bg-[#2e3d47] text-white"
                            : "text-[#8a8880] hover:text-[#2e3d47] hover:bg-[#f7f6f2]"
                        }`}
                      >
                        {v === "find" ? "Find Squad" : "Create Squad"}
                      </button>
                    ))}
                  </div>

                  {view === "find" ? (
                    <FindSquadView
                      seasonNumber={seasonNumber}
                      wallet={wallet}
                      token={token!}
                      onJoined={handleJoined}
                    />
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {isSquadLocked ? (
                        <div className="px-5 py-12 text-center space-y-3">
                          <span className="text-3xl">🔒</span>
                          <p
                            className="font-display font-bold text-lg text-[#2e3d47]"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                            }}
                          >
                            Squads are locked
                          </p>
                          <p className="font-mono text-[10px] text-[#b0aea5] uppercase tracking-widest">
                            Squad creation closed after Day {lockDay}
                          </p>
                        </div>
                      ) : (
                        <CreateSquadView
                          seasonNumber={seasonNumber}
                          token={token!}
                          onCreated={handleCreated}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
