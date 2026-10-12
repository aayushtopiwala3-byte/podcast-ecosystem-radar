import { config } from "dotenv";
config({ path: ".env.local" });
const { buildWeeklyBrief } = await import("../lib/brief/build.ts");

const payload = await buildWeeklyBrief();

console.log(`Guest leads (2+ shows, 6mo window): ${payload.guestLeads.length}`);
console.log(`Trending topics (2+ shows, 6mo window): ${payload.trendingTopics.length}`);
console.log(`Sponsor cross-show (2+ shows, 6mo window): ${payload.sponsorSignals.crossShow.length}`);
console.log(`Sponsor watchlist (single-show ad-reads): ${payload.sponsorSignals.watchlist.length}`);

console.log("\n=== SAMPLE: Trending Topics evidence ===");
for (const t of payload.trendingTopics.slice(0, 5)) {
  console.log(`\n"${t.value}" — ${t.showCount} shows`);
  for (const e of t.evidence) {
    console.log(`  - [${e.showName}] "${e.episodeTitle}" (${e.publishedAt.slice(0,10)}) ${e.episodeUrl}`);
    if (e.excerpt) console.log(`    excerpt: "${e.excerpt}"`);
  }
}

console.log("\n=== Guest leads evidence (if any) ===");
if (payload.guestLeads.length === 0) console.log("none");
for (const g of payload.guestLeads) {
  console.log(`\n"${g.value}" — ${g.showCount} shows`);
  for (const e of g.evidence) console.log(`  - [${e.showName}] "${e.episodeTitle}" (${e.publishedAt.slice(0,10)}) ${e.episodeUrl}`);
}

console.log("\n=== Sponsor cross-show evidence (if any) ===");
if (payload.sponsorSignals.crossShow.length === 0) console.log("none");
for (const s of payload.sponsorSignals.crossShow) {
  console.log(`\n"${s.value}" — ${s.showCount} shows (${s.adReadCount} ad-reads, ${s.mentionCount} mentions)`);
  for (const e of s.evidence) console.log(`  - [${e.showName}] "${e.episodeTitle}" (${e.publishedAt.slice(0,10)}) ${e.episodeUrl}`);
}
