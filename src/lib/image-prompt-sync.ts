import type { GeneratedImage, ImagePrompt, Slide, StudioState } from "@/lib/state";
import { resolveImagePrompt } from "@/lib/image-prompt-pipeline";

/** Нормализует текст промпта, если модель обернула JSON/markdown. */
export function sanitizePromptText(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return s;

  const inlinePrompt = s.match(/"prompt"\s*:\s*"([\s\S]*?)"/i) ?? s.match(/prompt\s*:\s*([\s\S]*)$/i);
  if (inlinePrompt?.[1]) s = inlinePrompt[1].trim();

  const jsonLike = s.match(/^\{\s*"?prompt"?\s*:\s*([\s\S]*?)\s*\}$/i);
  if (jsonLike?.[1]) s = jsonLike[1].trim();

  const fenced = s.match(/```(?:[\w-]*)?\s*\n([\s\S]*?)```/);
  if (fenced?.[1]) {
    s = fenced[1].trim();
  }

  s = s.replace(/^\s*(prompt|промпт)\s*[:\-]\s*/i, "");
  s = s.replace(/^\s*[{[]\s*|[\]}]\s*$/g, "");
  s = s.replace(/^[`"'«»\s]+|[`"'«»\s]+$/g, "");
  s = s.replace(/\\n/g, "\n").replace(/\\"/g, "\"");
  s = s.replace(/\s*[,;]\s*$/g, "");

  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    const quoted = [...s.matchAll(/"([^"]{12,})"/g)].map((m) => m[1]!.trim());
    if (quoted.length > 0) {
      s = quoted.sort((a, b) => b.length - a.length)[0]!;
    }
  }

  s = s.replace(/^\s*\d+[.)]\s*/, "");
  s = s.replace(/^\s*[-*]\s*/, "");

  return s.trim();
}

function shortPreview(text: string, n = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

/** Патч из ответа модели: новый английский промпт для одного слайда, сбрасывает manualOverride. */
export function mergeImagePromptFromModelReply(
  state: StudioState,
  slideId: string,
  prompt: string
): ImagePrompt[] {
  const cleaned = sanitizePromptText(prompt);
  if (state.slides.length === 0) {
    const others = state.imagePrompts.filter((p) => p.slideId !== slideId);
    return [...others, { slideId, prompt: cleaned }];
  }
  return state.slides.map((s) => {
    const prev = state.imagePrompts.find((p) => p.slideId === s.id);
    if (s.id === slideId) {
      return {
        slideId: s.id,
        prompt: cleaned || prev?.prompt || "",
        manualOverride: undefined
      };
    }
    return prev ? { ...prev } : { slideId: s.id, prompt: "" };
  });
}

/** Правка в UI: если текст совпадает с базовым prompt модели — manualOverride снимается. */
export function mergeImagePromptManual(
  state: StudioState,
  slideId: string,
  editedResolved: string
): ImagePrompt[] {
  const trim = editedResolved.trim();
  if (state.slides.length === 0) {
    const others = state.imagePrompts.filter((p) => p.slideId !== slideId);
    return [...others, { slideId, prompt: trim, manualOverride: undefined }];
  }
  return state.slides.map((s) => {
    const prev = state.imagePrompts.find((p) => p.slideId === s.id);
    if (s.id !== slideId) {
      return prev ? { ...prev } : { slideId: s.id, prompt: "" };
    }
    const base = (prev?.prompt ?? "").trim();
    const manualOverride = trim !== base ? trim : undefined;
    return {
      slideId: s.id,
      prompt: prev?.prompt ?? "",
      manualOverride
    };
  });
}

export function syncImagesWithImagePrompts(
  images: GeneratedImage[],
  imagePrompts: ImagePrompt[]
): GeneratedImage[] {
  return images.map((img) => {
    if (!img.slideId) return img;
    const hint = resolveImagePrompt(imagePrompts, img.slideId);
    const next = hint ? shortPreview(hint) : "";
    if (img.prompt === next) return img;
    return { ...img, prompt: next };
  });
}

/**
 * Держит `images` в соответствии со списком слайдов: один кадр на слайд, порядок = порядок слайдов.
 * Убирает лишние кадры; добавляет недостающие слоты со статусом `waiting`.
 */
export function alignImagesToSlides(
  slides: Slide[],
  images: GeneratedImage[],
  imagePrompts: ImagePrompt[]
): GeneratedImage[] {
  if (slides.length === 0) return [];

  const bySlideId = new Map<string, GeneratedImage>();
  for (const img of images) {
    if (img.slideId) bySlideId.set(img.slideId, img);
  }

  return slides.map((slide) => {
    const prev = bySlideId.get(slide.id);
    const hint = resolveImagePrompt(imagePrompts, slide.id);
    const preview = hint ? shortPreview(hint) : "";

    if (prev) {
      if (prev.prompt === preview) return prev;
      return { ...prev, prompt: preview };
    }

    return {
      id: `img_${slide.id}`,
      slideId: slide.id,
      prompt: preview,
      status: "waiting" as const
    };
  });
}
