"use client";

import type { ChatMessage, GeneratedImage, SlidePrompt, StudioState } from "@/lib/state";
import type { StatePatch } from "@/lib/chat-response";
import { formatTypographyNotesForZip } from "@/lib/typography-export";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function aspectFromContentType(contentType: StudioState["contentType"]) {
  return contentType === "reels" ? ("9:16" as const) : ("4:5" as const);
}

/** Есть ли кириллица — усиливаем инструкции для текста на изображении. */
function textHasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

function enrichPromptForGeneration(state: StudioState, slideText: string, basePrompt: string) {
  const cleaned = sanitizePromptText(basePrompt);
  const needsText = state.outputMode === "textInImages" || state.outputMode === "both";

  function styleBlock(style: StudioState["visualStyle"]) {
    switch (style) {
      case "darkBrutal":
        return `Dark brutalist Instagram visual. Black or near-black background, aggressive contrast, minimal elements, bold dominant layout.`;

      case "tech":
        return `Futuristic tech aesthetic. Clean grid, precise alignment, subtle glow accents, sharp details.`;

      case "editorial":
        return `High-end editorial design. Minimal layout, strong typography, lots of whitespace, premium feel.`;

      case "lightMinimal":
        return `Ultra minimal light composition. Soft tones, lots of air, clean hierarchy.`;

      case "brightPositive":
        return `Bright, energetic, positive visual. Clean layout, vibrant accents, high readability.`;

      default:
        return `Clean modern Instagram visual. Balanced composition, minimal noise.`;
    }
  }

  let textBlock = "No text on image.";

  if (needsText) {
    const lines = slideText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 5);

    const joined = lines.join(" / ");
    const cyrillic = textHasCyrillic(joined) || textHasCyrillic(cleaned);

    textBlock = `
On-image text (exact):
"${joined}"

Rules:
- MUST be perfectly readable
- Large bold font
- No distortion or perspective warp
- No overlapping with background elements
`;

    if (cyrillic) {
      textBlock += `
CRITICAL:
Use correct Russian Cyrillic letters only.
No Latin substitutions.
Use clean sans-serif (Inter / Manrope style).
`;
    }
  }

  const sceneHint =
    state.contentType === "reels"
      ? "Instagram Reel slide, vertical 9:16."
      : "Instagram feed post slide, portrait 4:5 (1080×1350 px).";

  const finalPrompt = `
${cleaned}

Scene:
${sceneHint}

Style:
${styleBlock(state.visualStyle)}

Composition:
Clear visual hierarchy.
Centered or strong dominant layout.
Safe margins.
No clutter.

Lighting:
High contrast, sharp, cinematic.

Typography:
Large bold sans-serif.
High readability.
Clean baseline.

${textBlock}

Constraints:
No logos.
No watermarks.
No artifacts.
No broken faces or hands.
Clean professional layout.
`;

  return finalPrompt
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
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
    const incoming = patch.prompts.map((p) => ({
      slideId: p.slideId,
      prompt: sanitizePromptText(p.prompt)
    }));
    /**
     * Модель часто шлёт только изменённый кадр. Раньше мы затирали весь массив — правая колонка и
     * mergePromptForSlide расходились с плитками; теперь мержим по slideId.
     */
    const slidesForPromptMerge = patch.slides ?? state.slides;
    if (slidesForPromptMerge.length > 0) {
      out.prompts = slidesForPromptMerge.map((s) => {
        const inc = incoming.find((p) => p.slideId === s.id);
        const prev = state.prompts.find((p) => p.slideId === s.id);
        return {
          slideId: s.id,
          prompt: inc !== undefined ? inc.prompt : (prev?.prompt ?? "")
        };
      });
    } else {
      const byId = new Map(state.prompts.map((p) => [p.slideId, p.prompt]));
      for (const p of incoming) {
        byId.set(p.slideId, p.prompt);
      }
      out.prompts = Array.from(byId.entries()).map(([slideId, prompt]) => ({ slideId, prompt }));
    }
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

export type GenerateImagesProgressPayload = {
  images: GeneratedImage[];
};

/** Генерация картинок только по кнопке; использует текущие prompts[] и порядок слайдов. Не вызывает диалог.
 *  onProgress вызывается после каждого изменения массива (очередь → генерация → готово/ошибка) для Stage 2 UI.
 */
