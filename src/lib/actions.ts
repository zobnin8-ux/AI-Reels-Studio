"use client";

import type { ChatMessage, GeneratedImage, StudioState } from "@/lib/state";
import type { StatePatch } from "@/lib/chat-response";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function aspectFromContentType(contentType: StudioState["contentType"]) {
  return contentType === "reels" ? ("9:16" as const) : ("1:1" as const);
}

/** Есть ли кириллица — усиливаем инструкции для текста на изображении. */
function textHasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

function typographyForStyle(style: StudioState["visualStyle"]) {
  switch (style) {
    case "tech":
      return "Typography: Inter/SF Pro/Helvetica Neue, semi-bold headings, tight tracking, clean grid, generous margins.";
    case "editorial":
      return "Typography: Modern editorial — Inter or Helvetica for body + optional restrained serif for 1-2 words max; high contrast, clean margins.";
    case "darkBrutal":
      return "Typography: Condensed bold sans (Inter Tight/Helvetica Condensed feel), big sizes, brutal contrast, minimal words.";
    case "lightMinimal":
      return "Typography: Minimal sans (Inter/SF Pro), light/regular weights, lots of whitespace, subtle hierarchy.";
    case "brightPositive":
      return "Typography: Bright, high-legibility sans (Inter/SF Pro). Bold headings, clear hierarchy, generous spacing. Use high-contrast text blocks or translucent pills; avoid tiny fonts.";
    case "portraLifestyle":
      return "Typography: Neutral modern sans (Inter/SF Pro), soft hierarchy, avoid heavy decorative fonts.";
  }
}

function enrichPromptForGeneration(state: StudioState, slideText: string, basePrompt: string) {
  const cleaned = sanitizePromptText(basePrompt);
  const needsText = state.outputMode === "textInImages" || state.outputMode === "both";
  const lines: string[] = [];
  lines.push(cleaned);
  lines.push(`Visual style preset: ${state.visualStyle}. Mood: ${state.mood}.`);
  if (needsText) {
    const onImage = slideText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(" / ");
    const cyrillic = textHasCyrillic(onImage) || textHasCyrillic(cleaned);
    lines.push("On-image text required. Make the text fully readable, not warped, not tiny.");
    lines.push(typographyForStyle(state.visualStyle));
    lines.push(`On-image text (exact): ${onImage}`);
    if (cyrillic) {
      lines.push(
        "CRITICAL — Russian Cyrillic on-image text: render using proper Cyrillic Unicode letters (Russian alphabet), not Latin lookalikes or gibberish. " +
          "Use a clean sans-serif that supports Cyrillic (e.g. Inter, Manrope, PT Sans, Montserrat feel). " +
          "Large font size, high contrast, straight baseline, no mirrored or melted glyphs. " +
          "Do not transliterate Russian to Latin unless the exact line above is Latin."
      );
    }
    lines.push("Place text within safe margins; no logos; no watermarks.");
  } else {
    lines.push("No text overlay on image (unless user explicitly asks).");
  }
  return lines.filter(Boolean).join("\n");
}

function sanitizePromptText(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return s;

  // Частая форма от модели: {"prompt":"..."} или вложенный JSON с полем prompt.
  const inlinePrompt = s.match(/"prompt"\s*:\s*"([\s\S]*?)"/i) ?? s.match(/prompt\s*:\s*([\s\S]*)$/i);
  if (inlinePrompt?.[1]) s = inlinePrompt[1].trim();

  const jsonLike = s.match(/^\{\s*"?prompt"?\s*:\s*([\s\S]*?)\s*\}$/i);
  if (jsonLike?.[1]) s = jsonLike[1].trim();

  // Удаляем markdown fenced blocks
  const fenced = s.match(/```(?:[\w-]*)?\s*\n([\s\S]*?)```/);
  if (fenced?.[1]) {
    s = fenced[1].trim();
  }

  // Если осталась метка prompt:
  s = s.replace(/^\s*(prompt|промпт)\s*[:\-]\s*/i, "");
  s = s.replace(/^\s*[{[]\s*|[\]}]\s*$/g, "");

  // Снимаем внешние кавычки/апострофы/бэктики
  s = s.replace(/^[`"'«»\s]+|[`"'«»\s]+$/g, "");

  // Нормализуем экранированные переводы строк от JSON
  s = s.replace(/\\n/g, "\n").replace(/\\"/g, "\"");
  s = s.replace(/\s*[,;]\s*$/g, "");

  // Если модель отдала мини-объект/массив в одной строке, пытаемся достать самое длинное значение в кавычках.
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    const quoted = [...s.matchAll(/"([^"]{12,})"/g)].map((m) => m[1]!.trim());
    if (quoted.length > 0) {
      s = quoted.sort((a, b) => b.length - a.length)[0]!;
    }
  }

  // Удаляем служебные префиксы вида "1) { ... }"
  s = s.replace(/^\s*\d+[.)]\s*/, "");
  s = s.replace(/^\s*[-*]\s*/, "");

  return s.trim();
}

