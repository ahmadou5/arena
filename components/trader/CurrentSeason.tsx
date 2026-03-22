// src/components/trader/CurrentSeason.tsx
import Link from "next/link";

function fmtCps(n: number | null) {
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000)?.toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000)?.toFixed(1)}K`;
  return n?.toFixed(0) ?? "—";
}

interface Squad {
  name: string;
  rank: number | null;
  memberCount: number;
  isLocked: boolean;
}

interface Season {
  seasonNumber: number;
  name: string;
  totalCps?: number;
  rankInDivision?: number | null;
  totalTrades?: number;
  winRate?: number;
}

interface Props {
  season: Season;
  squad: Squad | null;
}

export default function CurrentSeason({ season, squad }: Props) {
  const stats = [
    { label: "CPS", value: fmtCps(season.totalCps ?? null) },
    {
      label: "Division Rank",
      value: season.rankInDivision ? `#${season.rankInDivision}` : "—",
    },
    {
      label: "Win Rate",
      value:
        season.winRate !== undefined
          ? `${(season.winRate * 100).toFixed(0)}%`
          : "—",
      color:
        season.winRate !== undefined
          ? season.winRate >= 0.5
            ? "#3d7a5c"
            : "#9b3d3d"
          : undefined,
    },
    { label: "Trades", value: season.totalTrades?.toString() ?? "—" },
  ];

  return (
    <div className="bg-white border border-[#dddbd5] p-6">
      {season.totalCps !== undefined ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-1">
                {s.label}
              </p>
              <p
                className="font-display font-black text-3xl leading-none text-[#2e3d47]"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: s.color,
                }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest py-4">
          No trades recorded this season yet
        </p>
      )}

      <div className="mt-6 pt-6 border-t border-[#dddbd5] flex items-center justify-between flex-wrap gap-4">
        {squad ? (
          <>
            <div>
              <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-1">
                Squad
              </p>
              <p className="font-medium text-[#2e3d47] text-sm">{squad.name}</p>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: "Rank", value: squad.rank ? `#${squad.rank}` : "—" },
                { label: "Members", value: `${squad.memberCount}/5` },
                {
                  label: "Status",
                  value: squad.isLocked ? "Locked" : "Open",
                  color: squad.isLocked ? "#9b3d3d" : "#3d7a5c",
                },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-0.5">
                    {s.label}
                  </p>
                  <p
                    className="font-mono text-sm text-[#2e3d47]"
                    style={{ color: s.color }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
              No squad this season
            </p>
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-widest text-[#2e3d47] border border-[#2e3d47] px-3 py-1.5 hover:bg-[#2e3d47] hover:text-white transition-colors"
            >
              Join a squad →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
