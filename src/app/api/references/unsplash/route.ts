import { NextResponse } from "next/server";
import { z } from "zod";

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

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return jsonError("Missing UNSPLASH_ACCESS_KEY", 500);
  }

  const perPage = body.perPage ?? 18;
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", body.query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "portrait");

  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Client-ID ${key}`,
      "accept-version": "v1"
    }
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return jsonError(`Unsplash error (${res.status}): ${t.slice(0, 400)}`, 502);
  }

  const data = (await res.json()) as {
    results?: Array<{
      id?: string;
      links?: { html?: string };
      urls?: { small?: string; regular?: string };
      user?: { name?: string; links?: { html?: string } };
    }>;
  };

  const items =
    (data.results ?? [])
      .map((r) => {
        const id = r.id;
        const thumb = r.urls?.small;
        const full = r.urls?.regular;
        if (!id || !thumb || !full) return null;
        return {
          id,
          kind: "unsplash" as const,
          thumb,
          full,
          author: r.user?.name ?? undefined,
          sourceUrl: r.links?.html ?? r.user?.links?.html ?? undefined
        };
      })
      .filter(Boolean) ?? [];

  return NextResponse.json({ items });
}