export function buildSelectorsPayload(
  state: StudioState
): Pick<
  StudioState,
  | "project"
  | "customSystemPrompt"
  | "contentType"
  | "slideCount"
  | "mood"
  | "visualStyle"
  | "outputMode"
  | "ctaMode"
  | "website"
  | "triggerWord"
  | "customCta"
> {
  return {
    project: state.project,
    customSystemPrompt: state.customSystemPrompt,
    contentType: state.contentType,
    slideCount: state.slideCount,
    mood: state.mood,
    visualStyle: state.visualStyle,
    outputMode: state.outputMode,
    ctaMode: state.ctaMode,
    website: state.website,
    triggerWord: state.triggerWord,
    customCta: state.customCta
  };
}

export function buildSessionPayload(
  state: StudioState
): Pick<
  StudioState,
  "topic" | "selectedAngleId" | "angles" | "slides" | "approved" | "prompts" | "caption" | "music"
> {
  return {
    topic: state.topic,
    selectedAngleId: state.selectedAngleId,
    angles: state.angles,
    slides: state.slides,
    approved: state.approved,
    prompts: state.prompts,
    caption: state.caption,
    music: state.music
  };
}

export function mergeStatePatch(state: StudioState, patch: StatePatch | undefined): Partial<StudioState> {
  if (!patch) return {};
  const out: Partial<StudioState> = {};
  if (patch.topic !== undefined) out.topic = patch.topic;
  if (patch.angles !== undefined) out.angles = patch.angles;
  if (patch.selectedAngleId !== undefined) out.selectedAngleId = patch.selectedAngleId;
  if (patch.slides !== undefined) out.slides = patch.slides;
  if (patch.approved !== undefined) out.approved = patch.approved;
  if (patch.prompts !== undefined) {
    out.prompts = patch.prompts.map((p) => ({
      slideId: p.slideId,
      prompt: sanitizePromptText(p.prompt)
    }));
  }
  if (patch.caption !== undefined) out.caption = patch.caption;
  if (patch.music !== undefined) out.music = patch.music;

  // Если сценарий изменился, а промпты не обновлялись в этом же ходе —
  // считаем промпты/картинки устаревшими и сбрасываем их, чтобы не было рассинхрона.
  if (patch.slides !== undefined && patch.prompts === undefined) {
    out.prompts = [];
    out.images = [];
  }
  return out;
}

