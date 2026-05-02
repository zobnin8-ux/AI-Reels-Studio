/**
 * Нормализация видимого текста ответа модели и поля caption:
 * модель иногда дублирует весь JSON в reply или кладёт caption как вложенный JSON-строкой.
 */

/** Достаёт чистый текст подписи, если значение пришло как '{"caption":"..."}' (возможны вложенные уровни). */
export function unwrapCaptionValue(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  for (let i = 0; i < 4; i++) {
    if (!s.startsWith("{")) break;
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      if (typeof o.caption === "string") {
        s = o.caption.trim();
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return s;
}

/**
 * Убирает случай, когда весь ответ ассистента — один JSON-объект API;
 * удаляет хвостовые ```json { "reply", "statePatch" } ``` дубликаты после обычного текста.
 */
export function sanitizeModelReplyForDisplay(reply: string): string {
  let s = (reply ?? "").trim();
  if (!s) return "";

  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s) as { reply?: unknown };
      if (typeof o.reply === "string" && o.reply.trim()) {
        s = o.reply.trim();
      }
    } catch {
      /* оставляем как есть */
    }
  }

  s = s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (full, inner: string) => {
    const t = String(inner).trim();
    if (!t.startsWith("{")) return full;
    try {
      const o = JSON.parse(t) as { reply?: unknown; statePatch?: unknown };
      if (typeof o.reply === "string" && o.statePatch !== undefined) {
        return "";
      }
    } catch {
      return full;
    }
    return full;
  });

  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** Caption из произвольного JSON в reply (верхний уровень или statePatch). */
export function extractCaptionFromJsonBlob(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const top = o.caption;
    if (typeof top === "string" && top.trim()) return unwrapCaptionValue(top);
    const sp = o.statePatch as Record<string, unknown> | undefined;
    const nested = sp?.caption;
    if (typeof nested === "string" && nested.trim()) return unwrapCaptionValue(nested);
  } catch {
    return null;
  }
  return null;
}
