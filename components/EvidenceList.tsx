export type EvidenceRow = {
  value?: string;
  badge?: string;
  showName: string;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: string;
  excerpt: string | null;
};

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function EvidenceList({ evidence }: { evidence: EvidenceRow[] }) {
  return (
    <ul className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
      {evidence.map((e, i) => (
        <li key={i} className="text-sm">
          {e.value && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/80">{e.value}</span>
              {e.badge && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--text-dim)]">
                  {e.badge}
                </span>
              )}
            </div>
          )}
          <a
            href={e.episodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            {e.episodeTitle}
          </a>
          <div className="text-xs text-[var(--text-dim)] mt-0.5">
            {e.showName} · {fmtDate(e.publishedAt)}
          </div>
          {e.excerpt && (
            <blockquote className="text-xs text-[var(--text-dim)] italic mt-1 pl-2 border-l-2 border-[var(--border)]">
              "{e.excerpt}"
            </blockquote>
          )}
        </li>
      ))}
    </ul>
  );
}