/** Один ход диалога: сервер всегда получает селекторы + сессию + историю; ответ — reply + statePatch. */
export async function sendDialogueTurn(
  state: StudioState,
  userText: string,
  historyForApi: Pick<ChatMessage, "role" | "content">[]
): Promise<{ reply: string; statePatch?: StatePatch }> {
  const trimmed = userText.trim();
  if (!trimmed) throw new Error("Пустое сообщение");

  const messages = [...historyForApi, { role: "user" as const, content: trimmed }];

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: state.provider,
      messages,
      selectors: buildSelectorsPayload(state),
      session: buildSessionPayload(state)
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Chat failed (${res.status})`);
  }

  return (await res.json()) as { reply: string; statePatch?: StatePatch };
}

/** Генерация картинок только по кнопке; использует текущие prompts[] и порядок слайдов. Не вызывает диалог. */
export async function generateImagesFromState(state: StudioState): Promise<GeneratedImage[]> {
  const out: GeneratedImage[] = [];

  if (state.slides.length > 0) {
    for (let i = 0; i < state.slides.length; i++) {
      const slide = state.slides[i]!;
      const row = state.prompts.find((p) => p.slideId === slide.id);
      const prompt = row?.prompt?.trim() ?? "";
      const id = `img_${slide.id}`;
      if (!prompt) {
        out.push({
          id,
          slideId: slide.id,
          prompt: "",
          status: "error",
          error: "Нет промпта для этого слайда — запроси промпты в диалоге или вставь вручную справа."
        });
        continue;
      }
      try {
        const finalPrompt = enrichPromptForGeneration(state, `${slide.title}\n${slide.text}`, prompt);
        out.push({ id, slideId: slide.id, prompt: finalPrompt, status: "generating" });
        const img = await fetchOneImage(state, id, slide.id, finalPrompt);
        out[out.length - 1] = img;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Image error";
        out[out.length - 1] = {
          id,
          slideId: slide.id,
          prompt,
          status: "error",
          error: msg
        };
      }
    }
    return out;
  }

  for (let i = 0; i < state.prompts.length; i++) {
    const row = state.prompts[i]!;
    const prompt = row.prompt.trim();
    if (!prompt) continue;
    const id = `img_${i}`;
    try {
      out.push({ id, slideId: row.slideId, prompt, status: "generating" });
      const img = await fetchOneImage(state, id, row.slideId, prompt);
      out[out.length - 1] = img;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Image error";
      out[out.length - 1] = { id, slideId: row.slideId, prompt, status: "error", error: msg };
    }
  }

  return out;
}

async function fetchOneImage(
  state: StudioState,
  id: string,
  slideId: string,
  prompt: string
): Promise<GeneratedImage> {
  if (state.mockMode) {
    return {
      id,
      slideId,
      prompt,
      status: "done",
      mimeType: "image/png",
      imageBase64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFhQJ/lb0u9QAAAABJRU5ErkJggg=="
    };
  }

  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      aspect: aspectFromContentType(state.contentType),
      stylePreset: state.visualStyle
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { error?: string }).error;
    throw new Error(detail ?? `Image failed (${res.status})`);
  }
  const json = (await res.json()) as { imageBase64: string; mimeType: string };
  return { id, slideId, prompt, status: "done", imageBase64: json.imageBase64, mimeType: json.mimeType };
}

export async function regenerateOneImage(
  state: StudioState,
  imageId: string,
  slideId: string | undefined,
  prompt: string
): Promise<GeneratedImage> {
  return fetchOneImage(state, imageId, slideId ?? "", prompt);
}

function formatMusicNotesForZip(music: StudioState["music"]): string {
  const blocks: string[] = [];
  blocks.push("Поисковые запросы / keywords");
  blocks.push(
    music.queries.length ? music.queries.map((q) => `• ${q}`).join("\n") : "(пока нет — запросите подбор в диалоге или внесите строки справа)"
  );
  blocks.push("");
  blocks.push("Направление / рекомендации настроения");
  blocks.push(
    music.recommendations.length
      ? music.recommendations.map((r) => `• ${r}`).join("\n")
      : "(пока нет)"
  );
  blocks.push("");
  blocks.push("Избегать");
  blocks.push(music.avoid.length ? music.avoid.map((a) => `• ${a}`).join("\n") : "(не указано)");
  return blocks.join("\n");
}

export async function downloadZip(state: StudioState) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const scenarioText = state.slides
    .map((s, i) => `## ${i + 1}. ${s.title}\n\n${s.text}`)
    .join("\n\n---\n\n");
  zip.file("scenario.txt", scenarioText || "");

  const promptLines = state.slides.length
    ? state.slides.map((s, i) => {
        const p = state.prompts.find((x) => x.slideId === s.id)?.prompt ?? "";
        return `${String(i + 1).padStart(2, "0")}. ${p}`;
      })
    : state.prompts.map((x, i) => `${String(i + 1).padStart(2, "0")}. ${x.prompt}`);
  zip.file("prompts.txt", promptLines.join("\n\n"));

  zip.file("caption.txt", state.caption || "");

  const musicNotes = formatMusicNotesForZip(state.music);
  zip.file("music_notes.txt", musicNotes);

  const imagesFolder = zip.folder("images");
  if (imagesFolder) {
    state.images.forEach((img, idx) => {
      if (!img.imageBase64 || img.status !== "done") return;
      const ext = (img.mimeType ?? "image/png").includes("jpeg") ? "jpg" : "png";
      imagesFolder.file(`${String(idx + 1).padStart(2, "0")}.${ext}`, img.imageBase64, {
        base64: true
      });
    });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ai-reels-studio-export.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
