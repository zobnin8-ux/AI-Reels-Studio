import { NextResponse } from "next/server";
import { z } from "zod";

const reqSchema = z.object({
  prompt: z.string().min(1),
  aspect: z.enum(["9:16", "1:1"]),
  stylePreset: z.string().optional()
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function mockEnabled() {
  return process.env.AI_MOCK_MODE === "1";
}

async function generateWithOpenAI(prompt: string, aspect: "9:16" | "1:1") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const size = aspect === "9:16" ? "1024x1792" : "1024x1024";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      size
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI image error (${res.status}): ${t}`);
  }
  const data = (await res.json()) as any;
  const first = data?.data?.[0] ?? {};
  const b64 = first?.b64_json;
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
  } catch (e: any) {
    return jsonError(e?.message ?? "Invalid request", 400);
  }

  try {
    if (mockEnabled()) {
      return NextResponse.json({
        mimeType: "image/png",
        imageBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFhQJ/lb0u9QAAAABJRU5ErkJggg=="
      });
    }

    const out = await generateWithOpenAI(body.prompt, body.aspect);
    return NextResponse.json(out);
  } catch (e: any) {
    return jsonError(e?.message ?? "Image error", 500);
  }
}

