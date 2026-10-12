"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Draft = { id: number; questions: string[]; script: string };
type State = "idle" | "drafting" | "drafted" | "saving" | "unauthorized" | "error";

export default function InterviewPrepComposer({
  topicValue,
  guestValue,
  guestSource,
  evidenceEpisodeId,
  suggestionReason,
}: {
  topicValue: string;
  guestValue: string;
  guestSource: "proven" | "suggested";
  evidenceEpisodeId?: number;
  suggestionReason?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [questionsText, setQuestionsText] = useState("");
  const [script, setScript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleDraft() {
    setState("drafting");
    setError(null);
    try {
      const res = await fetch("/api/admin/interview-prep/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicValue, guestValue, guestSource, evidenceEpisodeId, suggestionReason }),
      });
      if (res.status === 401) {
        setState("unauthorized");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to draft interview prep");
      setDraft(data.draft);
      setQuestionsText((data.draft.questions as string[]).join("\n"));
      setScript(data.draft.script);
      setState("drafted");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  }

  async function handleSaveEdits() {
    if (!draft) return;
    setState("saving");
    setError(null);
    try {
      const questions = questionsText.split("\n").map((q) => q.trim()).filter(Boolean);
      const res = await fetch(`/api/admin/interview-prep/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, script }),
      });
      if (res.status === 401) {
        setState("unauthorized");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save edits");
      setSaved(true);
      setState("drafted");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
      setState("drafted");
    }
  }

  if (state === "unauthorized") {
    return (
      <p className="text-xs text-amber-400 mt-2">
        <a href="/admin" className="underline">
          Log in via Admin
        </a>{" "}
        to generate interview prep.
      </p>
    );
  }

  if (state === "idle" || state === "error") {
    return (
      <div className="mt-2">
        <button
          onClick={handleDraft}
          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
        >
          Prep interview
        </button>
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
      </div>
    );
  }

  if (state === "drafting") {
    return <p className="text-xs text-[var(--text-dim)] mt-2">Drafting interview prep…</p>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="drafted"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 space-y-3 bg-[#0a0e1a] border border-[var(--border)] rounded-lg p-3"
      >
        <p className="text-[10px] text-amber-300/80">
          AI-generated draft — review and edit before recording. Not sourced from a real transcript; angles are
          inferred from topic performance data.
        </p>
        <div>
          <label className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wide">
            Serious questions
          </label>
          <textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            rows={6}
            className="w-full mt-1 px-2 py-1.5 rounded bg-transparent border border-[var(--border)] text-white text-xs outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wide">
            Conversational script / angles
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={6}
            className="w-full mt-1 px-2 py-1.5 rounded bg-transparent border border-[var(--border)] text-white text-xs outline-none focus:border-amber-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveEdits}
            disabled={state === "saving"}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {state === "saving" ? "Saving…" : "Save edits"}
          </button>
          {saved && <span className="text-xs text-emerald-400">Saved.</span>}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </motion.div>
    </AnimatePresence>
  );
}
