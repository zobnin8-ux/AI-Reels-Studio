import { z } from "zod";
import { MAX_ANGLES, normalizeAnglesList } from "@/lib/angle-normalize";
import { sanitizeModelReplyForDisplay } from "@/lib/chat-reply-format";
import {
  angleSchema,
  chatApiResponseSchema,
  musicOutputSchema,
  slideSchema,
  type StatePatch
} from "@/lib/chat-response";
import { extractJsonObjectFromModelText, extractReplyTextFromRawModelOutput } from "@/lib/chat-model-json";

export type ChatParseMode = "ok" | "partial" | "reply_only";

export type ChatParseMeta = {
  mode: ChatParseMode;
  warnings: string[];
};

const lenientImagePrompt = z.object({
  slideId: z.string().min(1),
  prompt: z.string().min(1)
});

function coerceStatePatch(raw: unknown, warnings: string[]): StatePatch {
  const out: StatePatch = {};
  if (raw === null || raw === undefined) return out;

  let sp: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      sp = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      warnings.push("statePatch был строкой, но не JSON — патч сценария пропущен.");
      return out;
    }
  } else if (typeof raw === "object") {
    sp = raw as Record<string, unknown>;
  } else {
    warnings.push("statePatch не объект — патч сценария пропущен.");
    return out;
  }

  if (typeof sp.topic === "string") out.topic = sp.topic;

  if (sp.selectedAngleId !== undefined) {
    if (sp.selectedAngleId === null || typeof sp.selectedAngleId === "string") {
      out.selectedAngleId = sp.selectedAngleId;
    } else {
      warnings.push("selectedAngleId имел неверный тип — поле пропущено.");
    }
  }

  if (sp.approved !== undefined) {
    if (typeof sp.approved === "boolean") out.approved = sp.approved;
    else warnings.push("approved имел неверный тип — поле пропущено.");
  }

  if (Array.isArray(sp.angles)) {
    const parsed = z.array(angleSchema).safeParse(sp.angles);
    if (parsed.success) {
      out.angles = normalizeAnglesList(parsed.data.slice(0, MAX_ANGLES));
    } else {
      warnings.push(`Углы не применены: ${parsed.error.message}`);
    }
  }

  if (Array.isArray(sp.slides)) {
    const parsed = z.array(slideSchema).safeParse(sp.slides);
    if (parsed.success) {
      out.slides = parsed.data;
    } else {
      warnings.push(`Слайды не применены: ${parsed.error.message}`);
    }
  }

  if (Array.isArray(sp.imagePrompts)) {
    const good: { slideId: string; prompt: string }[] = [];
    for (let i = 0; i < sp.imagePrompts.length; i++) {
      const p = lenientImagePrompt.safeParse(sp.imagePrompts[i]);
      if (!p.success) {
        warnings.push(`Промпт картинки #${i + 1} пропущен (неверная форма).`);
        continue;
      }
      if (p.data.prompt.length < 50) {
        const sid =
          p.data.slideId.length > 16 ? `${p.data.slideId.slice(0, 16)}…` : p.data.slideId;
        warnings.push(
          `Промпт для слайда «${sid}» слишком короткий (${p.data.prompt.length} сим.) — нужно ≥50, пропущен.`
        );
        continue;
      }
      good.push(p.data);
    }
    if (good.length > 0) {
      out.imagePrompts = good;
    }
  }

  if (sp.caption !== undefined) {
    if (typeof sp.caption === "string") out.caption = sp.caption;
    else warnings.push("caption имел неверный тип — поле пропущено.");
  }

  if (sp.music !== undefined) {
    const parsed = musicOutputSchema.safeParse(sp.music);
    if (parsed.success) {
      out.music = parsed.data;
    } else {
      warnings.push(`Музыка не применена: ${parsed.error.message}`);
    }
  }

  return out;
}

function replyFromExtracted(obj: Record<string, unknown>, raw: string): string {
  const replyRaw = obj.reply;
  if (typeof replyRaw === "string" && replyRaw.trim()) {
    return sanitizeModelReplyForDisplay(replyRaw);
  }
  const fallback = extractReplyTextFromRawModelOutput(raw);
  return sanitizeModelReplyForDisplay(fallback) || "";
}

export type ParsedModelChat = {
  reply: string;
  statePatch: StatePatch;
  parseMode: ChatParseMode;
  warnings: string[];
};

/**
 * Строгая схема + мягкое восстановление: один битый imagePrompt не отбрасывает весь statePatch.
 */
export function parseModelChatOutput(raw: string): ParsedModelChat {
  const warnings: string[] = [];

  let extracted: unknown;
  try {
    extracted = extractJsonObjectFromModelText(raw);
  } catch {
    const reply =
      sanitizeModelReplyForDisplay(extractReplyTextFromRawModelOutput(raw)) ||
      "Не удалось разобрать ответ модели как JSON.";
    return {
      reply,
      statePatch: {},
      parseMode: "reply_only",
      warnings: ["В ответе нет распознаваемого JSON-объекта."]
    };
  }

  const strict = chatApiResponseSchema.safeParse(extracted);
  if (strict.success) {
    return {
      reply: sanitizeModelReplyForDisplay(strict.data.reply),
      statePatch: strict.data.statePatch ?? {},
      parseMode: "ok",
      warnings: []
    };
  }

  warnings.push(`Строгая проверка схемы не прошла: ${strict.error.message}`);

  const obj = extracted as Record<string, unknown>;
  let reply = replyFromExtracted(obj, raw);
  if (!reply.trim()) {
    reply = "Модель вернула неполный JSON: текст reply извлечь не удалось.";
  }

  const patch = coerceStatePatch(obj.statePatch, warnings);
  const hasPatch = Object.keys(patch).length > 0;

  return {
    reply,
    statePatch: patch,
    parseMode: hasPatch ? "partial" : "reply_only",
    warnings
  };
}
