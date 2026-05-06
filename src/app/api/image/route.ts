import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";

/** Instagram feed portrait (4:5) — целевой размер после генерации */
const INSTAGRAM_POST_PX = { w: 1080, h: 1350 } as const;
/** Instagram Reels (9:16) — целевой размер после генерации */
const INSTAGRAM_REELS_PX = { w: 1080, h: 1920 } as const;

const reqSchema = z.object({
  prompt: z.string().min(1),
  aspect: z.enum(["9:16", "4:5"]),
  stylePreset: z.string().optional()
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

class ImageRouteError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = "ImageRouteError";
  }
}

function sniffModerationTriggers(prompt: string): string[] {
  const hits: string[] = [];
  const tests: Array<{ label: string; re: RegExp }> = [
    { label: "numeric age (e.g. 42-year-old)", re: /\b\d{1,2}[- ]year[- ]old\b/i },
    { label: "double-negative emotion ('not X, just Y')", re: /\bnot\s+\w+[^.]{0,40}\bjust\s+\w+\b/i },
    { label: "scrutiny vocab", re: /\b(assessing|evaluating|scrutinizing|examining|analyzing|dissecting|judging|weighing)\b/i },
    { label: "suspicion vocab", re: /\b(skeptical|doubtful|suspicious)\b/i },
    { label: "interrogation/surveillance vocab", re: /\b(interrogat\w*|surveillance|investigating|confrontation|target|subject)\b/i },
    { label: "face/head touching gesture", re: /\b(hand on (the )?temple|rubbing (his|her|their)? ?eyes|touching (his|her|their)? ?forehead|head in hands|fingers pressed to (his|her|their)? ?face)\b/i },
    { label: "substances/violence/intimacy words", re: /\b(substances?|violence|intimacy)\b/i },
    { label: "real-person names (examples)", re: /\b(Steve Jobs|Sheryl Sandberg|Patti Smith)\b/i }
  ];
  for (const t of tests) {
    if (t.re.test(prompt)) hits.push(t.label);
  }
  return hits;
}

function mapOpenAIImageFailure(
  httpStatus: number,
  rawText: string,
  opts?: { prompt?: string; model?: string }
): ImageRouteError {
  try {
    const j = JSON.parse(rawText) as { error?: { code?: string; message?: string } };
    const code = j.error?.code;
    if (code === "moderation_blocked") {
      const model = opts?.model ? ` (model: ${opts.model})` : "";
      const triggerHits = opts?.prompt ? sniffModerationTriggers(opts.prompt) : [];
      const triggersLine = triggerHits.length ? `\n\nPossible triggers detected: ${triggerHits.join(", ")}.` : "";
      return new ImageRouteError(
        `Модерация OpenAI отклонила картинку (moderation_blocked)${model}. Переформулируйте английский промпт: опишите сцену нейтральнее и “в положительном ключе”, уберите слова подозрения/оценки рядом с экраном, конкретный возраст цифрой и жесты касания лица/головы.${triggersLine}`,
        400
      );
    }
    if (code === "content_policy_violation") {
      return new ImageRouteError(
        "Промпт нарушает политику контента OpenAI. Смягчите описание и попробуйте снова.",
        400
      );
    }
    const m = j.error?.message?.trim();
    if (m) {
      return new ImageRouteError(`OpenAI: ${m}`, httpStatus);
    }
  } catch {
    /* не JSON */
  }
  const clip = rawText.length > 900 ? `${rawText.slice(0, 900)}…` : rawText;
  return new ImageRouteError(`OpenAI image error (${httpStatus}): ${clip}`, httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500);
}

async function resizeCoverToPng(
  imageBase64: string,
  w: number,
  h: number
): Promise<{ imageBase64: string; mimeType: string }> {
  const buf = Buffer.from(imageBase64, "base64");
  const out = await sharp(buf)
    .resize(w, h, {
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
  // Доступные пресеты API: портрет 1024×1536; затем sharp приводит к 1080×1350 (пост) или 1080×1920 (Reels).
  const size = "1024x1536";

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
    throw mapOpenAIImageFailure(res.status, t, { prompt, model });
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
    const raw = await generateWithOpenAI(body.prompt, body.aspect);
    if (body.aspect === "4:5") {
      return NextResponse.json(
        await resizeCoverToPng(raw.imageBase64, INSTAGRAM_POST_PX.w, INSTAGRAM_POST_PX.h)
      );
    }
    return NextResponse.json(
      await resizeCoverToPng(raw.imageBase64, INSTAGRAM_REELS_PX.w, INSTAGRAM_REELS_PX.h)
    );
  } catch (e: unknown) {
    if (e instanceof ImageRouteError) {
      return jsonError(e.message, e.httpStatus);
    }
    const msg = e instanceof Error ? e.message : "Image error";
    return jsonError(msg, 500);
  }
}
