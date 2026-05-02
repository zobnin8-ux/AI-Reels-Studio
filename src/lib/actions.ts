"use client";

import { buildImagePrompt, formatSceneAnchorsFromMeta, slideBodyForImagePrompt } from "@/lib/build-image-prompt";
import type { ChatMessage, GeneratedImage, SceneMetaEntry, StudioState } from "@/lib/state";
import type { StatePatch } from "@/lib/chat-response";
import { formatTypographyNotesForZip } from "@/lib/typography-export";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function aspectFromContentType(contentType: StudioState["contentType"]) {
  return contentType === "reels" ? ("9:16" as const) : ("4:5" as const);
}

/** Сборка единственной строки для OpenAI Image API по ТЗ (аккаунт, тон, стиль, текст слайда + опц. косметика). */
function composeImagePrompt(
  state: StudioState,
  slide: { id: string; title: string; text: string },
  cosmeticHint: string
) {
  const meta =
    state.project === "poslenego"
      ? state.sceneMeta.find((m) => m.slideId === slide.id)
      : undefined;
  return buildImagePrompt({
    account: state.project,
    tone: state.mood,
    visualStyle: state.visualStyle,
    slideText: slideBodyForImagePrompt(slide),
    cosmeticHint: cosmeticHint.trim() || undefined,
    sceneAnchors: meta ? formatSceneAnchorsFromMeta(meta) : undefined
  });
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
  | "topic"
  | "selectedAngleId"
  | "angles"
  | "slides"
  | "approved"
  | "prompts"
  | "sceneMeta"
  | "caption"
  | "music"
> {
  return {
    topic: state.topic,
    selectedAngleId: state.selectedAngleId,
    angles: state.angles,
    slides: state.slides,
    approved: state.approved,
    prompts: state.prompts,
    sceneMeta: state.sceneMeta,
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
  if (patch.sceneMeta !== undefined) {
    const incoming = patch.sceneMeta;
    const slidesForMerge = patch.slides ?? state.slides;
    if (slidesForMerge.length > 0) {
      const merged: SceneMetaEntry[] = [];
      for (const s of slidesForMerge) {
        const inc = incoming.find((m) => m.slideId === s.id);
        const prev = state.sceneMeta.find((m) => m.slideId === s.id);
        const row = inc ?? prev;
        if (row) merged.push({ ...row, slideId: s.id });
      }
      out.sceneMeta = merged;
    } else {
      const byId = new Map(state.sceneMeta.map((m) => [m.slideId, m]));
      for (const m of incoming) {
        byId.set(m.slideId, m);
      }
      out.sceneMeta = Array.from(byId.values());
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
  if (patch.slides !== undefined && patch.sceneMeta === undefined) {
    out.sceneMeta = [];
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

  if (state.slides.length === 0) {
    return [];
  }

  type SlideJob = {
    id: string;
    slideId: string;
    cosmeticHint: string;
    finalPrompt: string;
  };

  const jobs: SlideJob[] = state.slides.map((slide) => {
    const row = state.prompts.find((p) => p.slideId === slide.id);
    const cosmeticHint = row?.prompt?.trim() ?? "";
    const finalPrompt = composeImagePrompt(state, slide, cosmeticHint);
    return {
      id: `img_${slide.id}`,
      slideId: slide.id,
      cosmeticHint,
      finalPrompt
    };
  });

  const out: GeneratedImage[] = jobs.map((j) => ({
    id: j.id,
    slideId: j.slideId,
    prompt: j.cosmeticHint,
    status: "waiting" as const
  }));
  onProgress?.({ images: [...out] });

  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i]!;
    out[i] = { id: j.id, slideId: j.slideId, prompt: j.cosmeticHint, status: "generating" };
    onProgress?.({ images: [...out] });

    try {
      const img = await fetchOneImage(state, j.id, j.slideId, j.finalPrompt, j.cosmeticHint);
      out[i] = img;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Image error";
      out[i] = {
        id: j.id,
        slideId: j.slideId,
        prompt: j.cosmeticHint,
        status: "error",
        error: msg
      };
    }
    onProgress?.({ images: [...out] });
  }

  return out;
}

async function fetchOneImage(
  state: StudioState,
  id: string,
  slideId: string,
  apiPrompt: string,
  uiHint: string
): Promise<GeneratedImage> {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: apiPrompt,
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
  return {
    id,
    slideId,
    prompt: uiHint,
    status: "done",
    imageBase64: json.imageBase64,
    mimeType: json.mimeType
  };
}

export async function regenerateOneImage(
  state: StudioState,
  imageId: string,
  slideId: string | undefined,
  cosmeticHint: string
): Promise<GeneratedImage> {
  const slide = slideId ? state.slides.find((s) => s.id === slideId) : undefined;
  const hint = cosmeticHint.trim();
  const finalPrompt = slide
    ? composeImagePrompt(state, slide, hint)
    : buildImagePrompt({
        account: state.project,
        tone: state.mood,
        visualStyle: state.visualStyle,
        slideText: hint || "(no slide)",
        cosmeticHint: undefined
      });
  const img = await fetchOneImage(state, imageId, slideId ?? "", finalPrompt, hint);
  return { ...img, prompt: hint };
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

  const cosmeticLines = state.slides.length
    ? state.slides.map((s, i) => {
        const p = state.prompts.find((x) => x.slideId === s.id)?.prompt ?? "";
        const label = p.trim() ? p : "(нет)";
        return `${String(i + 1).padStart(2, "0")}. ${label}`;
      })
    : state.prompts.map((x, i) => `${String(i + 1).padStart(2, "0")}. ${x.prompt || "(нет)"}`);
  zip.file("cosmetic_hints.txt", cosmeticLines.join("\n\n"));

  if (state.sceneMeta.length > 0) {
    const sceneLines = state.sceneMeta.map((m) => {
      const slideIdx = state.slides.findIndex((s) => s.id === m.slideId);
      const n = slideIdx >= 0 ? slideIdx + 1 : "?";
      return `${String(n).padStart(2, "0")}. slideId=${m.slideId}\nscene_type=${m.scene_type}\nenvironment=${m.environment}\nvisual_focus=${m.visual_focus}`;
    });
    zip.file("scene_meta.txt", sceneLines.join("\n\n"));
  }

  const openAiBlocks = state.slides.map((s, i) => {
    const hint = state.prompts.find((x) => x.slideId === s.id)?.prompt?.trim() ?? "";
    const block = composeImagePrompt(state, s, hint);
    return `--- ${String(i + 1).padStart(2, "0")}. ${s.title || s.id} ---\n${block}`;
  });
  zip.file("image_prompts_openai.txt", openAiBlocks.join("\n\n"));

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
