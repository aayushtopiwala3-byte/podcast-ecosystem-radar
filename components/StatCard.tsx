"use client";

import { useEffect, useRef, useState } from "react";
import { motion, animate } from "framer-motion";
import Modal from "./Modal";
import EvidenceList, { type EvidenceRow } from "./EvidenceList";

type Props = {
  label: string;
  value: number;
  change: number;
  gradient: [string, string];
  glowClass: string;
  icon: React.ReactNode;
  modalTitle: string;
  emptyText: string;
  detail?: EvidenceRow[];
  // Pre-rendered modal content (built server-side) for cards whose drill-down
  // needs more than a single flat evidence list — e.g. New Guest Leads, which
  // shows proven draws and AI-suggested guests as two separately labeled lists.
  // Takes precedence over detail/emptyText when provided.
  modalBody?: React.ReactNode;
};

export default function StatCard({
  label,
  value,
  change,
  gradient,
  glowClass,
  icon,
  modalTitle,
  emptyText,
  detail = [],
  modalBody,
}: Props) {
  const [display, setDisplay] = useState(0);
  const [open, setOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);

  const positive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`card relative overflow-hidden p-6 ${glowClass}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className="cursor-pointer outline-none hover:brightness-110 transition"
      >
        <div
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl"
          style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
        />
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${gradient[0]}22, ${gradient[1]}22)` }}
          >
            {icon}
          </div>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              positive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
            }`}
          >
            {positive ? "+" : ""}
            {change}% vs last week
          </span>
        </div>
        <div
          className="text-4xl font-bold tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
        >
          {display}
        </div>
        <div className="text-sm text-[var(--text-dim)] mt-1">{label}</div>
        <div className="text-xs text-[var(--text-dim)]/70 mt-2">Click to view details →</div>
      </div>

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {modalBody ? (
          modalBody
        ) : detail.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">{emptyText}</p>
        ) : (
          <EvidenceList evidence={detail} />
        )}
      </Modal>
    </motion.div>
  );
}
