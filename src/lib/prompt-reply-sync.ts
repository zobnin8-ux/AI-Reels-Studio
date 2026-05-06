/**
 * Когда модель не кладёт imagePrompts в statePatch, вытаскиваем абзац из reply
 * и синхронизируем в imagePrompts для нужного слайда.
 */

export function userWantsPromptImprovement(userText: string): boolean {
  const t = userText.trim();
  if (!t) return false;
  return (
    /\b(улучш|усиль|доработ|перепиш|сильнее|детальн|мощн).{0,40}(промпт|кадр|изображен|шот|shot)/i.test(
      t
    ) ||
    /\b(промпт|кадр).{0,30}(улучш|усиль|доработ|перепиш|сильнее|детальн)/i.test(t) ||
    (/\bулучш/i.test(t) && /\bпромпт/i.test(t)) ||
    /\b(rewrite|re-write|regenerate|refine|improve|update|redo).{0,55}(prompt|slide|frame|shot|image)/i.test(
      t
    ) ||
    /\b(prompt|slide|frame|shot).{0,35}(rewrite|regenerate|refine|improve|update|new|another|different)/i.test(
      t
    ) ||
    /\bnew\s+prompt\b/i.test(t)
  );
}

/** Номер слайда 1..N из сообщения пользователя. */
export function extractSlideIndexFromUserMessage(userText: string, slidesLen: number): number | null {
  const direct = userText.match(/(?:слайд|slide|кадр|frame)\s*#?\s*(\d{1,2})/i);
  if (direct) {
    const n = Number(direct[1]);
    if (n >= 1 && n <= slidesLen) return n;
  }
  const loose = userText.match(/(?:промпт|кадр|слайд).*?(\d{1,2})(?:\s|$|[,.!?])/i);
  if (loose) {
    const n = Number(loose[1]);
    if (n >= 1 && n <= slidesLen) return n;
  }
  if (/\bпоследн/i.test(userText) && slidesLen > 0) return slidesLen;
  if (/\bперв(ый|ого|ому)?\b/i.test(userText)) return slidesLen >= 1 ? 1 : null;
  if (/\bвтор(ой|ого|ому)?\b/i.test(userText)) return slidesLen >= 2 ? 2 : null;
  if (/\bтрет(ий|ьего|ьему)?\b/i.test(userText)) return slidesLen >= 3 ? 3 : null;
  if (/\bчетвёрт|четверт/i.test(userText)) return slidesLen >= 4 ? 4 : null;
  if (/\bпят(ый|ого|ому)?\b/i.test(userText)) return slidesLen >= 5 ? 5 : null;
  return null;
}

/** Иногда модель пишет «для кадра 3: …» в ответе. */
export function extractSlideIndexFromAssistantReply(reply: string): number | null {
  const m = reply.match(/(?:кадр|слайд|frame|slide)\s*[:#]?\s*(\d{1,2})\b/i);
  if (m) return Number(m[1]);
  const m2 = reply.match(/\b(?:slide|frame)\s+(\d{1,2})\b/i);
  if (m2) return Number(m2[1]);
  return null;
}

/** Вытащить строку промпта из свободного текста ответа. */
export function normalizeImagePromptFromReply(reply: string): string {
  const fence = reply.match(/```(?:[\w-]*)?\s*\n([\s\S]*?)```/);
  let raw = (fence?.[1] ?? reply).trim();

  raw = raw.replace(/^\s*(вот|here|итог|улучшенн|updated|prompt)\s*[:\-].*?\n/i, "");

  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const scored = lines.filter((l) => {
    if (l.length < 25) return false;
    if (/^(#+\s|[-*]\s|\d+[.)])/i.test(l)) return false;
    if (/^(да|нет|ок|хорошо|конечно)/i.test(l)) return false;
    return true;
  });

  const best =
    scored.sort((a, b) => b.length - a.length)[0] ??
    lines.sort((a, b) => b.length - a.length)[0] ??
    raw;

  return best
    .replace(/^["'`«»]+|["'`«»]+$/g, "")
    .replace(/^\s*(промпт|prompt|image\s*prompt)\s*[:\-]\s*/i, "")
    .trim();
}
