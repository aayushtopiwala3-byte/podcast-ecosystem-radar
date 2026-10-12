"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Props = {
  weeks: string[];
  totals: number[];
  highlighted: { showName: string; counts: number[] }[];
};

const LINE_COLORS = ["#22d3ee", "#a855f7"];

export default function EpisodeTrendChart({ weeks, totals, highlighted }: Props) {
  const data = weeks.map((w, i) => {
    const row: Record<string, string | number> = { week: w, Total: totals[i] };
    highlighted.forEach((h) => {
      row[h.showName] = h.counts[i];
    });
    return row;
  });

  return (
    <div className="card p-6 fade-slide-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">Episode Cadence</h3>
          <p className="text-xs text-[var(--text-dim)]">Episodes ingested per week, last 8 weeks</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            {highlighted.map((h, i) => (
              <linearGradient key={h.showName} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.35} />
                <stop offset="95%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#22263f" vertical={false} />
          <XAxis dataKey="week" stroke="#8b91ac" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#8b91ac" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#171c33", border: "1px solid #22263f", borderRadius: 12, color: "#e8eaf5" }}
            labelStyle={{ color: "#8b91ac" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#8b91ac" }} />
          <Area
            type="monotone"
            dataKey="Total"
            stroke="#3b82f6"
            fill="url(#totalGradient)"
            strokeWidth={2}
            animationDuration={900}
          />
          {highlighted.map((h, i) => (
            <Area
              key={h.showName}
              type="monotone"
              dataKey={h.showName}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              fill={`url(#gradient-${i})`}
              strokeWidth={2}
              animationDuration={900}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
