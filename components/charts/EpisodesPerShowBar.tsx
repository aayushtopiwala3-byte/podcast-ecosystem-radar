"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Props = {
  data: { showName: string; count: number }[];
};

export default function EpisodesPerShowBar({ data }: Props) {
  const shortened = data.map((d) => ({
    ...d,
    shortName: d.showName.length > 14 ? d.showName.slice(0, 13) + "…" : d.showName,
  }));

  return (
    <div className="card p-6 fade-slide-in">
      <h3 className="font-semibold text-white mb-1">Episodes per Show</h3>
      <p className="text-xs text-[var(--text-dim)] mb-4">All-time ingested episodes</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={shortened} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#22263f" vertical={false} />
          <XAxis dataKey="shortName" stroke="#8b91ac" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis stroke="#8b91ac" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{ background: "#171c33", border: "1px solid #22263f", borderRadius: 12, color: "#e8eaf5" }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.showName ?? ""}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={900}>
            {shortened.map((_, i) => (
              <Cell key={i} fill="url(#barGradient)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
