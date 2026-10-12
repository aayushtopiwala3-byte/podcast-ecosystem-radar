"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";
import type { TopicPerformance } from "@/lib/stats/topic-performance";

type Props = {
  topics: TopicPerformance[];
};

export default function TopicPerformanceChart({ topics }: Props) {
  const data = [...topics].sort((a, b) => b.avgViewRatio - a.avgViewRatio).slice(0, 10);

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">Topic Performance</h3>
          <p className="text-xs text-[var(--text-dim)]">Average view-ratio score per canonical topic, last 6 months</p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)] py-10 text-center">No topic data in the last 6 months yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#22263f" vertical={false} />
            <XAxis dataKey="tag" stroke="#8b91ac" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="#8b91ac" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "#171c33", border: "1px solid #22263f", borderRadius: 12, color: "#e8eaf5" }}
              labelStyle={{ color: "#8b91ac" }}
              formatter={(value, _name, item) => {
                const d = item.payload as TopicPerformance;
                const v = typeof value === "number" ? value : 0;
                return [
                  d.avgViewRatio > 0
                    ? `${v.toFixed(2)}x avg · ${d.episodeCount} episodes${d.noSignalCount > 0 ? ` · ${d.noSignalCount} with no engagement signal` : ""}`
                    : `no engagement signal available · ${d.episodeCount} episodes`,
                  "Avg view-ratio",
                ];
              }}
            />
            <Bar dataKey="avgViewRatio" radius={[6, 6, 0, 0]} animationDuration={900} animationEasing="ease-out" isAnimationActive>
              {data.map((d) => (
                <Cell key={d.tag} fill={d.avgViewRatio > 0 ? "#22d3ee" : "#3a3f5c"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
