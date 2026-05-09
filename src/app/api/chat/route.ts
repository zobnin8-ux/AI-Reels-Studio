import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDialogueSystemPrompt } from "@/lib/dialogue-context";
import { sessionImagePromptSchema } from "@/lib/chat-response";
import { parseModelChatOutput } from "@/lib/chat-response-parse";

/** Vercel / совместимые хосты; на Render при 502 также поднимите таймаут сервиса в панели. */
export const maxDuration = 300;

const selectorsSchema = z.object({
  project: z.enum(["poslenego", "zobnin", "olgatrip"]),
  contentType: z.enum(["reels", "post"]),
  slideCount: z.union([z.literal(5), z.literal(7), z.literal(9)]),
  ctaMode: z.enum(["website", "direct", "none", "custom"]),
  website: z.string(),
  triggerWord: z.string(),
  customCta: z.string()
});

const sessionSchema = z.object({
  topic: z.string(),
  selectedAngleId: z.string().nullable(),
  angles: z.array(z.object({ id: z.string(), label: z.string() })),
  slides: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })),
  approved: z.boolean(),
  imagePrompts: z.array(sessionImagePromptSchema),
  caption: z.string(),
  music: z.object({
    queries: z.array(z.string()),
    recommendations: z.array(z.string()),
    avoid: z.array(z.string())
  })
});

const chatRequestSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })
  ),
  selectors: selectorsSchema,
  session: sessionSchema
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function mockEnabled() {
  return process.env.AI_MOCK_MODE === "1";
}

function openAIMessages(
  system: string,
  msgs: { role: "user" | "assistant"; content: string }[]
) {
  return [
    { role: "system" as const, content: system },
    ...msgs.map((m) => ({ role: m.role, content: m.content }))
  ];
}

async function callOpenAIChat(
  system: string,
  msgs: { role: "user" | "assistant"; content: string }[]
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: openAIMessages(system, msgs),
      temperature: 0.65,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI chat error (${res.status}): ${t}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenAI: empty reply");
  return text.trim();
}

async function callAnthropicChat(
  system: string,
  msgs: { role: "user" | "assistant"; content: string }[]
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const anthropicMessages = msgs.map((m) => ({
    role: m.role,
    content: m.content
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 16384,
      system,
      messages: anthropicMessages
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic chat error (${res.status}): ${t}`);
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = (data.content ?? []).map((c) => (c as { text?: string }).text ?? "").join("");
  if (!text.trim()) throw new Error("Anthropic: empty reply");
  return text.trim();
}

export async function POST(request: Request) {
  let body: z.infer<typeof chatRequestSchema>;
  try {
    body = chatRequestSchema.parse(await request.json());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return jsonError(msg, 400);
  }

  try {
    if (mockEnabled()) {
      const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
      const text = lastUser?.content?.slice(0, 120) ?? "";
      return NextResponse.json({
        reply: `[MOCK] Принято: «${text}». В реальном режиме модель вернёт JSON с reply и statePatch.`,
        statePatch: {},
        chatParse: { mode: "ok" as const, warnings: [] as string[] }
      });
    }

    const system = buildDialogueSystemPrompt(body.selectors, body.session);
    const raw =
      body.provider === "openai"
        ? await callOpenAIChat(system, body.messages)
        : await callAnthropicChat(system, body.messages);

    const parsed = parseModelChatOutput(raw);
    return NextResponse.json({
      reply: parsed.reply,
      statePatch: parsed.statePatch,
      chatParse: { mode: parsed.parseMode, warnings: parsed.warnings }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Chat error";
    return jsonError(msg, 500);
  }
}
