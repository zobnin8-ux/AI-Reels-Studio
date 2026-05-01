import type { GeneratedImage, SlidePrompt, StudioState } from "@/lib/state";

/** Один промпт для слайда + остальные слайды сохраняют строки из state.prompts. */
export function mergePromptForSlide(
  state: StudioState,
  slideId: string,
  prompt: string
): SlidePrompt[] {
  if (state.slides.length === 0) {
    const others = state.prompts.filter((p) => p.slideId !== slideId);
    return [...others, { slideId, prompt }];
  }
  return state.slides.map((s) => {
    if (s.id === slideId) return { slideId: s.id, prompt };
    const row = state.prompts.find((p) => p.slideId === s.id);
    return { slideId: s.id, prompt: row?.prompt ?? "" };
  });
}

/**
 * Когда обновляют `prompts[]` (диалог, правая колонка), подтягиваем те же строки в карточки кадров —
 * иначе под плиткой остаётся старый текст и «Перегенерировать» шлёт не то.
 */
export function syncImagesWithSlidePrompts(images: GeneratedImage[], prompts: SlidePrompt[]): GeneratedImage[] {
  return images.map((img) => {
    if (!img.slideId) return img;
    const row = prompts.find((p) => p.slideId === img.slideId);
    if (!row) return img;
    if (img.prompt === row.prompt) return img;
    return { ...img, prompt: row.prompt };
  });
}
