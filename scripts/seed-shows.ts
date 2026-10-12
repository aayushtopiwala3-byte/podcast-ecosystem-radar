import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";

type SeedShow = {
  name: string;
  slug: string;
  platform: "youtube" | "rss";
  youtubeHandle?: string;
  searchQuery?: string;
  rssUrl?: string;
};

const SEED_SHOWS: SeedShow[] = [
  { name: "Figuring Out (Raj Shamani)", slug: "figuring-out-raj-shamani", platform: "youtube", youtubeHandle: "@RajShamani" },
  { name: "Founder Thesis (Akshay Datt)", slug: "founder-thesis", platform: "youtube", youtubeHandle: "@founderthesis" },
  { name: "The Neon Show (Siddhartha Ahluwalia)", slug: "the-neon-show", platform: "youtube", searchQuery: "The Neon Show Siddhartha Ahluwalia" },
  { name: "Finance With Sharan", slug: "finance-with-sharan", platform: "youtube", youtubeHandle: "@financewithsharan" },
  { name: "The Prakhar Gupta Xperience", slug: "prakhar-gupta-xperience", platform: "youtube", youtubeHandle: "@ThePrakharGuptaXperience" },
  { name: "The Innovators and Disruptors Podcast", slug: "innovators-and-disruptors", platform: "youtube", youtubeHandle: "@TheInnovatorsandDisruptorsPodc" },
  { name: "Nikhil Kamath (WTF is...)", slug: "nikhil-kamath-wtf", platform: "youtube", searchQuery: "Nikhil Kamath WTF" },
  { name: "Varun Mayya", slug: "varun-mayya", platform: "youtube", youtubeHandle: "@VarunMayya" },
  { name: "The Ranveer Show (BeerBiceps)", slug: "the-ranveer-show", platform: "youtube", youtubeHandle: "@BeerBiceps" },
  { name: "GrowthX Podcast", slug: "growthx-podcast", platform: "youtube", searchQuery: "GrowthX Podcast" },
];

const YT_API_KEY = process.env.YOUTUBE_API_KEY!;

async function resolveChannelIdByHandle(handle: string): Promise<string | null> {
  const cleanHandle = handle.replace(/^@/, "");
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(
    cleanHandle
  )}&key=${YT_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.items && json.items.length > 0) {
    return json.items[0].id;
  }
  return null;
}

async function resolveChannelIdBySearch(query: string): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
    query
  )}&key=${YT_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.items && json.items.length > 0) {
    return json.items[0].snippet.channelId || json.items[0].id.channelId;
  }
  return null;
}

async function main() {
  const { db } = await import("../lib/db");
  const { shows } = await import("../lib/db/schema");
  console.log("Seeding shows...\n");
  const results: { name: string; status: string; detail: string }[] = [];

  for (const show of SEED_SHOWS) {
    const existing = await db.select().from(shows).where(eq(shows.slug, show.slug));
    if (existing.length > 0) {
      console.log(`SKIP (already exists): ${show.name}`);
      results.push({ name: show.name, status: "skipped", detail: "already in DB" });
      continue;
    }

    let channelId: string | null = null;
    let detail = "";

    try {
      if (show.youtubeHandle) {
        channelId = await resolveChannelIdByHandle(show.youtubeHandle);
        if (!channelId) {
          // fallback to search by show name
          channelId = await resolveChannelIdBySearch(show.name);
          detail = channelId
            ? `handle ${show.youtubeHandle} failed, resolved via search`
            : `handle ${show.youtubeHandle} failed, search also failed`;
        } else {
          detail = `resolved via handle ${show.youtubeHandle}`;
        }
      } else if (show.searchQuery) {
        channelId = await resolveChannelIdBySearch(show.searchQuery);
        detail = channelId ? `resolved via search "${show.searchQuery}"` : `search "${show.searchQuery}" failed`;
      }
    } catch (err: any) {
      detail = `error: ${err.message}`;
    }

    const active = !!channelId;

    await db.insert(shows).values({
      name: show.name,
      slug: show.slug,
      platform: show.platform,
      youtubeChannelId: channelId,
      youtubeHandle: show.youtubeHandle ?? null,
      rssUrl: show.rssUrl ?? null,
      active,
    });

    console.log(`${active ? "OK" : "FAILED"}: ${show.name} -> ${detail}`);
    results.push({ name: show.name, status: active ? "active" : "inactive (needs manual fix)", detail });
  }

  console.log("\n=== Seed summary ===");
  for (const r of results) {
    console.log(`- ${r.name}: ${r.status} (${r.detail})`);
  }
  console.log("\nAny 'inactive' shows need their channel ID fixed manually via the Admin UI.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
