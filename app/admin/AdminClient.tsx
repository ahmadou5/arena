// src/app/admin/AdminClient.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import ConnectButton from "@/components/ConnectButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  startTs: string;
  endTs: string;
  offseasonEndTs: string;
  isActive: boolean;
  prizePoolUsdc: number;
  createdAt: string;
  traderCount: number;
  squadCount: number;
  recordCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateInput(iso: string) {
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM for datetime-local input
}

function todayISO() {
  return new Date().toISOString().slice(0, 16);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 16);
}

function getSeasonDay(startTs: string, endTs: string) {
  const now = Date.now();
  const start = new Date(startTs).getTime();
  const end = new Date(endTs).getTime();
  if (now < start) return "Not started";
  if (now > end) return "Ended";
  return `Day ${Math.floor((now - start) / 86_400_000) + 1}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest">
        {label}
      </span>
      <span
        className="font-mono text-sm font-semibold"
        style={{ color: color ?? "#2e3d47" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Close confirmation modal ───────────────────────────────────────────────────

function CloseConfirmModal({
  season,
  onConfirm,
  onCancel,
  loading,
}: {
  season: Season;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState("");
  const confirmed = typed === String(season.seasonNumber);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-[#2e3d47] w-full max-w-md">
        <div className="h-1 bg-[#9b3d3d]" />
        <div className="p-6 space-y-4">
          <div>
            <p
              className="font-display font-black text-xl text-[#2e3d47]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Close Season {season.seasonNumber}?
            </p>
            <p className="font-mono text-[10px] text-[#8a8880] mt-1 leading-relaxed">
              This will finalise all rankings, update Arena Ratings, process
              promotion/relegation, detect achievements, and allocate prizes.
              This cannot be undone.
            </p>
          </div>

          <div className="bg-[#f7f6f2] border border-[#dddbd5] p-3 space-y-1">
            <StatPill
              label="Season"
              value={`S${season.seasonNumber} — ${season.name}`}
            />
            <StatPill label="Traders" value={season.traderCount} />
            <StatPill label="Squads" value={season.squadCount} />
          </div>

          <div>
            <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-2">
              Type{" "}
              <strong className="text-[#2e3d47]">{season.seasonNumber}</strong>{" "}
              to confirm
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={String(season.seasonNumber)}
              className="w-full font-mono text-sm px-3 py-2 border border-[#dddbd5] focus:outline-none focus:border-[#9b3d3d] bg-white"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 font-mono text-xs uppercase tracking-widest py-2.5 border border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47] hover:text-[#2e3d47] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!confirmed || loading}
              className="flex-1 font-mono text-xs uppercase tracking-widest py-2.5 bg-[#9b3d3d] text-white hover:bg-[#b04444] transition-colors disabled:opacity-40"
            >
              {loading ? "Closing…" : "Close Season"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Open Season form ──────────────────────────────────────────────────────────

function OpenSeasonForm({
  token,
  nextNumber,
  onCreated,
}: {
  token: string;
  nextNumber: number;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    seasonNumber: nextNumber,
    name: `Season ${nextNumber}`,
    startTs: todayISO(),
    endTs: daysFromNow(28),
    offseasonEndTs: daysFromNow(35),
    prizePoolUsdc: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/season/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          startTs: new Date(form.startTs).toISOString(),
          endTs: new Date(form.endTs).toISOString(),
          offseasonEndTs: new Date(form.offseasonEndTs).toISOString(),
        }),
      });
      const d = await r.json();
      if (d.ok) onCreated();
      else setError(d.error ?? "Failed to open season");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const fields: {
    key: keyof typeof form;
    label: string;
    type: string;
    placeholder?: string;
  }[] = [
    { key: "seasonNumber", label: "Season Number", type: "number" },
    {
      key: "name",
      label: "Season Name",
      type: "text",
      placeholder: "e.g. Season 2",
    },
    { key: "startTs", label: "Start Date & Time", type: "datetime-local" },
    { key: "endTs", label: "End Date & Time", type: "datetime-local" },
    { key: "offseasonEndTs", label: "Offseason End", type: "datetime-local" },
    {
      key: "prizePoolUsdc",
      label: "Prize Pool (USDC)",
      type: "number",
      placeholder: "10000",
    },
  ];

  return (
    <div className="bg-white border border-[#dddbd5]">
      <div className="h-1 bg-[#3d7a5c]" />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div
              key={f.key}
              className={f.key === "name" ? "sm:col-span-2" : ""}
            >
              <label className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest block mb-1.5">
                {f.label}
              </label>
              <input
                type={f.type}
                value={String(form[f.key])}
                placeholder={f.placeholder}
                onChange={(e) =>
                  set(
                    f.key,
                    f.type === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
                className="w-full font-mono text-sm px-3 py-2 border border-[#dddbd5] bg-white focus:outline-none focus:border-[#2e3d47] transition-colors"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="font-mono text-[10px] text-[#9b3d3d] uppercase tracking-wider">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full font-mono text-xs uppercase tracking-widest py-3 bg-[#2e3d47] text-white hover:bg-[#3e5060] transition-colors disabled:opacity-40"
        >
          {loading ? "Opening Season…" : `Open Season ${form.seasonNumber}`}
        </button>
      </div>
    </div>
  );
}

// ── Season row ────────────────────────────────────────────────────────────────

function SeasonRow({
  season,
  token,
  onClose,
}: {
  season: Season;
  token: string;
  onClose: (s: Season) => void;
}) {
  const day = getSeasonDay(season.startTs, season.endTs);

  return (
    <div
      className={`border-b border-[#dddbd5] px-6 py-4 hover:bg-[#f7f6f2] transition-colors ${
        season.isActive ? "bg-[#f7faf8]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className="font-display font-black text-xl text-[#2e3d47]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              S{season.seasonNumber}
            </span>
            <span className="font-medium text-[#2e3d47]">{season.name}</span>
            {season.isActive ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 bg-[#3d7a5c18] text-[#3d7a5c] uppercase tracking-wider">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#3d7a5c]"
                  style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
                />
                Active · {day}
              </span>
            ) : (
              <span className="font-mono text-[10px] px-2 py-0.5 border border-[#dddbd5] text-[#8a8880] uppercase tracking-wider">
                Closed
              </span>
            )}
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            <StatPill label="Start" value={fmtDate(season.startTs)} />
            <StatPill label="End" value={fmtDate(season.endTs)} />
            <StatPill
              label="Prize Pool"
              value={`$${season.prizePoolUsdc.toLocaleString()} USDC`}
              color="#c8a96e"
            />
            <StatPill label="Traders" value={season.traderCount} />
            <StatPill label="Squads" value={season.squadCount} />
          </div>
        </div>

        {/* Right: action */}
        {season.isActive && (
          <button
            onClick={() => onClose(season)}
            className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-[#9b3d3d] text-[#9b3d3d] hover:bg-[#9b3d3d] hover:text-white transition-colors flex-shrink-0"
          >
            Close Season
          </button>
        )}
      </div>
    </div>
  );
}

// ── Not admin ─────────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <p
        className="font-display font-black text-3xl text-[#2e3d47]"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Access Denied
      </p>
      <p className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
        This wallet is not authorised for admin access
      </p>
      <Link
        href="/"
        className="inline-block font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#2e3d47] text-[#2e3d47] hover:bg-[#2e3d47] hover:text-white transition-colors"
      >
        ← Back to Arena
      </Link>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminClient() {
  const { wallet, token, status } = useAuth();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [closingTarget, setClosingTarget] = useState<Season | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchSeasons = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFetchError(null);
    try {
      const r = await fetch("/api/admin/seasons", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.ok) {
        setSeasons(d.seasons);
        setIsAdmin(true);
      } else if (r.status === 401) {
        setIsAdmin(false);
      } else {
        setFetchError(d.error ?? "Failed to load seasons");
      }
    } catch {
      setFetchError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (status === "authenticated") fetchSeasons();
  }, [status, fetchSeasons]);

  const handleClose = async () => {
    if (!closingTarget || !token) return;
    setCloseLoading(true);
    setCloseError(null);
    try {
      const r = await fetch("/api/admin/season/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ seasonNumber: closingTarget.seasonNumber }),
      });
      const d = await r.json();
      if (d.ok) {
        setClosingTarget(null);
        fetchSeasons();
      } else setCloseError(d.error ?? "Failed to close season");
    } catch {
      setCloseError("Network error");
    } finally {
      setCloseLoading(false);
    }
  };

  const activeSeason = seasons.find((s) => s.isActive);
  const nextNumber =
    seasons.length > 0
      ? Math.max(...seasons.map((s) => s.seasonNumber)) + 1
      : 1;
  const canOpenNew = !activeSeason;

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      {/* Nav */}
      <nav className="bg-white border-b border-[#dddbd5] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span
              className="font-display font-black text-lg tracking-tight text-[#2e3d47]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              ARENA
            </span>
            <span className="w-px h-4 bg-[#dddbd5]" />
          </Link>
          <span
            className="font-display font-bold text-lg text-[#9b3d3d]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            ADMIN
          </span>
        </div>
        <ConnectButton />
      </nav>

      {/* Not connected */}
      {status === "idle" && !wallet && (
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <p
            className="font-display font-black text-3xl text-[#2e3d47]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Admin Access
          </p>
          <p className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
            Connect your admin wallet to continue
          </p>
          <div className="flex justify-center pt-2">
            <ConnectButton />
          </div>
        </div>
      )}

      {/* Signing in */}
      {(status === "signing" || (wallet && status === "idle")) && (
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <p className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
            Authenticating…
          </p>
        </div>
      )}

      {/* Access denied */}
      {status === "authenticated" && isAdmin === false && <AccessDenied />}

      {/* Loading seasons */}
      {status === "authenticated" && isAdmin === null && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#dddbd5] h-20 rounded-sm"
            />
          ))}
        </div>
      )}

      {/* Main content */}
      {status === "authenticated" && isAdmin === true && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Active season summary */}
          {activeSeason && (
            <div className="bg-[#2e3d47] px-6 py-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-mono text-[9px] text-[#8a9aaa] uppercase tracking-widest mb-1">
                  Active Season
                </p>
                <p
                  className="font-display font-black text-2xl text-white"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  S{activeSeason.seasonNumber} · {activeSeason.name}
                </p>
              </div>
              <div className="flex gap-6">
                <StatPill
                  label="Day"
                  value={getSeasonDay(activeSeason.startTs, activeSeason.endTs)}
                  color="#c8a96e"
                />
                <StatPill
                  label="Traders"
                  value={activeSeason.traderCount}
                  color="white"
                />
                <StatPill
                  label="Squads"
                  value={activeSeason.squadCount}
                  color="white"
                />
                <StatPill
                  label="Ends"
                  value={fmtDate(activeSeason.endTs)}
                  color="white"
                />
              </div>
            </div>
          )}

          {/* Season list */}
          <section>
            <div className="flex items-center gap-4 mb-5">
              <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest whitespace-nowrap">
                All Seasons
              </span>
              <span className="flex-1 h-px bg-[#dddbd5]" />
              <span className="font-mono text-[10px] text-[#b0aea5]">
                {seasons.length} total
              </span>
            </div>

            {fetchError && (
              <div className="bg-white border border-[#9b3d3d] px-5 py-3 mb-4">
                <p className="font-mono text-[10px] text-[#9b3d3d]">
                  {fetchError}
                </p>
              </div>
            )}

            {closeError && (
              <div className="bg-white border border-[#9b3d3d] px-5 py-3 mb-4">
                <p className="font-mono text-[10px] text-[#9b3d3d]">
                  {closeError}
                </p>
              </div>
            )}

            <div className="bg-white border border-[#dddbd5]">
              {/* Table header */}
              <div className="grid grid-cols-[60px_1fr_100px_80px_80px_100px] gap-4 px-6 py-2 bg-[#f7f6f2] border-b border-[#dddbd5]">
                {["#", "Name", "Period", "Traders", "Squads", "Status"].map(
                  (h) => (
                    <span
                      key={h}
                      className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest"
                    >
                      {h}
                    </span>
                  ),
                )}
              </div>

              {loading ? (
                Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="px-6 py-4 border-b border-[#dddbd5] animate-pulse"
                  >
                    <div className="h-3 bg-[#e8e6e0] rounded w-64" />
                  </div>
                ))
              ) : seasons.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                    No seasons yet
                  </p>
                </div>
              ) : (
                seasons.map((s) => (
                  <SeasonRow
                    key={s.id}
                    season={s}
                    token={token!}
                    onClose={setClosingTarget}
                  />
                ))
              )}
            </div>
          </section>

          {/* Open new season */}
          <section>
            <div className="flex items-center gap-4 mb-5">
              <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest whitespace-nowrap">
                Open New Season
              </span>
              <span className="flex-1 h-px bg-[#dddbd5]" />
              {!canOpenNew && (
                <span className="font-mono text-[10px] text-[#c8a96e] uppercase tracking-wider">
                  Close active season first
                </span>
              )}
            </div>

            {canOpenNew ? (
              <>
                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full font-mono text-xs uppercase tracking-widest py-4 border-2 border-dashed border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47] hover:text-[#2e3d47] transition-colors"
                  >
                    + Open Season {nextNumber}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <OpenSeasonForm
                      token={token!}
                      nextNumber={nextNumber}
                      onCreated={() => {
                        setShowForm(false);
                        fetchSeasons();
                      }}
                    />
                    <button
                      onClick={() => setShowForm(false)}
                      className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-wider transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-[#dddbd5] px-6 py-5">
                <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                  A season is currently active. Close it before opening a new
                  one.
                </p>
              </div>
            )}
          </section>

          {/* Quick links */}
          <section>
            <SectionLabel>Quick Links</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "System Status", href: "/status" },
                { label: "Scoring Config", href: "/api/config" },
                { label: "Leaderboard", href: "/" },
                { label: "Position Sync", href: "/api/cron/position-sync" },
              ].map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="bg-white border border-[#dddbd5] px-4 py-3 font-mono text-[10px] text-[#8a8880] uppercase tracking-widest hover:border-[#2e3d47] hover:text-[#2e3d47] transition-colors"
                >
                  {l.label} →
                </Link>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* Close confirmation modal */}
      {closingTarget && (
        <CloseConfirmModal
          season={closingTarget}
          onConfirm={handleClose}
          onCancel={() => {
            setClosingTarget(null);
            setCloseError(null);
          }}
          loading={closeLoading}
        />
      )}
    </div>
  );
}
