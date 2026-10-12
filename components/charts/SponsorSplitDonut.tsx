"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Props = {
  adRead: number;
  mention: number;
};

export default function SponsorSplitDonut({ adRead, mention }: Props) {
  const total = adRead + mention;
  const data = [
    { name: "Ad read", value: adRead, color: "#ec4899" },
    { name: "Mention", value: mention, color: "#d946ef" },
  ];

  return (
    <div className="card p-6 fade-slide-in relative">
      <h3 className="font-semibold text-white mb-1">Sponsor Activity</h3>
      <p className="text-xs text-[var(--text-dim)] mb-2">Ad-read vs. mention, trailing 30 days</p>
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
          <div className="text-xs text-[var(--text-dim)]">mentions</div>
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
