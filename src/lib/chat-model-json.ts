/**
 * Извлечение JSON из сырого ответа модели (markdown fence, лишний текст до/после).
 */

export function extractJsonObjectFromModelText(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const candidate = fence ? fence[1]!.trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Достаёт поле reply или возвращает эвристику по сырой строке. */
export function extractReplyTextFromRawModelOutput(raw: string): string {
  const trimmed = raw.trim();
  try {
    const obj = extractJsonObjectFromModelText(trimmed) as { reply?: unknown };
    if (typeof obj?.reply === "string" && obj.reply.trim()) return obj.reply.trim();
  } catch {
    // ignore
  }
  const m = trimmed.match(/"reply"\s*:\s*"([\s\S]*?)"/i);
  if (m?.[1]) {
    return m[1]
      .replace(/\\"/g, "\"")
      .replace(/\\n/g, "\n")
      .trim();
  }
  return trimmed;
}
