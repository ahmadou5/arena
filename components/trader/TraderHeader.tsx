// src/components/trader/TraderHeader.tsx
import DivisionBadge from "@/components/DivisionBadge";
import CopyButton from "@/components/CopyButton";

const DIV_COLORS: Record<number, string> = {
  1: "#2a3840",
  2: "#2858a0",
  3: "#6080a8",
  4: "#b08010",
  5: "#906020",
};

function short(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-6)}`;
}

interface Props {
  wallet: string;
  arenaRating: number;
  division: number;
  divisionName: string;
  totalSeasonsParticipated: number;
  lastActiveSeason: number | null;
  achievementsCount: number;
  streak: { streakDays: number } | null;
  arTrend: number | null;
}

export default function TraderHeader({
  wallet,
  arenaRating,
  division,
  divisionName,
  totalSeasonsParticipated,
  lastActiveSeason,
  achievementsCount,
  streak,
  arTrend,
}: Props) {
  const divColor = DIV_COLORS[division] ?? "#708090";

  return (
    <div className="bg-white border border-[#dddbd5]">
      <div className="h-1" style={{ background: divColor }} />
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-shrink-0">
            <DivisionBadge division={division} size="xl" showLabel />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-base text-[#2e3d47] tracking-wide break-all">
                {short(wallet)}
              </span>
              <CopyButton text={wallet} />
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <div>
                <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                  Arena Rating
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-display font-black text-5xl leading-none text-[#2e3d47]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {arenaRating}
                  </span>
                  {arTrend !== null && (
                    <span
                      className={`font-mono text-sm font-semibold ${arTrend >= 0 ? "text-[#3d7a5c]" : "text-[#9b3d3d]"}`}
                    >
                      {arTrend >= 0 ? "▲" : "▼"} {Math.abs(arTrend)}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                  Division
                </p>
                <span
                  className="font-display font-bold text-2xl"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: divColor,
                  }}
                >
                  {divisionName.toUpperCase()}
                </span>
              </div>
              {streak && streak.streakDays > 0 && (
                <div>
                  <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                    Streak
                  </p>
                  <span
                    className="font-display font-bold text-2xl"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: streak.streakDays >= 7 ? "#c8a96e" : "#2e3d47",
                    }}
                  >
                    {streak.streakDays}d
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                {totalSeasonsParticipated} seasons
              </span>
              <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                {achievementsCount} achievements
              </span>
              {lastActiveSeason && (
                <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                  Last active: S{lastActiveSeason}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
