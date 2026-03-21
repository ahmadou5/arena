// src/components/MidSeasonBanner.tsx
"use client";

interface MidSeasonBannerProps {
  phase: string;
  phaseLabel: string;
  seasonDay: number;
  topEntry?: { wallet: string; rankInDivision?: number };
}

const PHASE_ICONS: Record<string, string> = {
  early_bird: "◎",
  momentum: "↑",
  consistency: "═",
  sprint: "→",
  offseason: "·",
};

const PHASE_COLORS: Record<string, string> = {
  early_bird: "#3d7a5c",
  momentum: "#7a9ab0",
  consistency: "#c8a96e",
  sprint: "#9b3d3d",
  offseason: "#8a8880",
};

export default function MidSeasonBanner({
  phase,
  phaseLabel,
  seasonDay,
}: MidSeasonBannerProps) {
  const color = PHASE_COLORS[phase] ?? "#8a8880";
  const icon = PHASE_ICONS[phase] ?? "·";

  const daysInPhase: Record<string, string> = {
    early_bird: "Days 1–7",
    momentum: "Days 8–14",
    consistency: "Days 15–21",
    sprint: "Days 22–28",
    offseason: "Offseason",
  };

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 border-l-2"
      style={{ borderColor: color, background: color + "12" }}
    >
      <span
        className="font-display font-black text-2xl"
        style={{ color, fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        {icon}
      </span>
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color }}
        >
          Mid-Season Event · {daysInPhase[phase]} · Day {seasonDay}
        </p>
        <p
          className="font-display font-bold text-base text-[#2e3d47] leading-tight"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {phaseLabel}
        </p>
      </div>
      <a
        href={`#leaderboard`}
        className="ml-auto font-mono text-[10px] uppercase tracking-widest transition-colors"
        style={{ color }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        View standings →
      </a>
    </div>
  );
}
