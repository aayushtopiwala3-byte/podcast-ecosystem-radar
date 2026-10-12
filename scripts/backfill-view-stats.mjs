import { config } from "dotenv";
config({ path: ".env.local" });

const { db } = await import("../lib/db/index.ts");
const { episodes, shows } = await import("../lib/db/schema.ts");
const { eq, like } = await import("drizzle-orm");
const { fetchViewCounts, extractVideoIdFromUrl } = await import("../lib/youtube/stats.ts");
const { recomputeViewRatios } = await import("../lib/scoring/virality.ts");

const youtubeEpisodes = await db
  .select({ id: episodes.id, url: episodes.url })
  .from(episodes)
  .where(like(episodes.url, "https://www.youtube.com/watch%"));

console.log(`Found ${youtubeEpisodes.length} YouTube episodes to backfill view counts for.`);

const idToEpisode = new Map();
for (const ep of youtubeEpisodes) {
  const videoId = extractVideoIdFromUrl(ep.url);
  if (videoId) idToEpisode.set(videoId, ep.id);
}

const videoIds = Array.from(idToEpisode.keys());
const viewCounts = await fetchViewCounts(videoIds);

let updated = 0;
let missing = 0;
for (const [videoId, episodeId] of idToEpisode) {
  const count = viewCounts[videoId];
  if (count === undefined) {
    missing++;
    continue;
  }
  await db.update(episodes).set({ viewCount: count }).where(eq(episodes.id, episodeId));
  updated++;
}

console.log(`Updated viewCount for ${updated} episodes; ${missing} had no stats available (deleted/private video).`);

const allShows = await db.select({ id: shows.id, name: shows.name }).from(shows);
for (const show of allShows) {
  await recomputeViewRatios(show.id);
  console.log(`Recomputed view ratios for show ${show.name}`);
}

console.log("View-stats backfill complete.");
