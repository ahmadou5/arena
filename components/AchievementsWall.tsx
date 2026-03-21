// src/components/AchievementsWall.tsx
"use client";
import { useState } from "react";

interface Achievement {
  achievementKey: string;
  seasonNumber: number;
  earnedAt: string;
}

const ACHIEVEMENT_META: Record<
  string,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    rarity: string;
  }
> = {
  iron_hands: {
    label: "Iron Hands",
    description: "Zero losing trades with 10+ trades in a season.",
    icon: "◆",
    color: "#4a7a9a",
    rarity: "Rare",
  },
  comeback_king: {
    label: "Comeback King",
    description: "Bottom 25% at Day 14, finished top 25% in division.",
    icon: "↑",
    color: "#9b3d3d",
    rarity: "Epic",
  },
  division_dominator: {
    label: "Division Dominator",
    description: "Finished with 1.2× the CPS of 2nd place in your division.",
    icon: "◉",
    color: "#c8a96e",
    rarity: "Legendary",
  },
  squad_mvp: {
    label: "Squad MVP",
    description: "Highest CPS in the #1 ranked squad.",
    icon: "★",
    color: "#3d7a5c",
    rarity: "Legendary",
  },
  perfect_streak: {
    label: "Perfect Streak",
    description: "Traded every calendar day of the season.",
    icon: "⬡",
    color: "#7a5a9a",
    rarity: "Epic",
  },
  quest_completionist: {
    label: "Completionist",
    description: "Completed every available quest in a season.",
    icon: "✦",
    color: "#6a7a8a",
    rarity: "Rare",
  },
};

const ALL_KEYS = Object.keys(ACHIEVEMENT_META);

type TooltipState = { key: string; x: number; y: number } | null;

export default function AchievementsWall({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const [tooltip, setTooltip] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  const earnedKeys = new Set(achievements.map((a) => a.achievementKey));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {ALL_KEYS.map((key) => {
        const meta = ACHIEVEMENT_META[key];
        const earned = earnedKeys.has(key);
        const ach = achievements.find((a) => a.achievementKey === key);

        return (
          <div
            key={key}
            className="relative flex flex-col items-center gap-2 cursor-default"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                key,
                x: rect.left + rect.width / 2,
                y: rect.bottom + 8,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Badge */}
            <div
              className="w-14 h-14 flex items-center justify-center border transition-all"
              style={{
                background: earned ? meta.color + "18" : "#f0eeea",
                borderColor: earned ? meta.color : "#dddbd5",
                borderWidth: earned ? 2 : 1,
                filter: earned ? "none" : "grayscale(1) opacity(0.4)",
              }}
            >
              <span
                className="text-2xl select-none"
                style={{ color: earned ? meta.color : "#b0aea5" }}
              >
                {meta.icon}
              </span>
            </div>

            {/* Lock overlay */}
            {!earned && (
              <div className="absolute inset-0 flex items-start justify-end p-1">
                <span className="text-[10px] text-[#b0aea5]">🔒</span>
              </div>
            )}

            {/* Label */}
            <div className="text-center">
              <p
                className="font-mono text-[9px] uppercase tracking-wider leading-tight"
                style={{ color: earned ? meta.color : "#b0aea5" }}
              >
                {meta.label}
              </p>
              {earned && ach && (
                <p className="font-mono text-[9px] text-[#b0aea5]">
                  S{ach.seasonNumber}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="bg-[#2e3d47] text-white px-3 py-2 text-xs max-w-[200px]"
            style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
          >
            <p className="font-mono font-semibold text-[11px] mb-1">
              {ACHIEVEMENT_META[tooltip.key].label}
            </p>
            <p className="text-[#8a9aaa] text-[10px] leading-relaxed">
              {ACHIEVEMENT_META[tooltip.key].description}
            </p>
            <p
              className="mt-1 font-mono text-[9px]"
              style={{ color: ACHIEVEMENT_META[tooltip.key].color }}
            >
              {ACHIEVEMENT_META[tooltip.key].rarity}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
