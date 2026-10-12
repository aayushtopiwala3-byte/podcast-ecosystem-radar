import Parser from "rss-parser";

export type FetchedRssItem = {
  title: string;
  link: string;
  publishedAt: string;
  description: string;
};

const parser = new Parser();

export async function fetchRecentRssItems(
  rssUrl: string,
  sinceDate: Date
): Promise<FetchedRssItem[]> {
  const feed = await parser.parseURL(rssUrl);
  const items = feed.items ?? [];

  return items
    .filter((item) => {
      const pubDate = item.isoDate ? new Date(item.isoDate) : null;
      return pubDate && pubDate > sinceDate;
    })
    .map((item) => ({
      title: item.title ?? "Untitled episode",
      link: item.link ?? "",
      publishedAt: item.isoDate ?? new Date().toISOString(),
      description: item.contentSnippet ?? item.content ?? "",
    }));
}
