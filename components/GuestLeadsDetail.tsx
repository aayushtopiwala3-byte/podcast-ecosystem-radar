"use client";

import { motion } from "framer-motion";
import { fmtDate } from "./EvidenceList";
import InviteComposer from "./InviteComposer";
import type { GlobalProvenDraw } from "@/lib/stats/proven-draws";
import type { SuggestedGuest } from "@/lib/brief/build";

const listVariants = { show: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

type Props = {
  provenDraws: GlobalProvenDraw[];
  suggestedGuests: SuggestedGuest[];
  repeatAppearanceCount: number;
};

export default function GuestLeadsDetail({ provenDraws, suggestedGuests, repeatAppearanceCount }: Props) {
  return (
    <div>
      <p className="text-xs text-[var(--text-dim)] border-b border-[var(--border)] pb-3 mb-4">
        Repeat-across-shows check (trailing 6 months, name-normalized): <span className="text-white font-semibold">{repeatAppearanceCount}</span>{" "}
        guest{repeatAppearanceCount === 1 ? "" : "s"} appeared on 2+ distinct monitored shows in this exact sense.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <h4 className="text-xs font-semibold text-emerald-400 mb-2">Proven draws</h4>
          <p className="text-[10px] text-[var(--text-dim)] mb-2">
            Guest episodes, in a trending topic, that significantly outperformed that show's own trailing average
          </p>
          {provenDraws.length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">No qualifying proven draws yet.</p>
          ) : (
            <motion.ul className="space-y-3" initial="hidden" animate="show" variants={listVariants}>
              {provenDraws.map((d, i) => (
                <motion.li key={i} className="text-sm" variants={itemVariants} transition={{ duration: 0.25 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white/80">{d.guestName}</span>
                    {d.viewRatio != null && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                        {d.viewRatio.toFixed(2)}x
                      </span>
                    )}
                  </div>
                  <a href={d.episodeUrl} target="_blank" rel="noopener noreferrer" className="text-white hover:underline font-medium">
                    {d.episodeTitle}
                  </a>
                  <div className="text-xs text-[var(--text-dim)] mt-0.5">
                    {d.showName} · {fmtDate(d.publishedAt)} · topic: {d.topic}
                  </div>
                  {d.excerpt && (
                    <blockquote className="text-xs text-[var(--text-dim)] italic mt-1 pl-2 border-l-2 border-[var(--border)]">
                      "{d.excerpt}"
                    </blockquote>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-violet-400 mb-2">AI-suggested new guests</h4>
          <p className="text-[10px] text-[var(--text-dim)] mb-2">
            AI suggestion — not sourced from monitored podcasts, unverified
          </p>
          {suggestedGuests.length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">No suggestions generated yet.</p>
          ) : (
            <motion.ul className="space-y-3" initial="hidden" animate="show" variants={listVariants}>
              {suggestedGuests.map((s, i) => (
                <motion.li key={i} className="text-sm" variants={itemVariants} transition={{ duration: 0.25 }}>
                  <div className="text-white font-medium">{s.value}</div>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5">{s.reason}</p>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">topic: {s.topic}</div>
                  {s.sourceUrl && (
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-300 hover:underline">
                      Source
                    </a>
                  )}
                  <InviteComposer guestValue={s.value} topicValue={s.topic} />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </div>
  );
}
