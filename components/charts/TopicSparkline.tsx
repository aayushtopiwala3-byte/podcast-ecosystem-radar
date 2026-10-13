"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

type Props = {
  avgRatioB1: number | null;
  avgRatioB2: number | null;
  avgRatioB3: number | null;
  color: string;
};

// 3-point sparkline: B1 (61-90d ago) -> B3 (0-30d ago) avg viewRatio per bucket.
// Null buckets render as gaps (no fabricated zero), since a null avgRatio means
// no episode in that window had view data, not that performance was zero.
export default function TopicSparkline({ avgRatioB1, avgRatioB2, avgRatioB3, color }: Props) {
  const data = [
    { name: "61-90d", value: avgRatioB1 },
    { name: "31-60d", value: avgRatioB2 },
    { name: "0-30d", value: avgRatioB3 },
  ];
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  if (values.length === 0) return null;

  return (
    <div className="h-10 w-24 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2, fill: color }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
