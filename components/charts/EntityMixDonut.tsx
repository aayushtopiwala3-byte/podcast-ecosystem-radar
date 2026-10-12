"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Props = {
  guest: number;
  topic: number;
  sponsor: number;
};

export default function EntityMixDonut({ guest, topic, sponsor }: Props) {
  const total = guest + topic + sponsor;
  const data = [
    { name: "Guests", value: guest, color: "#a855f7" },
    { name: "Topics", value: topic, color: "#22d3ee" },
    { name: "Sponsors", value: sponsor, color: "#ec4899" },
  ];

  return (
    <div className="card p-6 fade-slide-in relative">
      <h3 className="font-semibold text-white mb-1">This Week's Mix</h3>
      <p className="text-xs text-[var(--text-dim)] mb-2">Extracted entities, trailing 7 days</p>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              animationDuration={900}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#171c33", border: "1px solid #22263f", borderRadius: 12, color: "#e8eaf5" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl font-bold text-white">{total}</div>
          <div className="text-xs text-[var(--text-dim)]">total</div>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
