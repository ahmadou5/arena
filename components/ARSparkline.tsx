// src/components/ARSparkline.tsx
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ARPoint {
  season: number;
  ar: number;
  division: number | null;
}

const DIV_NAMES: Record<number, string> = {
  1: "GM",
  2: "D",
  3: "P",
  4: "G",
  5: "S",
};

interface Props {
  data: ARPoint[];
}

export default function ARSparkline({ data }: Props) {
  if (!data || data.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center">
        <span className="font-mono text-[10px] text-[#b0aea5] uppercase tracking-widest">
          Not enough history
        </span>
      </div>
    );
  }

  const min = Math.min(...data.map((d) => d.ar)) - 50;
  const max = Math.max(...data.map((d) => d.ar)) + 50;

  return (
    <ResponsiveContainer width="100%" height={96}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <XAxis
          dataKey="season"
          tickFormatter={(v: number) => `S${v}`}
          tick={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fill: "#8a8880",
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis domain={[min, max]} hide />
        <Tooltip
          contentStyle={{
            background: "#2e3d47",
            border: "none",
            borderRadius: 0,
            padding: "6px 10px",
          }}
          labelStyle={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "#8a9aaa",
          }}
          formatter={(value) => {
            if (typeof value === "number") {
              return (
                <span key="ar" className="font-mono text-white text-xs">
                  {value} AR
                </span>
              );
            }
            return null;
          }}
          labelFormatter={(v) => `Season ${v as number}`}
        />
        <ReferenceLine y={400} stroke="#dddbd5" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="ar"
          stroke="#2e3d47"
          strokeWidth={2}
          dot={{ r: 3, fill: "#2e3d47", stroke: "#f7f6f2", strokeWidth: 2 }}
          activeDot={{
            r: 5,
            fill: "#c8a96e",
            stroke: "#f7f6f2",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
