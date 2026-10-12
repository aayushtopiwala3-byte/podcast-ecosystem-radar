import StatCard from "@/components/StatCard";
import TopicPerformanceChart from "@/components/charts/TopicPerformanceChart";
import EntityMixDonut from "@/components/charts/EntityMixDonut";
import SponsorSplitDonut from "@/components/charts/SponsorSplitDonut";
import EpisodesPerShowBar from "@/components/charts/EpisodesPerShowBar";
import BriefSections from "@/components/BriefSections";
import TopTopicsPanel from "@/components/TopTopicsPanel";
import {
  getEntityMixThisWeek,
  getEntityMixDetail,
  getSponsorMentionSplit,
  getSponsorMentionDetail,
  getEpisodesPerShow,
  getStatCardCounts,
} from "@/lib/stats/dashboard";
import { getTopicPerformance, getTopTopics } from "@/lib/stats/topic-performance";
import type { BriefPayload, GuestLead, FlaggedEntity, FlaggedSponsor } from "@/lib/brief/build";
import type { EvidenceRow } from "@/components/EvidenceList";

export const dynamic = "force-dynamic";

function guestsToEvidence(leads: GuestLead[]): EvidenceRow[] {
  return leads.flatMap((g) => {
    const badge = g.urgent ? "Act fast" : g.overexposed ? "Overexposed" : undefined;
    return g.evidence.map((e) => ({ value: g.value, badge, ...e }));
  });
}

function topicsToEvidence(topics: FlaggedEntity[]): EvidenceRow[] {
  return topics.flatMap((t) =>
    t.evidence.map((e) => ({ value: t.value, badge: `${t.showCount} shows`, ...e }))
  );
}

function sponsorsToEvidence(sponsors: FlaggedSponsor[], badge: string): EvidenceRow[] {
  return sponsors.flatMap((s) => s.evidence.map((e) => ({ value: s.value, badge, ...e })));
}

export default async function HomePage() {
  const [entityMix, entityMixDetail, sponsorSplit, sponsorMentionDetail, perShow, statCounts, topicPerformance, topTopics] =
    await Promise.all([
      getEntityMixThisWeek(),
      getEntityMixDetail(),
      getSponsorMentionSplit(),
      getSponsorMentionDetail(),
      getEpisodesPerShow(),
      getStatCardCounts(),
      getTopicPerformance(),
      getTopTopics(5),
    ]);

  const latestBrief = statCounts.latestBrief;
  const payload = latestBrief?.payload as BriefPayload | undefined;

  const guestDetail = payload ? guestsToEvidence(payload.guestLeads) : [];
  const topicDetail = payload ? topicsToEvidence(payload.trendingTopics) : [];
  const sponsorDetail = payload
    ? [
        ...sponsorsToEvidence(payload.sponsorSignals.tier1, "Tier 1"),
        ...sponsorsToEvidence(payload.sponsorSignals.tier2, "Tier 2"),
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">This Week's Radar</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {latestBrief
            ? `Brief generated ${new Date(latestBrief.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
            : "No brief generated yet — run the pipeline from Admin to produce the first one."}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard
          label="New Guest Leads"
          value={statCounts.guestCount}
          change={statCounts.guestChange}
          gradient={["#a855f7", "#7c3aed"]}
          glowClass="glow-violet"
          icon={<GuestIcon />}
          modalTitle="Guest Leads — trailing 6 months"
          emptyText="No guests appeared on 2+ monitored shows in the last 6 months."
          detail={guestDetail}
        />
        <StatCard
          label="Trending Topics"
          value={statCounts.topicCount}
          change={statCounts.topicChange}
          gradient={["#22d3ee", "#3b82f6"]}
          glowClass="glow-cyan"
          icon={<TopicIcon />}
          modalTitle="Trending Topics — trailing 6 months"
          emptyText="No topics covered by 2+ shows in the last 6 months."
          detail={topicDetail}
        />
        <StatCard
          label="Sponsor Signals"
          value={statCounts.sponsorCount}
          change={statCounts.sponsorChange}
          gradient={["#ec4899", "#d946ef"]}
          glowClass="glow-magenta"
          icon={<SponsorIcon />}
          modalTitle="Sponsor Signals — trailing 6 months"
          emptyText="No qualifying sponsor signals in the last 6 months."
          detail={sponsorDetail}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        <div className="lg:col-span-2">
          <TopicPerformanceChart topics={topicPerformance} />
        </div>
        <EntityMixDonut guest={entityMix.guest} topic={entityMix.topic} sponsor={entityMix.sponsor} detail={entityMixDetail} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        <div className="lg:col-span-2">
          <EpisodesPerShowBar data={perShow} />
        </div>
        <SponsorSplitDonut adRead={sponsorSplit.adRead} mention={sponsorSplit.mention} detail={sponsorMentionDetail} />
      </div>

      <div className="mb-10">
        <TopTopicsPanel topics={topTopics} />
      </div>

      {payload ? (
        <BriefSections payload={payload} />
      ) : (
        <div className="card p-10 text-center text-[var(--text-dim)]">
          No weekly brief yet. Head to Admin and click "Run pipeline now".
        </div>
      )}
    </div>
  );
}

function GuestIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  );
}
function TopicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h12" />
    </svg>
  );
}
function SponsorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2">
      <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
    </svg>
  );
}
