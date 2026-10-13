import { getAllShowsWithStatus, getLatestPipelineRun, getWeeklyEpisodeSeries } from "@/lib/stats/dashboard";
import EpisodeTrendChart from "@/components/charts/EpisodeTrendChart";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  success: { color: "#34d399", dot: "bg-emerald-400", label: "Succeeded" },
  no_new_episodes: { color: "#34d399", dot: "bg-emerald-400", label: "Up to date" },
  partial: { color: "#fbbf24", dot: "bg-amber-400", label: "Partial" },
  failed: { color: "#fb7185", dot: "bg-rose-400", label: "Failed" },
  never_run: { color: "#8b91ac", dot: "bg-slate-500", label: "Never run" },
  unknown: { color: "#8b91ac", dot: "bg-slate-500", label: "Unknown" },
};

export default async function SourcesPage() {
  const [shows, latestRun, series] = await Promise.all([
    getAllShowsWithStatus(),
    getLatestPipelineRun(),
    getWeeklyEpisodeSeries(),
  ]);

  const aiModel = (latestRun?.details as any)?.model as string | undefined;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Source Health</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {latestRun
            ? `Last pipeline run: ${new Date(latestRun.startedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })} — status: ${latestRun.status}`
            : "Pipeline has never run yet."}
        </p>
        {aiModel && <p className="text-xs text-[var(--text-dim)] mt-1">AI model: {aiModel} (Gemini Flash)</p>}
      </header>

      <div className="mb-8">
        <EpisodeTrendChart weeks={series.weeks} totals={series.totals} highlighted={series.highlighted} />
      </div>

      <div className="space-y-3">
        {shows.map((show) => {
          const cfg = STATUS_CONFIG[show.lastRunStatus] ?? STATUS_CONFIG.unknown;
          return (
            <div key={show.id} className="card p-5 flex items-center justify-between gap-4 fade-slide-in">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{show.name}</div>
                  <div className="text-xs text-[var(--text-dim)] mt-0.5">
                    {show.platform === "youtube" ? `YouTube · ${show.youtubeChannelId ?? "no channel ID"}` : `RSS · ${show.rssUrl}`}
                    {!show.active && " · inactive"}
                  </div>
                  {show.lastRunError && (
                    <div className="text-xs text-rose-400 mt-1">{show.lastRunError}</div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${cfg.color}22`, color: cfg.color }}>
                  {cfg.label}
                </span>
                {show.lastFetchedAt && (
                  <div className="text-[11px] text-[var(--text-dim)] mt-1">
                    Last fetched {new Date(show.lastFetchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                )}
                {!show.lastFetchedAt && <div className="text-[11px] text-[var(--text-dim)] mt-1">Never successfully fetched</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
