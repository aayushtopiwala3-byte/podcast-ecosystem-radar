import { config } from "dotenv";
config({ path: ".env.local" });
const { db } = await import("../lib/db/index.ts");
const { episodeEntities, episodes, shows } = await import("../lib/db/schema.ts");
const { eq, and, gte } = await import("drizzle-orm");
const { normalizeGuestName } = await import("../lib/ingest/normalize.ts");

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);

const rows = await db
  .select({
    value: episodeEntities.value,
    normalizedValue: episodeEntities.normalizedValue,
    showId: shows.id,
    showName: shows.name,
    episodeId: episodes.id,
    episodeTitle: episodes.title,
    episodeUrl: episodes.url,
    publishedAt: episodes.publishedAt,
  })
  .from(episodeEntities)
  .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
  .innerJoin(shows, eq(episodes.showId, shows.id))
  .where(and(eq(episodeEntities.type, "guest"), gte(episodes.publishedAt, sixMonthsAgo)))
  .orderBy(episodeEntities.normalizedValue, episodes.publishedAt);

console.log(`Total guest-entity rows in trailing 6 months: ${rows.length}\n`);

// Re-derive normalization live (don't trust the stored column) to catch any drift
// between what's in the DB and what normalizeGuestName() would produce today.
const mismatches = rows.filter((r) => normalizeGuestName(r.value) !== r.normalizedValue);
console.log(`Rows where live normalizeGuestName() differs from stored normalizedValue: ${mismatches.length}`);
for (const m of mismatches) {
  console.log(`  "${m.value}" -> stored="${m.normalizedValue}" live="${normalizeGuestName(m.value)}"`);
}

const groups = new Map();
for (const r of rows) {
  const key = r.normalizedValue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

console.log(`\nDistinct normalized guests: ${groups.size}\n`);
console.log("=== Full guest list, grouped by normalized identity ===");
const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
  const showsA = new Set(a[1].map((r) => r.showId)).size;
  const showsB = new Set(b[1].map((r) => r.showId)).size;
  return showsB - showsA;
});

for (const [key, items] of sortedGroups) {
  const showIds = new Set(items.map((r) => r.showId));
  const rawValues = new Set(items.map((r) => r.value));
  console.log(
    `\n[${key}] — ${showIds.size} distinct show(s), ${items.length} appearance(s) — raw forms seen: ${Array.from(rawValues).join(" | ")}`
  );
  for (const i of items) {
    console.log(`    - ${i.showName} :: "${i.episodeTitle}" (${i.publishedAt.toISOString().slice(0, 10)}) ${i.episodeUrl}`);
  }
}

const twoPlusShows = sortedGroups.filter(([, items]) => new Set(items.map((r) => r.showId)).size >= 2);
console.log(`\n=== VERDICT ===`);
console.log(`Guests appearing on 2+ distinct shows in trailing 6 months: ${twoPlusShows.length}`);
for (const [key, items] of twoPlusShows) {
  console.log(`  "${key}" on shows: ${Array.from(new Set(items.map((r) => r.showName))).join(", ")}`);
}

// Near-miss detection: for guests appearing on exactly 1 show, check if any other
// single-show guest has a normalized name within edit-distance 2 (catches typos,
// transliteration variants, or missed honorific/suffix stripping that normalization missed).
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

const singleShowKeys = sortedGroups
  .filter(([, items]) => new Set(items.map((r) => r.showId)).size === 1)
  .map(([key, items]) => ({ key, showName: items[0].showName }));

console.log(`\n=== Near-miss scan (single-show guests, edit distance <= 2, different shows) ===`);
let nearMisses = 0;
for (let i = 0; i < singleShowKeys.length; i++) {
  for (let j = i + 1; j < singleShowKeys.length; j++) {
    const a = singleShowKeys[i];
    const b = singleShowKeys[j];
    if (a.showName === b.showName) continue;
    const dist = levenshtein(a.key, b.key);
    if (dist <= 2 && a.key.length > 4 && b.key.length > 4) {
      nearMisses++;
      console.log(`  "${a.key}" (${a.showName}) <-> "${b.key}" (${b.showName}) — edit distance ${dist}`);
    }
  }
}
if (nearMisses === 0) console.log("  none found");

process.exit(0);
