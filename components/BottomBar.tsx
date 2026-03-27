// src/components/BottomBar.tsx
"use client";
import { useSyncExternalStore, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";

// ── Hydration guard ────────────────────────────────────────────────────────

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// ── Theme toggle ───────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isMounted = useIsMounted();
  if (!isMounted) return <span className="w-8 h-4" />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-1.5 group"
      aria-label="Toggle theme"
    >
      <div
        className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
          isDark ? "bg-[#c8a96e]" : "bg-[#dddbd5]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isDark ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
      <span
        className="font-mono text-[10px] uppercase tracking-widest transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────

type SystemStatus = "operational" | "partial" | "degraded" | "loading";

const STATUS_META: Record<SystemStatus, { label: string; color: string }> = {
  operational: { label: "Operational", color: "#3d7a5c" },
  partial: { label: "Degraded", color: "#c8a96e" },
  degraded: { label: "DB Offline", color: "#9b3d3d" },
  loading: { label: "Checking…", color: "#b0aea5" },
};

function StatusPill() {
  const [status, setStatus] = useState<SystemStatus>("loading");
  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStatus(d.status ?? "degraded"))
      .catch(() => setStatus("degraded"));
  }, []);
  const meta = STATUS_META[status];
  return (
    <Link
      href="/status"
      className="flex items-center gap-1.5 group"
      title="View system status"
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background: meta.color,
          boxShadow:
            status === "operational" ? `0 0 4px ${meta.color}88` : "none",
          animation:
            status === "operational"
              ? "pulse-dot 2s ease-in-out infinite"
              : "none",
        }}
      />
      <span
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </Link>
  );
}

// ── Social icons ───────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
function DiscordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.114 18.1.132 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ── Nav links data ─────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Trade", href: "/trade", internal: true },
  { label: "Adrena.trade", href: "https://adrena.trade", internal: false },
  { label: "Scoring Config", href: "/api/config", internal: true },
] as const;

const SOCIALS = [
  {
    href: "https://github.com/ahmadou5/arena",
    icon: <GitHubIcon />,
    label: "GitHub",
  },
  {
    href: "https://discord.gg/invite/adrena",
    icon: <DiscordIcon />,
    label: "Discord",
  },
  { href: "https://x.com/AdrenaProtocol", icon: <XIcon />, label: "X/Twitter" },
];

// ── Mobile menu dropdown ───────────────────────────────────────────────────

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative sm:hidden">
      {/* Hamburger trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col gap-[4px] p-1.5 transition-opacity hover:opacity-70"
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <span
          className="block w-4 h-[1.5px] transition-all duration-200"
          style={{
            background: "var(--text-muted)",
            transform: open ? "translateY(5.5px) rotate(45deg)" : "none",
          }}
        />
        <span
          className="block w-4 h-[1.5px] transition-all duration-200"
          style={{
            background: "var(--text-muted)",
            opacity: open ? 0 : 1,
          }}
        />
        <span
          className="block w-4 h-[1.5px] transition-all duration-200"
          style={{
            background: "var(--text-muted)",
            transform: open ? "translateY(-5.5px) rotate(-45deg)" : "none",
          }}
        />
      </button>

      {/* Dropdown — opens upward from the bottom bar */}
      {open && (
        <div
          className="absolute bottom-[calc(100%+8px)] left-0 w-44 border shadow-lg z-50"
          style={{
            background: "var(--nav-bg)",
            borderColor: "var(--border)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
          }}
        >
          {/* Nav links */}
          <div className="py-1">
            {NAV_LINKS.map((link) =>
              link.internal ? (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-subtle)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-subtle)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {link.label}
                  <span style={{ color: "var(--text-dim)" }}>↗</span>
                </a>
              ),
            )}
          </div>

          {/* Divider */}
          <div className="h-px mx-3" style={{ background: "var(--border)" }} />

          {/* Socials */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--text)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)")
                }
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bottom bar ─────────────────────────────────────────────────────────────

export default function BottomBar() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t px-4 sm:px-6"
      style={{
        height: 44,
        background: "var(--nav-bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-4">
        {/* Left: branding */}
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="font-display font-black text-sm tracking-tight transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: "var(--text)",
            }}
          >
            ARENA
          </Link>

          {/* Desktop nav links */}
          <span
            className="hidden sm:block w-px h-3"
            style={{ background: "var(--border)" }}
          />
          <div className="hidden sm:flex items-center gap-4">
            {NAV_LINKS.map((link) =>
              link.internal ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="font-mono text-[10px] uppercase tracking-widest transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase tracking-widest transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          {/* Mobile hamburger */}
          <MobileMenu />
        </div>

        {/* Right: socials (desktop only) + theme toggle + status */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                style={{ color: "var(--text-muted)" }}
              >
                {s.icon}
              </a>
            ))}
          </div>

          <span
            className="hidden sm:block w-px h-3"
            style={{ background: "var(--border)" }}
          />
          <ThemeToggle />
          <span className="w-px h-3" style={{ background: "var(--border)" }} />
          <StatusPill />
        </div>
      </div>
    </div>
  );
}
