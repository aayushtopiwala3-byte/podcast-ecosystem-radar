"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Brief", icon: RadarIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/sources", label: "Sources", icon: SourceIcon },
  { href: "/admin", label: "Admin", icon: AdminIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-[var(--border)] bg-[#0b0f1d] px-4 py-6">
      <div className="px-2 mb-8">
        <div className="text-lg font-bold tracking-tight bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#ec4899] bg-clip-text text-transparent">
          Podcast Radar
        </div>
        <div className="text-xs text-[var(--text-dim)] mt-1">Ecosystem Intelligence</div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? "text-white bg-white/5" : "text-[var(--text-dim)] hover:text-white hover:bg-white/5"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-[#a855f7] to-[#ec4899]" />
              )}
              <item.icon active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 text-[11px] text-[var(--text-dim)] leading-relaxed">
        Weekly brief every Monday, 5:00 AM IST — before production week.
      </div>
    </aside>
  );
}

function RadarIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "currentColor"} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 L18 7" />
      <circle cx="12" cy="12" r="1.5" fill={active ? "#a855f7" : "currentColor"} />
    </svg>
  );
}
function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#22d3ee" : "currentColor"} strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function SourceIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#ec4899" : "currentColor"} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function AdminIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#f59e0b" : "currentColor"} strokeWidth="2">
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
    </svg>
  );
}
