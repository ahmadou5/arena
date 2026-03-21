// src/components/adrena-integration/ArenaNavLink.tsx
// Adrena UI integration: "Arena" nav link with active event badge dot
// Team: drop this into the Adrena navigation component
// File path to integrate: [confirm with team — likely src/components/Nav.tsx or similar]
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface ArenaNavLinkProps {
  className?: string;
}

export default function ArenaNavLink({ className = "" }: ArenaNavLinkProps) {
  const [eventActive, setEventActive] = useState(false);
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/seasons/active")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok || !d.season) return;
        setSeasonNumber(d.season.seasonNumber);
        // Check if a mid-season event is running
        return fetch(
          `/api/leaderboard/${d.season.seasonNumber}/mid-season-event`,
        );
      })
      .then((r) => r?.json())
      .then((d) => {
        if (d?.ok && d.phase && d.phase !== "offseason") {
          // Event is active if it's a high-intensity phase
          setEventActive(
            ["early_bird", "momentum", "sprint"].includes(d.phase),
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Link
      href="/"
      className={`relative inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest transition-colors hover:opacity-80 ${className}`}
    >
      Arena
      {eventActive && (
        <span
          className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-[#c8a96e]"
          title="Mid-season event active"
          style={{
            animation: "pulse-dot 2s ease-in-out infinite",
            boxShadow: "0 0 4px #c8a96e88",
          }}
        />
      )}
    </Link>
  );
}
