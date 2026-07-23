// "On this day" curiosities from Wikipedia's free feed API (no key).

export const revalidate = 3600; // the content only changes daily

type WikiPage = { content_urls?: { desktop?: { page?: string } } };
type WikiEvent = { year?: number; text?: string; pages?: WikiPage[] };

function trim(text: string): string {
  const clean = text.replace(/\s*\(pictured\)/g, "").trim();
  return clean.length > 145 ? clean.slice(0, 142).trimEnd() + "…" : clean;
}

export async function GET() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`,
      { next: { revalidate }, headers: { "user-agent": "the-lab/1.0 (personal dashboard)" } }
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();

    const items = ((data.selected ?? []) as WikiEvent[])
      .filter((e) => e.year && e.text)
      .slice(0, 9)
      .map((e) => ({
        year: e.year,
        text: trim(e.text as string),
        link: e.pages?.[0]?.content_urls?.desktop?.page ?? null,
      }));

    return Response.json({ items });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
