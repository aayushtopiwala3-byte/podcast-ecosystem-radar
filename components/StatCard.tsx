"use client";

import { useEffect, useRef, useState } from "react";
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
  detail: EvidenceRow[];
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
  detail,
}: Props) {
  const [display, setDisplay] = useState(0);
  const [open, setOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const duration = 900;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  const positive = change >= 0;

  return (
    <div className={`card fade-slide-in relative overflow-hidden p-6 ${glowClass}`}>
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

      {open && (
        <Modal title={modalTitle} onClose={() => setOpen(false)}>
          {detail.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">{emptyText}</p>
          ) : (
            <EvidenceList evidence={detail} />
          )}
        </Modal>
      )}
    </div>
  );
}
