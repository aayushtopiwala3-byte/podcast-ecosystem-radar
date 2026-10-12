import { config } from "dotenv";
config({ path: ".env.local" });

const { db } = await import("../lib/db/index.ts");
const { episodes } = await import("../lib/db/schema.ts");
const { extractAndStore } = await import("../lib/ingest/pipeline.ts");
const { mapLimit } = await import("../lib/ingest/concurrency.ts");

const allEpisodes = await db.select({ id: episodes.id, title: episodes.title, rawText: episodes.rawText }).from(episodes);
console.log(`Backfilling entity extraction for ${allEpisodes.length} episodes...`);

let done = 0;
await mapLimit(allEpisodes, 4, async (ep) => {
  await extractAndStore(ep.id, ep.title, ep.rawText, { replaceExisting: true });
  done++;
  console.log(`[${done}/${allEpisodes.length}] episode ${ep.id} re-extracted`);
});

console.log("Backfill complete.");
