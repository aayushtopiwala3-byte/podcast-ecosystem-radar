import { YoutubeTranscript } from "youtube-transcript";

export type FetchedVideo = {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  url: string;
};

const YT_API_KEY = process.env.YOUTUBE_API_KEY!;

export async function fetchRecentVideos(
  channelId: string,
  sinceISO: string
): Promise<FetchedVideo[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=15&type=video&publishedAfter=${encodeURIComponent(
    sinceISO
  )}&key=${YT_API_KEY}`;

  const res = await fetch(url);
  const json = await res.json();

  if (json.error) {
    throw new Error(`YouTube API error: ${json.error.message}`);
  }

  const items = json.items ?? [];
  return items.map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description ?? "",
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

export async function fetchTranscriptText(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    const text = segments.map((s) => s.text).join(" ").trim();
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}
