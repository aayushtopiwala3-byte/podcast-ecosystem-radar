"use client";

import { useState } from "react";

type Draft = { id: number; subject: string; body: string };
type State = "idle" | "drafting" | "drafted" | "sending" | "sent" | "unauthorized" | "error";

export default function SponsorPitchComposer({ brand }: { brand: string }) {
  const [state, setState] = useState<State>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    setState("drafting");
    setError(null);
    try {
      const res = await fetch("/api/admin/sponsor-pitches/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand }),
      });
      if (res.status === 401) {
        setState("unauthorized");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to draft sponsor pitch");
      setDraft(data.draft);
      setSubject(data.draft.subject);
      setBody(data.draft.body);
      setState("drafted");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  }

  async function handleSend() {
    if (!draft) return;
    setState("sending");
    setError(null);
    try {
      if (subject !== draft.subject || body !== draft.body) {
        const patchRes = await fetch(`/api/admin/sponsor-pitches/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body }),
        });
        if (patchRes.status === 401) {
          setState("unauthorized");
          return;
        }
      }
      const res = await fetch(`/api/admin/sponsor-pitches/${draft.id}/send`, { method: "POST" });
      if (res.status === 401) {
        setState("unauthorized");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send sponsor pitch");
      setState("sent");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  }

  if (state === "unauthorized") {
    return (
      <p className="text-xs text-amber-400 mt-2">
        <a href="/admin" className="underline">
          Log in via Admin
        </a>{" "}
        to draft or send sponsor pitches.
      </p>
    );
  }

  if (state === "idle" || state === "error") {
    return (
      <div className="mt-2">
        <button
          onClick={handleDraft}
          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/15 text-pink-300 hover:bg-pink-500/25"
        >
          Draft pitch
        </button>
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
      </div>
    );
  }

  if (state === "drafting") {
    return <p className="text-xs text-[var(--text-dim)] mt-2">Drafting pitch…</p>;
  }

  if (state === "sent") {
    return <p className="text-xs text-emerald-400 mt-2">Pitch sent to your inbox.</p>;
  }

  return (
    <div className="mt-2 space-y-2 bg-[#0a0e1a] border border-[var(--border)] rounded-lg p-3">
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full px-2 py-1.5 rounded bg-transparent border border-[var(--border)] text-white text-sm outline-none focus:border-[var(--magenta)]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full px-2 py-1.5 rounded bg-transparent border border-[var(--border)] text-white text-xs outline-none focus:border-[var(--magenta)]"
      />
      <button
        onClick={handleSend}
        disabled={state === "sending"}
        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send to my inbox"}
      </button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
