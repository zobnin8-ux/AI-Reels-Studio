import { resolveImagePrompt } from "@/lib/image-prompt-pipeline";
import type { StudioState } from "@/lib/state";

/** Сообщение пользователя подразумевает запуск генерации картинок без отдельного клика справа. */
export function userWantsImageGeneration(userText: string): boolean {
  const t = userText.trim();
  if (!t) return false;
  return (
    /\b(генерир|изображен|картинк|нарисуй|отправь\s*на\s*генерац|запусти\s*генерац|сгенерир\s*кадр|сделай\s*кадр)\b/i.test(
      t
    ) ||
    /\b(render|generate\s*images?|run\s*image)\b/i.test(t)
  );
}

export function canRunImageGeneration(state: StudioState): boolean {
  if (state.slides.length === 0) return false;
  return state.slides.every((s) => Boolean(resolveImagePrompt(state.imagePrompts, s.id)));
}
