import { NextResponse } from "next/server";
import { z } from "zod";
import { keywordsForStockPhotoSearch } from "@/lib/stock-photo-query";

const reqSchema = z.object({
  query: z.string().trim().min(2).max(80),
  perPage: z.number().int().min(6).max(30).optional()
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: z.infer<typeof reqSchema>;
  try {
    body = reqSchema.parse(await request.json());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return jsonError(msg, 400);
  }

  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    return jsonError("Missing PEXELS_API_KEY", 500);
  }

  const perPage = body.perPage ?? 18;
  const searchQuery = await keywordsForStockPhotoSearch(body.query);
  if (searchQuery.length < 2) {
    return jsonError("Query too short after normalization", 400);
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", searchQuery);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "portrait");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: key
    }
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return jsonError(`Pexels error (${res.status}): ${t.slice(0, 400)}`, 502);
  }

  const data = (await res.json()) as {
    photos?: Array<{
      id?: number;
      url?: string;
      photographer?: string;
      src?: { small?: string; large2x?: string; large?: string };
    }>;
  };

  const items =
    (data.photos ?? [])
      .map((p) => {
        const id = p.id ? String(p.id) : null;
        const thumb = p.src?.small;
        const full = p.src?.large2x ?? p.src?.large;
        if (!id || !thumb || !full) return null;
        return {
          id,
          kind: "unsplash" as const, // reuse UI shape; provenance is in sourceUrl/author
          thumb,
          full,
          author: p.photographer ?? undefined,
          sourceUrl: p.url ?? undefined
        };
      })
      .filter(Boolean) ?? [];

  return NextResponse.json({ items, queryUsed: searchQuery });
}

