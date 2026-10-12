import { config } from "dotenv";
config({ path: ".env.local" });
const { buildWeeklyBrief } = await import("../lib/brief/build.ts");
const { getTopicPerformance, getTopTopics } = await import("../lib/stats/topic-performance.ts");
const { getProvenDraws } = await import("../lib/stats/proven-draws.ts");

const payload = await buildWeeklyBrief();

console.log(`Guest leads (6mo window): ${payload.guestLeads.length}`);
console.log(`  urgent (2+ shows within 30d): ${payload.guestLeads.filter((g) => g.urgent).length}`);
console.log(`  overexposed (4+ appearances within 90d): ${payload.guestLeads.filter((g) => g.overexposed).length}`);
console.log(`Trending topics (6mo window): ${payload.trendingTopics.length}`);
console.log(`Sponsor Tier 1 (ad-read on 2+ shows): ${payload.sponsorSignals.tier1.length}`);
console.log(`Sponsor Tier 2 (organic only): ${payload.sponsorSignals.tier2.length}`);
console.log(`Sponsor single-show ad-reads: ${payload.sponsorSignals.singleShowAdReads.length}`);
console.log(`Sponsor Tier 3 (AI-suggested): ${payload.sponsorSignals.tier3.length}`);

console.log("\n=== Guest urgency/overexposed evidence ===");
for (const g of payload.guestLeads.filter((g) => g.urgent || g.overexposed)) {
  console.log(`\n"${g.value}" — urgent=${g.urgent} overexposed=${g.overexposed}`);
  for (const e of g.evidence) console.log(`  - [${e.showName}] "${e.episodeTitle}" (${e.publishedAt.slice(0, 10)})`);
}

console.log("\n=== Sponsor Tier 1 evidence ===");
if (payload.sponsorSignals.tier1.length === 0) console.log("none");
for (const s of payload.sponsorSignals.tier1) {
  console.log(`\n"${s.value}" — ${s.showCount} shows (${s.adReadCount} ad-reads, ${s.mentionCount} mentions)`);
  for (const e of s.evidence) console.log(`  - [${e.showName}] "${e.episodeTitle}" (${e.publishedAt.slice(0, 10)})`);
}

console.log("\n=== Topic Performance (all, last 6mo) ===");
const perf = await getTopicPerformance();
for (const t of perf) {
  console.log(
    `"${t.tag}" — ${t.showCount} shows, ${t.episodeCount} episodes, avgViewRatio=${t.avgViewRatio.toFixed(2)}, noSignalCount=${t.noSignalCount}`
  );
}

console.log("\n=== Top 5 Topics (blended) ===");
const top5 = await getTopTopics(5);
for (const t of top5) {
  console.log(`"${t.tag}" — blendScore=${t.blendScore.toFixed(3)} showCount=${t.showCount} avgViewRatio=${t.avgViewRatio.toFixed(2)}`);
  const draws = await getProvenDraws(t.tag, 3);
  for (const d of draws) {
    console.log(
      `  proven draw: ${d.guestName} — ${d.episodeTitle} (${d.showName}, ${d.publishedAt.slice(0, 10)}) viewRatio=${d.viewRatio?.toFixed(2) ?? "no signal"}`
    );
  }
}