export async function generateImagesFromState(
  state: StudioState,
  options?: { onProgress?: (p: GenerateImagesProgressPayload) => void }
): Promise<GeneratedImage[]> {
  const onProgress = options?.onProgress;

  if (state.slides.length > 0) {
    type SlideJob =
      | { ok: false; id: string; slideId: string; error: string }
      | { ok: true; id: string; slideId: string; finalPrompt: string; rawPrompt: string };

    const jobs: SlideJob[] = state.slides.map((slide) => {
      const row = state.prompts.find((p) => p.slideId === slide.id);
      const rawPrompt = row?.prompt?.trim() ?? "";
      const id = `img_${slide.id}`;
      if (!rawPrompt) {
        return {
          ok: false as const,
          id,
          slideId: slide.id,
          error: "Нет промпта для этого слайда — запроси промпты в диалоге или вставь вручную справа."
        };
      }
      const finalPrompt = enrichPromptForGeneration(state, `${slide.title}\n${slide.text}`, rawPrompt);
      return { ok: true as const, id, slideId: slide.id, finalPrompt, rawPrompt };
    });

    const out: GeneratedImage[] = jobs.map((j) =>
      j.ok
        ? { id: j.id, slideId: j.slideId, prompt: j.finalPrompt, status: "waiting" as const }
        : {
            id: j.id,
            slideId: j.slideId,
            prompt: "",
            status: "error" as const,
            error: j.error
          }
    );
    onProgress?.({ images: [...out] });

    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i]!;
      if (!j.ok) continue;

      out[i] = { id: j.id, slideId: j.slideId, prompt: j.finalPrompt, status: "generating" };
      onProgress?.({ images: [...out] });

      try {
        const img = await fetchOneImage(state, j.id, j.slideId, j.finalPrompt);
        out[i] = img;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Image error";
        out[i] = {
          id: j.id,
          slideId: j.slideId,
          prompt: j.finalPrompt,
          status: "error",
          error: msg
        };
      }
      onProgress?.({ images: [...out] });
    }
    return out;
  }

  const promptJobs: { idx: number; row: SlidePrompt; prompt: string; id: string }[] = [];
  for (let i = 0; i < state.prompts.length; i++) {
    const row = state.prompts[i]!;
    if (!row.prompt.trim()) continue;
    const prompt = enrichPromptForGeneration(state, row.prompt, row.prompt);
    promptJobs.push({ idx: i, row, prompt, id: `img_${i}` });
  }

  const out: GeneratedImage[] = promptJobs.map(({ row, prompt, id }) => ({
    id,
    slideId: row.slideId,
    prompt,
    status: "waiting" as const
  }));
  onProgress?.({ images: [...out] });

  for (let k = 0; k < promptJobs.length; k++) {
    const { row, prompt, id } = promptJobs[k]!;
    out[k] = { id, slideId: row.slideId, prompt, status: "generating" };
    onProgress?.({ images: [...out] });

    try {
      const img = await fetchOneImage(state, id, row.slideId, prompt);
      out[k] = img;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Image error";
      out[k] = { id, slideId: row.slideId, prompt, status: "error", error: msg };
    }
    onProgress?.({ images: [...out] });
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
  const slide = slideId ? state.slides.find((s) => s.id === slideId) : undefined;
  const slideText = slide ? `${slide.title}\n${slide.text}` : prompt;
  const finalPrompt = enrichPromptForGeneration(state, slideText, prompt);
  const img = await fetchOneImage(state, imageId, slideId ?? "", finalPrompt);
  /** В UI и в `prompts[]` держим «сырой» промпт пользователя; в API ушёл обогащённый. */
  return { ...img, prompt };
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

/** Имя архива: тема из левой панели + _reels | _post (безопасные символы для файловой системы). */
function buildZipDownloadFileName(state: StudioState): string {
  const kind = state.contentType === "reels" ? "reels" : "post";
  let base = (state.topic ?? "").trim();
  if (!base) base = "export";
  base = base
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!base) base = "export";
  if (base.length > 90) base = base.slice(0, 90);
  return `${base}_${kind}.zip`;
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

  zip.file("fonts_recommendations.txt", formatTypographyNotesForZip(state));

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
  a.download = buildZipDownloadFileName(state);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
