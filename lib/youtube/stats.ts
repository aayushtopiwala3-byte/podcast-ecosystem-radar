const YT_API_KEY = process.env.YOUTUBE_API_KEY!;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchViewCounts(videoIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (videoIds.length === 0) return result;

  for (const batch of chunk(videoIds, 50)) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(
      ","
    )}&key=${YT_API_KEY}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) {
        console.error(`YouTube stats API error: ${json.error.message}`);
        continue;
      }
      for (const item of json.items ?? []) {
        const count = Number(item.statistics?.viewCount);
        if (Number.isFinite(count)) result[item.id] = count;
      }
    } catch (err) {
      console.error("fetchViewCounts batch failed:", err);
    }
  }

  return result;
}

export function extractVideoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}
