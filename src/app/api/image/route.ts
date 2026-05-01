import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";

/** Instagram feed portrait (4:5) — целевой размер после генерации */
const INSTAGRAM_POST_PX = { w: 1080, h: 1350 } as const;

const reqSchema = z.object({
  prompt: z.string().min(1),
  aspect: z.enum(["9:16", "4:5"]),
  stylePreset: z.string().optional()
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function mockEnabled() {
  return process.env.AI_MOCK_MODE === "1";
}

async function resizeToInstagramPostPng(imageBase64: string): Promise<{ imageBase64: string; mimeType: string }> {
  const buf = Buffer.from(imageBase64, "base64");
  const out = await sharp(buf)
    .resize(INSTAGRAM_POST_PX.w, INSTAGRAM_POST_PX.h, {
      fit: "cover",
      position: "centre"
    })
    .png()
    .toBuffer();
  return { imageBase64: out.toString("base64"), mimeType: "image/png" };
}

async function generateWithOpenAI(prompt: string, aspect: "9:16" | "4:5") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  // Доступные пресеты API; для поста 4:5 берём портрет 1024×1536 и затем приводим к 1080×1350.
  const size = aspect === "9:16" ? "1024x1536" : "1024x1536";

  const isGptImageFamily = /^gpt-image/i.test(model);
  const qualityRaw = (process.env.OPENAI_IMAGE_QUALITY ?? "high").trim().toLowerCase();
  const skipQuality = qualityRaw === "" || qualityRaw === "skip" || qualityRaw === "off";
  const quality =
    qualityRaw === "low" || qualityRaw === "medium" || qualityRaw === "high" ? qualityRaw : "high";

  const body: Record<string, unknown> = {
    model,
    prompt,
    size
  };
  if (isGptImageFamily && !skipQuality) {
    body.quality = quality;
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI image error (${res.status}): ${t}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const first = (data?.data as Record<string, unknown>[] | undefined)?.[0] ?? {};
  const b64 = first?.b64_json as string | undefined;
  if (b64) {
    return { imageBase64: b64 as string, mimeType: "image/png" };
  }

  const url = first?.url as string | undefined;
  if (!url) throw new Error("OpenAI image: empty image payload");

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`OpenAI image URL fetch failed (${imgRes.status})`);
  const arr = new Uint8Array(await imgRes.arrayBuffer());
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]!);
  }
  const imageBase64 = btoa(binary);
  const mimeType = imgRes.headers.get("content-type") || "image/png";
  return { imageBase64, mimeType };
}

export async function POST(request: Request) {
  let body: z.infer<typeof reqSchema>;
  try {
    body = reqSchema.parse(await request.json());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return jsonError(msg, 400);
  }

  try {
    if (mockEnabled()) {
      const tiny =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFhQJ/lb0u9QAAAABJRU5ErkJggg==";
      const out =
        body.aspect === "4:5"
          ? await resizeToInstagramPostPng(tiny)
          : { imageBase64: tiny, mimeType: "image/png" };
      return NextResponse.json(out);
    }

    const raw = await generateWithOpenAI(body.prompt, body.aspect);
    if (body.aspect === "4:5") {
      return NextResponse.json(await resizeToInstagramPostPng(raw.imageBase64));
    }
    return NextResponse.json(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Image error";
    return jsonError(msg, 500);
  }
}
