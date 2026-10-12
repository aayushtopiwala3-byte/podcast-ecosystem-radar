import type { RankedTopic } from "@/lib/stats/topic-performance";
import { getProvenDraws } from "@/lib/stats/proven-draws";
import { getCachedSuggestions } from "@/lib/ai-suggestions";
import { fmtDate } from "./EvidenceList";
import InviteComposer from "./InviteComposer";

export default async function TopTopicsPanel({ topics }: { topics: RankedTopic[] }) {
  if (topics.length === 0) return null;

  const panels = await Promise.all(
    topics.map(async (t) => ({
      topic: t,
      provenDraws: await getProvenDraws(t.tag, 3),
      suggestedGuests: await getCachedSuggestions("guest", t.tag),
    }))
  );

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-1.5 h-6 rounded-full" style={{ background: "#f59e0b" }} />
        <div>
          <h2 className="text-lg font-bold text-white">Top 5 Topics</h2>
          <p className="text-xs text-[var(--text-dim)]">
            Last 6 months, ranked by cross-show frequency blended with view-ratio performance
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {panels.map(({ topic, provenDraws, suggestedGuests }) => (
          <div key={topic.tag} className="card p-4 fade-slide-in">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold text-white">{topic.tag}</h3>
              <span className="text-xs text-[var(--text-dim)]">
                {topic.showCount} shows · {topic.avgViewRatio > 0 ? `${topic.avgViewRatio.toFixed(2)}x avg view-ratio` : "no engagement signal available"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-emerald-400 mb-2">Proven draws</h4>
                {provenDraws.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)]">No guest evidence for this topic yet.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {provenDraws.map((d, i) => (
                      <li key={i} className="text-sm">
                        <div className="text-xs font-semibold text-white/80">{d.guestName}</div>
                        <a
                          href={d.episodeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white hover:underline font-medium text-sm"
                        >
                          {d.episodeTitle}
                        </a>
                        <div className="text-xs text-[var(--text-dim)] mt-0.5">
                          {d.showName} · {fmtDate(d.publishedAt)} ·{" "}
                          {d.viewRatio != null ? `${d.viewRatio.toFixed(2)}x` : "no engagement signal available"}
                        </div>
                        {d.excerpt && (
                          <blockquote className="text-xs text-[var(--text-dim)] italic mt-1 pl-2 border-l-2 border-[var(--border)]">
                            "{d.excerpt}"
                          </blockquote>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-violet-400 mb-2">Suggested new guests</h4>
                <p className="text-[10px] text-[var(--text-dim)] mb-2">
                  AI suggestion — not sourced from monitored podcasts, unverified
                </p>
                {suggestedGuests.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)]">No suggestions generated yet.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {suggestedGuests.map((s, i) => (
                      <li key={i} className="text-sm">
                        <div className="text-white font-medium">{s.name}</div>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">{s.reason}</p>
                        {s.sourceUrl && (
                          <a
                            href={s.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-300 hover:underline"
                          >
                            Source
                          </a>
                        )}
                        <InviteComposer guestValue={s.name} topicValue={topic.tag} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
