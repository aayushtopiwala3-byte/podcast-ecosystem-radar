"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import Modal from "../Modal";
import EvidenceList, { type EvidenceRow } from "../EvidenceList";

type MentionType = "adRead" | "mention";

type Props = {
  adRead: number;
  mention: number;
  detail: Record<MentionType, EvidenceRow[]>;
};

const LABELS: Record<MentionType, string> = { adRead: "Ad read", mention: "Mention" };

export default function SponsorSplitDonut({ adRead, mention, detail }: Props) {
  const [open, setOpen] = useState<MentionType | null>(null);
  // Retains the last-opened type during the modal's exit animation, since `open`
  // itself flips to null immediately on close (before the fade-out finishes).
  const [displayType, setDisplayType] = useState<MentionType | null>(null);
  const total = adRead + mention;
  const data: { name: string; value: number; color: string; type: MentionType }[] = [
    { name: "Ad read", value: adRead, color: "#ec4899", type: "adRead" },
    { name: "Mention", value: mention, color: "#d946ef", type: "mention" },
  ];

  function handleOpen(type: MentionType) {
    setDisplayType(type);
    setOpen(type);
  }

  return (
    <motion.div
      className="card p-6 relative"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <h3 className="font-semibold text-white mb-1">Sponsor Activity</h3>
      <p className="text-xs text-[var(--text-dim)] mb-2">Ad-read vs. mention, trailing 30 days · click a segment for detail</p>
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
                <Cell key={d.name} fill={d.color} cursor="pointer" onClick={() => handleOpen(d.type)} />
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
          <button
            key={d.name}
            onClick={() => handleOpen(d.type)}
            className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-white"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </button>
        ))}
      </div>

      {displayType && (
        <Modal open={open !== null} title={`${LABELS[displayType]} — trailing 30 days`} onClose={() => setOpen(null)}>
          {detail[displayType].length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No {LABELS[displayType].toLowerCase()} sponsors in this window.</p>
          ) : (
            <EvidenceList evidence={detail[displayType]} />
          )}
        </Modal>
      )}
    </motion.div>
  );
}
