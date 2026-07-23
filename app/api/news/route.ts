import Parser from "rss-parser";

// News endpoint. Free RSS feeds, merged newest-first. Provider-agnostic output
// ({ title, source, link }) so sources can be added or swapped freely here
// without touching the UI. Half entertainment (books/film), half Pittsburgh.

export const revalidate = 900; // refresh at most every 15 min

const FEEDS: { url: string; source: string }[] = [
  { url: "https://feeds.npr.org/1032/rss.xml", source: "NPR Books" },
  { url: "https://www.theguardian.com/books/rss", source: "Guardian Books" },
  { url: "https://www.theguardian.com/film/rss", source: "Guardian Film" },
  { url: "https://variety.com/v/film/feed/", source: "Variety" },
  { url: "https://www.post-gazette.com/rss", source: "Post-Gazette" },
  { url: "https://triblive.com/feed/", source: "TribLive" },
  { url: "https://nextpittsburgh.com/feed/", source: "NEXTpittsburgh" },
  { url: "https://www.publicsource.org/feed/", source: "PublicSource" },
];

const PER_SOURCE = 3; // cap per outlet so none floods the feed
const TOTAL = 20; // extra headroom so client-side filtering/ranking still fills the tile

const parser = new Parser({ timeout: 10000 });

type Item = { title: string; source: string; link: string; ts: number };

export async function GET() {
  const settled = await Promise.allSettled(
    FEEDS.map(async (f): Promise<Item[]> => {
      const res = await fetch(f.url, {
        next: { revalidate },
        headers: { "user-agent": "Mozilla/5.0 the-lab" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`${f.source} ${res.status}`);
      const feed = await parser.parseString(await res.text());
      return (feed.items ?? []).slice(0, PER_SOURCE).map((i) => ({
        title: (i.title ?? "").trim(),
        source: f.source,
        link: i.link ?? "",
        ts: i.isoDate ? Date.parse(i.isoDate) : i.pubDate ? Date.parse(i.pubDate) : 0,
      }));
    })
  );

  const seen = new Set<string>();
  const items = settled
    .flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    .filter((i) => i.title && i.link && !seen.has(i.title) && seen.add(i.title))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, TOTAL)
    .map(({ title, source, link }) => ({ title, source, link }));

  return Response.json({ items });
}
