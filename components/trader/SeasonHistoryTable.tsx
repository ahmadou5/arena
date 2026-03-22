// src/components/trader/SeasonHistoryTable.tsx
import DivisionBadge from "@/components/DivisionBadge";

function fmtCps(n: number | null) {
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000)?.toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000)?.toFixed(1)}K`;
  return n?.toFixed(0) ?? "—";
}

interface SeasonRecord {
  seasonNumber: number;
  finalCps: number | null;
  finalRank: number | null;
  division: number | null;
  arStart: number | null;
  arEnd: number | null;
  promoted: boolean;
  relegated: boolean;
  totalTrades: number;
  winningTrades: number;
}

const DIV_SHORT = ["", "GM", "D", "P", "G", "S"];

export default function SeasonHistoryTable({
  history,
}: {
  history: SeasonRecord[];
}) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white border border-[#dddbd5] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#2e3d47]">
            {["Season", "Division", "Rank", "CPS", "AR Delta", "Status"].map(
              (h) => (
                <th
                  key={h}
                  className="py-3 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#8a8880]"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {history.map((r) => {
            const arDelta =
              r.arEnd !== null && r.arStart !== null
                ? r.arEnd - r.arStart
                : null;
            const status = r.promoted
              ? "promoted"
              : r.relegated
                ? "relegated"
                : "stable";
            return (
              <tr
                key={r.seasonNumber}
                className="border-b border-[#dddbd5] hover:bg-[#f7f6f2] transition-colors"
              >
                <td className="py-3 px-4 font-mono text-xs font-medium">
                  S{r.seasonNumber}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <DivisionBadge division={r.division ?? 5} size="sm" />
                    <span className="font-mono text-[10px] text-[#8a8880]">
                      {DIV_SHORT[r.division ?? 5]}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-xs">
                  {r.finalRank ? `#${r.finalRank}` : "—"}
                </td>
                <td className="py-3 px-4 font-mono text-xs font-semibold text-[#2e3d47]">
                  {fmtCps(r.finalCps)}
                </td>
                <td className="py-3 px-4">
                  {arDelta !== null ? (
                    <span
                      className={`font-mono text-xs font-semibold ${arDelta >= 0 ? "text-[#3d7a5c]" : "text-[#9b3d3d]"}`}
                    >
                      {arDelta >= 0 ? "+" : ""}
                      {arDelta}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-[#b0aea5]">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 ${
                      status === "promoted"
                        ? "bg-[#3d7a5c20] text-[#3d7a5c]"
                        : status === "relegated"
                          ? "bg-[#9b3d3d20] text-[#9b3d3d]"
                          : "text-[#8a8880]"
                    }`}
                  >
                    {status === "promoted"
                      ? "↑ Promoted"
                      : status === "relegated"
                        ? "↓ Relegated"
                        : "— Stable"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
