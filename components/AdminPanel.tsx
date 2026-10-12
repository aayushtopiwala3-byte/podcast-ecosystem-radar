"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Show = {
  id: number;
  name: string;
  slug: string;
  platform: string;
  youtubeChannelId: string | null;
  youtubeHandle: string | null;
  rssUrl: string | null;
  active: boolean;
  lastFetchedAt: string | Date | null;
  createdAt: string | Date;
};

export default function AdminPanel({ initialShows }: { initialShows: Show[] }) {
  const [shows, setShows] = useState(initialShows);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [runResult, setRunResult] = useState<any>(null);
  const router = useRouter();

  const [newShow, setNewShow] = useState({ name: "", platform: "youtube", handle: "", rssUrl: "" });
  const [resolving, setResolving] = useState(false);
  const [resolvedChannel, setResolvedChannel] = useState<{ id: string; title: string } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  async function handleRunPipeline() {
    setRunStatus("running");
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/run-pipeline", { method: "POST" });
      const data = await res.json();
      setRunResult(data);
      setRunStatus(res.ok && data.ok ? "done" : "error");
      router.refresh();
    } catch (err: any) {
      setRunResult({ error: err.message });
      setRunStatus("error");
    }
  }

  async function toggleActive(show: Show) {
    const res = await fetch(`/api/admin/shows/${show.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !show.active }),
    });
    if (res.ok) {
      const data = await res.json();
      setShows((prev) => prev.map((s) => (s.id === show.id ? data.show : s)));
    }
  }

  async function deleteShow(id: number) {
    if (!confirm("Remove this show? Its episodes and entities will also be deleted.")) return;
    const res = await fetch(`/api/admin/shows/${id}`, { method: "DELETE" });
    if (res.ok) setShows((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleResolve() {
    setResolving(true);
    setResolvedChannel(null);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/resolve-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: newShow.handle.startsWith("@")
          ? JSON.stringify({ handle: newShow.handle })
          : JSON.stringify({ query: newShow.handle }),
      });
      const data = await res.json();
      if (res.ok) setResolvedChannel({ id: data.channelId, title: data.title });
      else setAddError(data.error ?? "Could not resolve channel");
    } finally {
      setResolving(false);
    }
  }

  async function handleAddShow() {
    setAddError(null);
    if (!newShow.name.trim()) {
      setAddError("Show name is required");
      return;
    }
    const body: any = { name: newShow.name, platform: newShow.platform };
    if (newShow.platform === "youtube") {
      if (!resolvedChannel) {
        setAddError("Resolve the YouTube channel first");
        return;
      }
      body.youtubeChannelId = resolvedChannel.id;
      body.youtubeHandle = newShow.handle.startsWith("@") ? newShow.handle : null;
    } else {
      if (!newShow.rssUrl.trim()) {
        setAddError("RSS URL is required");
        return;
      }
      body.rssUrl = newShow.rssUrl;
    }

    const res = await fetch("/api/admin/shows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setShows((prev) => [data.show, ...prev]);
      setNewShow({ name: "", platform: "youtube", handle: "", rssUrl: "" });
      setResolvedChannel(null);
    } else {
      setAddError(data.error ?? "Failed to add show");
    }
  }

  return (
    <div className="space-y-8">
      <div className="card p-6 flex items-center justify-between fade-slide-in">
        <div>
          <h2 className="font-semibold text-white mb-1">Pipeline control</h2>
          <p className="text-xs text-[var(--text-dim)]">
            Fetches new episodes for all active shows, extracts entities with Gemini, builds the weekly brief, and emails it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleLogout} className="text-sm text-[var(--text-dim)] hover:text-white">
            Log out
          </button>
          <button
            onClick={handleRunPipeline}
            disabled={runStatus === "running"}
            className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#22d3ee] to-[#7c3aed] disabled:opacity-60 shrink-0"
          >
            {runStatus === "running" ? "Running…" : "Run pipeline now"}
          </button>
        </div>
      </div>

      {runResult && (
        <div className={`card p-5 fade-slide-in ${runStatus === "error" ? "border-rose-500/40" : ""}`}>
          <pre className="text-xs text-[var(--text-dim)] whitespace-pre-wrap overflow-x-auto max-h-80">
            {JSON.stringify(runResult, null, 2)}
          </pre>
        </div>
      )}

      <div className="card p-6 fade-slide-in">
        <h2 className="font-semibold text-white mb-4">Add a show</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            placeholder="Show name"
            value={newShow.name}
            onChange={(e) => setNewShow((s) => ({ ...s, name: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-[#0a0e1a] border border-[var(--border)] text-white placeholder-[var(--text-dim)] outline-none focus:border-[var(--violet)]"
          />
          <select
            value={newShow.platform}
            onChange={(e) => setNewShow((s) => ({ ...s, platform: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-[#0a0e1a] border border-[var(--border)] text-white outline-none focus:border-[var(--violet)]"
          >
            <option value="youtube">YouTube</option>
            <option value="rss">RSS</option>
          </select>

          {newShow.platform === "youtube" ? (
            <>
              <div className="flex gap-2 md:col-span-2">
                <input
                  placeholder="@handle or search query (e.g. show name)"
                  value={newShow.handle}
                  onChange={(e) => setNewShow((s) => ({ ...s, handle: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0a0e1a] border border-[var(--border)] text-white placeholder-[var(--text-dim)] outline-none focus:border-[var(--violet)]"
                />
                <button
                  onClick={handleResolve}
                  disabled={resolving || !newShow.handle.trim()}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm disabled:opacity-50"
                >
                  {resolving ? "Resolving…" : "Resolve"}
                </button>
              </div>
              {resolvedChannel && (
                <div className="md:col-span-2 text-xs text-emerald-400">
                  Resolved: {resolvedChannel.title} ({resolvedChannel.id})
                </div>
              )}
            </>
          ) : (
            <input
              placeholder="RSS feed URL"
              value={newShow.rssUrl}
              onChange={(e) => setNewShow((s) => ({ ...s, rssUrl: e.target.value }))}
              className="md:col-span-2 px-3 py-2 rounded-lg bg-[#0a0e1a] border border-[var(--border)] text-white placeholder-[var(--text-dim)] outline-none focus:border-[var(--violet)]"
            />
          )}
        </div>
        {addError && <p className="text-sm text-rose-400 mt-3">{addError}</p>}
        <button
          onClick={handleAddShow}
          className="mt-4 px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#a855f7] to-[#7c3aed]"
        >
          Add show
        </button>
      </div>

      <div>
        <h2 className="font-semibold text-white mb-4">Monitored shows ({shows.length})</h2>
        <div className="space-y-3">
          {shows.map((show) => (
            <div key={show.id} className="card p-4 flex items-center justify-between gap-4 fade-slide-in">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{show.name}</div>
                <div className="text-xs text-[var(--text-dim)] truncate">
                  {show.platform === "youtube" ? show.youtubeChannelId ?? "no channel ID set" : show.rssUrl}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    show.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"
                  }`}
                >
                  {show.active ? "Active" : "Inactive"}
                </span>
                <button onClick={() => toggleActive(show)} className="text-xs text-[var(--text-dim)] hover:text-white underline">
                  {show.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => deleteShow(show.id)} className="text-xs text-rose-400 hover:text-rose-300 underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
