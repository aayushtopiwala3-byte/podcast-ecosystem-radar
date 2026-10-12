import { config } from "dotenv";
config({ path: ".env.local" });
const { db } = await import("../lib/db/index.ts");
const { episodeEntities, episodes, shows } = await import("../lib/db/schema.ts");
const { eq, sql } = await import("drizzle-orm");

const rows = await db
  .select({
    type: episodeEntities.type,
    value: episodeEntities.value,
    normalizedValue: episodeEntities.normalizedValue,
    showId: shows.id,
    publishedAt: episodes.publishedAt,
  })
  .from(episodeEntities)
  .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
  .innerJoin(shows, eq(episodes.showId, shows.id));

console.log("total entity rows:", rows.length);

const dates = rows.map(r => r.publishedAt).sort((a,b) => a - b);
console.log("earliest publishedAt:", dates[0]);
console.log("latest publishedAt:", dates[dates.length-1]);

for (const type of ["guest", "topic", "sponsor"]) {
  const groups = new Map();
  for (const r of rows.filter(r => r.type === type)) {
    const key = r.normalizedValue;
    if (!groups.has(key)) groups.set(key, { value: r.value, showIds: new Set() });
    groups.get(key).showIds.add(r.showId);
  }
  const multi = Array.from(groups.values()).filter(g => g.showIds.size >= 2);
  console.log(`\n=== ${type}: ${groups.size} distinct normalized values, ${multi.length} with 2+ shows (current全 data, no window filter) ===`);
  multi.slice(0, 10).forEach(g => console.log(" -", g.value, "shows:", g.showIds.size));
}
