import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Enriches a music radar entry via Apple's free, keyless iTunes Search API:
// album art, the artist, a 30-second preview and an open-in-Apple-Music link.
// Albums win over songs; an album match borrows its first track's preview.

/* eslint-disable @typescript-eslint/no-explicit-any */

function upscale(url: string | null | undefined): string | null {
  return url ? url.replace(/100x100bb/, "512x512bb") : null;
}

async function itunes(path: string, params: string): Promise<any | null> {
  try {
    const r = await fetch(`https://itunes.apple.com/${path}?${params}`, {
      cache: "no-store",
      headers: { "User-Agent": "the-lab/1.0" },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ found: false });
  const term = encodeURIComponent(q);
  const headers = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

  const albumRes = await itunes("search", `term=${term}&media=music&entity=album&limit=3`);
  const album = albumRes?.results?.find((x: any) => x.artworkUrl100);
  if (album) {
    let preview: string | null = null;
    const tracks = await itunes("lookup", `id=${album.collectionId}&entity=song&limit=2`);
    preview = tracks?.results?.find((x: any) => x.wrapperType === "track" && x.previewUrl)?.previewUrl ?? null;
    return NextResponse.json(
      {
        found: true,
        kind: "album",
        title: album.collectionName ?? null,
        artist: album.artistName ?? null,
        artwork: upscale(album.artworkUrl100),
        preview,
        appleUrl: album.collectionViewUrl ?? null,
      },
      { headers },
    );
  }

  const songRes = await itunes("search", `term=${term}&media=music&entity=song&limit=3`);
  const song = songRes?.results?.find((x: any) => x.artworkUrl100);
  if (song) {
    return NextResponse.json(
      {
        found: true,
        kind: "song",
        title: song.trackName ?? null,
        artist: song.artistName ?? null,
        artwork: upscale(song.artworkUrl100),
        preview: song.previewUrl ?? null,
        appleUrl: song.trackViewUrl ?? null,
      },
      { headers },
    );
  }

  return NextResponse.json({ found: false }, { headers });
}
