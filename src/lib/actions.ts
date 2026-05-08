"use client";

import {
  type ChatMessage,
  type GeneratedImage,
  type ImagePrompt,
  type StudioState
} from "@/lib/state";
import type { StatePatch } from "@/lib/chat-response";
import { unwrapCaptionValue } from "@/lib/chat-reply-format";
import {
  coerceSelectedAngleId,
  MAX_ANGLES,
  normalizeAnglesList,
  remapSelectedAngleIdAfterNormalize
} from "@/lib/angle-normalize";
import { formatTypographyNotesForZip } from "@/lib/typography-export";
import { resolveImagePrompt, sanitizeForOpenAIImage } from "@/lib/image-prompt-pipeline";
import { sanitizePromptText } from "@/lib/image-prompt-sync";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function aspectFromContentType(contentType: StudioState["contentType"]) {
  return contentType === "reels" ? ("9:16" as const) : ("4:5" as const);
}

export function buildSelectorsPayload(
  state: StudioState
): Pick<StudioState, "project" | "contentType" | "slideCount" | "ctaMode" | "website" | "triggerWord" | "customCta"> {
  return {
    project: state.project,
    contentType: state.contentType,
    slideCount: state.slideCount,
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
  "topic" | "selectedAngleId" | "angles" | "slides" | "approved" | "imagePrompts" | "caption" | "music"
> {
  return {
    topic: state.topic,
    selectedAngleId: state.selectedAngleId,
    angles: state.angles,
    slides: state.slides,
    approved: state.approved,
    imagePrompts: state.imagePrompts,
    caption: state.caption,
    music: state.music
  };
}

function mergeImagePromptPatch(state: StudioState, patch: StatePatch, incoming: ImagePrompt[]): Partial<StudioState> {
  const slidesFor = patch.slides ?? state.slides;
  if (slidesFor.length > 0) {
    return {
      imagePrompts: slidesFor.map((s) => {
        const inc = incoming.find((p) => p.slideId === s.id);
        const prev = state.imagePrompts.find((p) => p.slideId === s.id);
        if (inc) {
          return {
            slideId: s.id,
            prompt: sanitizePromptText(inc.prompt),
            manualOverride: undefined
          };
        }
        return prev ?? { slideId: s.id, prompt: "" };
      })
    };
  }
  const byId = new Map(state.imagePrompts.map((p) => [p.slideId, { ...p }] as const));
  for (const p of incoming) {
    byId.set(p.slideId, {
      slideId: p.slideId,
      prompt: sanitizePromptText(p.prompt),
      manualOverride: undefined
    });
  }
  return { imagePrompts: Array.from(byId.values()) };
}

export function mergeStatePatch(state: StudioState, patch: StatePatch | undefined): Partial<StudioState> {
  if (!patch) return {};
  const out: Partial<StudioState> = {};
  if (patch.topic !== undefined) out.topic = patch.topic;
  if (patch.angles !== undefined) {
    const raw = patch.angles.slice(0, MAX_ANGLES);
    const normalized = normalizeAnglesList(raw);
    out.angles = normalized;
    if (patch.selectedAngleId !== undefined) {
      out.selectedAngleId = remapSelectedAngleIdAfterNormalize(
        raw,
        normalized,
        patch.selectedAngleId
      );
    }
  } else if (patch.selectedAngleId !== undefined) {
    out.selectedAngleId = coerceSelectedAngleId(patch.selectedAngleId, state.angles);
  }
  if (patch.slides !== undefined) {
    out.slides = patch.slides;
    if (patch.imagePrompts === undefined) {
      const ids = new Set(patch.slides.map((s) => s.id));
      out.imagePrompts = state.imagePrompts.filter((p) => ids.has(p.slideId));
      out.images = state.images.filter((img) => !img.slideId || ids.has(img.slideId));
    }
  }
  if (patch.approved !== undefined) out.approved = patch.approved;
  if (patch.imagePrompts !== undefined) {
    Object.assign(out, mergeImagePromptPatch(state, patch, patch.imagePrompts));
  }
  if (patch.caption !== undefined) out.caption = unwrapCaptionValue(patch.caption);
  if (patch.music !== undefined) out.music = patch.music;

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
    let msg = (err as { error?: string }).error ?? `Chat failed (${res.status})`;
    if (res.status === 502 || res.status === 504) {
      msg +=
        " Часто это таймаут шлюза (например Render): в панели сервиса увеличьте request timeout / лимит времени функции, либо повторите запрос короче.";
    }
    throw new Error(msg);
  }

  return (await res.json()) as { reply: string; statePatch?: StatePatch };
}

export type GenerateImagesProgressPayload = {
  images: GeneratedImage[];
};

export async function generateImagesFromState(
  state: StudioState,
  options?: {
    onProgress?: (p: GenerateImagesProgressPayload) => void;
    signal?: AbortSignal;
    useReferences?: boolean;
  }
): Promise<GeneratedImage[]> {
  const onProgress = options?.onProgress;
  const signal = options?.signal;
  const useReferences = Boolean(options?.useReferences);

  if (state.slides.length === 0) {
    return [];
  }

  type SlideJob = {
    id: string;
    slideId: string;
    uiHint: string;
    finalPrompt: string;
  };

  const jobs: SlideJob[] = state.slides.map((slide) => {
    const raw = resolveImagePrompt(state.imagePrompts, slide.id);
    if (!raw) {
      throw new Error(
        `Нет image prompt для слайда «${slide.title}». Попроси Anthropic сгенерировать промпты картинок для всех слайдов.`
      );
    }
    const finalPrompt = sanitizeForOpenAIImage(raw, state.contentType, state.project);
    return {
      id: `img_${slide.id}`,
      slideId: slide.id,
      uiHint: raw.slice(0, 200),
      finalPrompt
    };
  });

  const out: GeneratedImage[] = jobs.map((j) => ({
    id: j.id,
    slideId: j.slideId,
    prompt: j.uiHint,
    finalPrompt: j.finalPrompt,
    status: "waiting" as const
  }));
  onProgress?.({ images: [...out] });

  for (let i = 0; i < jobs.length; i++) {
    if (signal?.aborted) {
      for (let k = i; k < jobs.length; k++) {
        const jj = jobs[k]!;
        out[k] = {
          id: jj.id,
          slideId: jj.slideId,
          prompt: jj.uiHint,
          finalPrompt: jj.finalPrompt,
          status: "error",
          error: "Отменено"
        };
      }
      onProgress?.({ images: [...out] });
      throw new Error("Генерация отменена");
    }

    const j = jobs[i]!;
    out[i] = {
      id: j.id,
      slideId: j.slideId,
      prompt: j.uiHint,
      finalPrompt: j.finalPrompt,
      status: "generating"
    };
    onProgress?.({ images: [...out] });

    try {
      const img = await fetchOneImage(state, j.id, j.slideId, j.finalPrompt, j.uiHint, signal, useReferences);
      out[i] = img;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Image error";
      out[i] = {
        id: j.id,
        slideId: j.slideId,
        prompt: j.uiHint,
        finalPrompt: j.finalPrompt,
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
  uiHint: string,
  signal?: AbortSignal,
  useReferences?: boolean
): Promise<GeneratedImage> {
  const refFullUrls = (useReferences ? state.references.items : [])
    .map((x) => x.full)
    .filter(Boolean)
    .slice(0, 6);
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      prompt: apiPrompt,
      aspect: aspectFromContentType(state.contentType),
      useReferences: Boolean(useReferences) && refFullUrls.length > 0,
      references: refFullUrls
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
    finalPrompt: apiPrompt,
    status: "done",
    imageBase64: json.imageBase64,
    mimeType: json.mimeType
  };
}

/**
 * Перегенерация одного кадра: raw из imagePrompts (+ manualOverride), затем sanitize.
 * Если передан apiPromptOverride — уходит в API как есть (уже финальная строка).
 */
export async function regenerateOneImage(
  state: StudioState,
  imageId: string,
  slideId: string | undefined,
  apiPromptOverride?: string
): Promise<GeneratedImage> {
  const override = apiPromptOverride?.trim();
  let finalPrompt: string;
  let uiHint: string;
  if (override) {
    finalPrompt = override;
    uiHint = override.slice(0, 200);
  } else if (slideId) {
    const raw = resolveImagePrompt(state.imagePrompts, slideId);
    if (!raw) {
      throw new Error("Нет промпта для этого слайда. Попроси модель выдать imagePrompts.");
    }
    finalPrompt = sanitizeForOpenAIImage(raw, state.contentType, state.project);
    uiHint = raw.slice(0, 200);
  } else {
    throw new Error("Нет slideId для перегенерации.");
  }
  return fetchOneImage(state, imageId, slideId ?? "", finalPrompt, uiHint);
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

  const openAiBlocks = state.slides.map((s, i) => {
    const raw = resolveImagePrompt(state.imagePrompts, s.id);
    const imgRow = state.images.find((x) => x.slideId === s.id);
    const block =
      imgRow?.finalPrompt?.trim() ||
      (raw ? sanitizeForOpenAIImage(raw, state.contentType, state.project) : "(нет промпта — запроси у модели)");
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
