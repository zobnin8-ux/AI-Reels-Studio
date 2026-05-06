import type { ContentType, ImagePrompt } from "@/lib/state";

const NO_TEXT_PHRASES = ["no text", "no letters", "no typography", "no captions", "no logos", "no readable"];

const ASPECT_PHRASES = {
  reels: ["9:16", "vertical 9:16"],
  post: ["4:5", "vertical 4:5"]
} as const;

/** Готовит финальную строку под OpenAI Image: промпт от модели + минимальные доп. ограничения при отсутствии. */
export function sanitizeForOpenAIImage(rawPrompt: string, contentType: ContentType): string {
  let out = rawPrompt.trim();

  const lower = out.toLowerCase();
  const hasNoText = NO_TEXT_PHRASES.some((p) => lower.includes(p));
  if (!hasNoText) {
    out += "\n\nNo text, letters, captions, logos, or readable signs in the frame.";
  }

  const aspectKeywords = ASPECT_PHRASES[contentType];
  const hasAspect = aspectKeywords.some((p) => lower.includes(p.toLowerCase()));
  if (!hasAspect) {
    const aspect = contentType === "reels" ? "9:16" : "4:5";
    out += `\n\nVertical ${aspect} framing. Reserve generous negative space for later text overlay.`;
  }

  return out;
}

/** Промпт для слайда: ручная правка перебивает текст от модели. */
export function resolveImagePrompt(imagePrompts: ImagePrompt[], slideId: string): string | null {
  const entry = imagePrompts.find((p) => p.slideId === slideId);
  if (!entry) return null;
  const o = entry.manualOverride?.trim();
  if (o) return o;
  const p = entry.prompt.trim();
  return p || null;
}
