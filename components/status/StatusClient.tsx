// src/app/status/StatusClient.tsx
"use client";
import { useState, useEffect, useRef } from "react";
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
  operational: { label: "All Systems Operational", color: "var(--positive)" },
  partial: { label: "Partial Degradation", color: "var(--gold)" },
  degraded: { label: "Database Offline", color: "var(--negative)" },
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
  const color =
    ms < 100 ? "var(--positive)" : ms < 500 ? "var(--gold)" : "var(--negative)";
  return (
    <span
      className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm"
      style={{
        color,
        background:
          color === "var(--positive)"
            ? "rgba(61,122,92,.1)"
            : color === "var(--gold)"
              ? "rgba(200,169,110,.1)"
              : "rgba(155,61,61,.1)",
      }}
    >
      {ms}ms
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 12 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="skeleton rounded-sm"
      style={{ width: w, height: h, background: "var(--bg-subtle)" }}
    />
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div
        className="border p-6 space-y-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <Skeleton w={200} h={16} />
        <Skeleton w={140} h={10} />
      </div>
      <div
        className="border divide-y"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
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

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <span
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {children}
      </span>
      <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
      {right && (
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--text-dim)" }}
        >
          {right}
        </span>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function StatusClient() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);

  // ── Fetch pattern: all setState inside .then()/.catch(), never in effect body
  const runRef = useRef<() => void>(() => {});
  runRef.current = () => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: StatusData) => {
        setData(d);
        setError(null);
        setLastFetch(new Date());
        setCountdown(30);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to fetch status"),
      );
  };

  // Auto-refresh every 30s
  useEffect(() => {
    runRef.current();
    const refresh = setInterval(() => runRef.current(), 30_000);
    const tick = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1_000,
    );
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = data ? STATUS_META[data.status] : null;
  const loading = !data && !error;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav
        className="border-b px-6 py-3 flex items-center justify-between sticky top-0 z-50"
        style={{ background: "var(--nav-bg)", borderColor: "var(--border)" }}
      >
        <Link href="/" className="flex items-center gap-3">
          <span
            className="font-display font-black text-lg tracking-tight"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: "var(--text)",
            }}
          >
            ARENA
          </span>
          <span className="w-px h-4" style={{ background: "var(--border)" }} />
          <span
            className="font-display font-light text-lg"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: "var(--text-muted)",
            }}
          >
            PROTOCOL
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            System Status
          </span>
          <button
            onClick={() => runRef.current()}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
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
              className="font-display font-black text-3xl tracking-tight"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: "var(--text)",
              }}
            >
              System Status
            </h1>
            <p
              className="font-mono text-[10px] uppercase tracking-widest mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Auto-refreshes every 30s · Next in {countdown}s
            </p>
          </div>
          {lastFetch && (
            <span
              className="font-mono text-[10px]"
              style={{ color: "var(--text-dim)" }}
            >
              Last checked {fmtTime(lastFetch.toISOString())}
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div
            className="border px-5 py-4"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--negative)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--negative)" }}
              />
              <div>
                <p
                  className="font-mono text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--negative)" }}
                >
                  Could not reach status API
                </p>
                <p
                  className="font-mono text-[10px] mt-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : data ? (
          <>
            {/* Overall status banner */}
            <div
              className="border px-6 py-5"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                borderLeftWidth: 4,
                borderLeftColor: meta!.color,
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: meta!.color,
                      boxShadow: `0 0 6px ${meta!.color}88`,
                      animation:
                        data.status === "operational"
                          ? "pulse-dot 2s ease-in-out infinite"
                          : "none",
                    }}
                  />
                  <span
                    className="font-display font-bold text-xl"
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
                    <p
                      className="font-mono text-[9px] uppercase tracking-widest"
                      style={{ color: "var(--text-dim)" }}
                    >
                      DB Latency
                    </p>
                    <LatencyBadge ms={data.db.latencyMs} />
                  </div>
                  <div className="text-right">
                    <p
                      className="font-mono text-[9px] uppercase tracking-widest"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Total Check
                    </p>
                    <LatencyBadge ms={data.totalMs} />
                  </div>
                </div>
              </div>
              {data.db.error && (
                <div
                  className="mt-3 pt-3 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p
                    className="font-mono text-[10px]"
                    style={{ color: "var(--negative)" }}
                  >
                    {data.db.error}
                  </p>
                </div>
              )}
            </div>

            {/* Active season card */}
            {data.activeSeason ? (
              <div
                className="px-6 py-4 flex items-center justify-between flex-wrap gap-4"
                style={{ background: "var(--primary)", opacity: 1 }}
              >
                <div>
                  <p
                    className="font-mono text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
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
                  {[
                    {
                      label: "Started",
                      value: new Date(
                        data.activeSeason.startTs,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }),
                    },
                    {
                      label: "Ends",
                      value: new Date(
                        data.activeSeason.endTs,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }),
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <p
                        className="font-mono text-[9px] uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {s.label}
                      </p>
                      <p className="font-mono text-xs text-white">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="border px-5 py-3"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border)",
                }}
              >
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-dim)" }}
                >
                  No active season
                </span>
              </div>
            )}

            {/* Tables */}
            <div>
              <SectionLabel
                right={`${data.tables.filter((t) => t.error === null).length}/${data.tables.length} healthy`}
              >
                Database Tables
              </SectionLabel>

              <div
                className="border divide-y"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border)",
                }}
              >
                {/* Table header */}
                <div
                  className="grid grid-cols-[1fr_80px_80px_100px] px-5 py-2"
                  style={{ background: "var(--bg-subtle)" }}
                >
                  {["Table", "Rows", "Latency", "Status"].map((h) => (
                    <span
                      key={h}
                      className="font-mono text-[9px] uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
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
                      className="grid grid-cols-[1fr_80px_80px_100px] items-center px-5 py-3 transition-colors"
                      style={{ borderColor: "var(--border)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-subtle)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "")
                      }
                    >
                      <span
                        className="font-mono text-xs font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {table.name}
                      </span>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        {fmtCount(table.count)}
                      </span>
                      <span>
                        <LatencyBadge ms={table.latencyMs} />
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            background: ok
                              ? "var(--positive)"
                              : "var(--negative)",
                          }}
                        />
                        <span
                          className="font-mono text-[10px] uppercase tracking-wider"
                          style={{
                            color: ok ? "var(--positive)" : "var(--negative)",
                          }}
                        >
                          {ok ? "OK" : "Error"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer timestamp */}
            <p
              className="font-mono text-[10px] text-center"
              style={{ color: "var(--text-dim)" }}
            >
              Snapshot taken at {fmtTime(data.checkedAt)} UTC
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
