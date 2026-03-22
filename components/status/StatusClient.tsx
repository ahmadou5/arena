// src/app/status/StatusClient.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────

interface TableCheck {
  name: string;
  count: number | null;
  error: string | null;
  latencyMs: number;
}

interface StatusData {
  ok: boolean;
  status: "operational" | "partial" | "degraded";
  db: { online: boolean; latencyMs: number; error: string | null };
  activeSeason: {
    seasonNumber: number;
    name: string;
    startTs: string;
    endTs: string;
  } | null;
  tables: TableCheck[];
  checkedAt: string;
  totalMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_META = {
  operational: {
    label: "All Systems Operational",
    color: "#3d7a5c",
    dot: "#3d7a5c",
  },
  partial: { label: "Partial Degradation", color: "#c8a96e", dot: "#c8a96e" },
  degraded: { label: "Database Offline", color: "#9b3d3d", dot: "#9b3d3d" },
} as const;

function fmtCount(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function LatencyBadge({ ms }: { ms: number }) {
  const color = ms < 100 ? "#3d7a5c" : ms < 500 ? "#c8a96e" : "#9b3d3d";
  return (
    <span
      className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm"
      style={{ color, background: color + "18" }}
    >
      {ms}ms
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 12 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="skeleton rounded-sm animate-pulse bg-[#e8e6e0]"
      style={{ width: w, height: h }}
    />
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#dddbd5] p-6 space-y-3">
        <Skeleton w={200} h={16} />
        <Skeleton w={140} h={10} />
      </div>
      <div className="bg-white border border-[#dddbd5] divide-y divide-[#dddbd5]">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3">
            <Skeleton w={160} h={10} />
            <div className="flex items-center gap-4">
              <Skeleton w={50} h={10} />
              <Skeleton w={45} h={20} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function StatusClient() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      const d = (await r.json()) as StatusData;
      setData(d);
      setLastFetch(new Date());
      setCountdown(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch status");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 30s
  useEffect(() => {
    const refresh = setInterval(fetchStatus, 30_000);
    const tick = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1_000,
    );
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [fetchStatus]);

  const meta = data ? STATUS_META[data.status] : null;

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
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
            System Status
          </span>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47] hover:text-[#2e3d47] transition-colors disabled:opacity-40"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page title */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-display font-black text-3xl text-[#2e3d47] tracking-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              System Status
            </h1>
            <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mt-1">
              Auto-refreshes every 30s · Next in {countdown}s
            </p>
          </div>
          {lastFetch && (
            <span className="font-mono text-[10px] text-[#b0aea5]">
              Last checked {fmtTime(lastFetch.toISOString())}
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-white border border-[#9b3d3d] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#9b3d3d]" />
              <div>
                <p className="font-mono text-xs font-semibold text-[#9b3d3d] uppercase tracking-wider">
                  Could not reach status API
                </p>
                <p className="font-mono text-[10px] text-[#b0aea5] mt-0.5">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && !data ? (
          <LoadingState />
        ) : data ? (
          <>
            {/* Overall status banner */}
            <div
              className="bg-white border border-[#dddbd5] px-6 py-5"
              style={{ borderLeftWidth: 4, borderLeftColor: meta!.color }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: meta!.dot,
                      boxShadow: `0 0 6px ${meta!.dot}88`,
                      animation:
                        data.status === "operational"
                          ? "pulse-dot 2s ease-in-out infinite"
                          : "none",
                    }}
                  />
                  <span
                    className="font-display font-bold text-xl text-[#2e3d47]"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: meta!.color,
                    }}
                  >
                    {meta!.label}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono text-[9px] text-[#b0aea5] uppercase tracking-widest">
                      DB Latency
                    </p>
                    <LatencyBadge ms={data.db.latencyMs} />
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[9px] text-[#b0aea5] uppercase tracking-widest">
                      Total Check
                    </p>
                    <LatencyBadge ms={data.totalMs} />
                  </div>
                </div>
              </div>

              {/* DB error */}
              {data.db.error && (
                <div className="mt-3 pt-3 border-t border-[#dddbd5]">
                  <p className="font-mono text-[10px] text-[#9b3d3d]">
                    {data.db.error}
                  </p>
                </div>
              )}
            </div>

            {/* Active Season card */}
            {data.activeSeason ? (
              <div className="bg-[#2e3d47] px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-mono text-[9px] text-[#8a9aaa] uppercase tracking-widest">
                    Active Season
                  </p>
                  <p
                    className="font-display font-black text-xl text-white mt-0.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    S{data.activeSeason.seasonNumber} · {data.activeSeason.name}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="font-mono text-[9px] text-[#8a9aaa] uppercase tracking-widest">
                      Started
                    </p>
                    <p className="font-mono text-xs text-white">
                      {new Date(data.activeSeason.startTs).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] text-[#8a9aaa] uppercase tracking-widest">
                      Ends
                    </p>
                    <p className="font-mono text-xs text-white">
                      {new Date(data.activeSeason.endTs).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#dddbd5] px-5 py-3 flex items-center gap-3">
                <span className="font-mono text-[10px] text-[#b0aea5] uppercase tracking-widest">
                  No active season
                </span>
              </div>
            )}

            {/* Tables */}
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                  Database Tables
                </span>
                <span className="flex-1 h-px bg-[#dddbd5]" />
                <span className="font-mono text-[10px] text-[#b0aea5]">
                  {data.tables.filter((t) => t.error === null).length}/
                  {data.tables.length} healthy
                </span>
              </div>

              <div className="bg-white border border-[#dddbd5] divide-y divide-[#dddbd5]">
                {/* Header */}
                <div className="grid grid-cols-[1fr_80px_80px_100px] px-5 py-2 bg-[#f7f6f2]">
                  {["Table", "Rows", "Latency", "Status"].map((h) => (
                    <span
                      key={h}
                      className="font-mono text-[9px] text-[#8a8880] uppercase tracking-widest"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {data.tables.map((table) => {
                  const ok = table.error === null;
                  return (
                    <div
                      key={table.name}
                      className="grid grid-cols-[1fr_80px_80px_100px] items-center px-5 py-3 hover:bg-[#f7f6f2] transition-colors"
                    >
                      {/* Name */}
                      <span className="font-mono text-xs text-[#2e3d47] font-medium">
                        {table.name}
                      </span>

                      {/* Row count */}
                      <span className="font-mono text-xs text-[#2e3d47]">
                        {fmtCount(table.count)}
                      </span>

                      {/* Latency */}
                      <span>
                        <LatencyBadge ms={table.latencyMs} />
                      </span>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: ok ? "#3d7a5c" : "#9b3d3d" }}
                        />
                        {ok ? (
                          <span className="font-mono text-[10px] text-[#3d7a5c] uppercase tracking-wider">
                            OK
                          </span>
                        ) : (
                          <span
                            className="font-mono text-[10px] text-[#9b3d3d] truncate max-w-[72px]"
                            title={table.error ?? ""}
                          >
                            Error
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Checked at */}
            <p className="font-mono text-[10px] text-[#b0aea5] text-center">
              Snapshot taken at {fmtTime(data.checkedAt)} UTC
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
