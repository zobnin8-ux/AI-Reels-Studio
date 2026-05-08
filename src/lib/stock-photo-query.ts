/**
 * Unsplash/Pexels индексируют в основном английские запросы.
 * Если пользователь пишет по-русски, переводим в короткие EN-ключевые слова на сервере.
 */

const CYRILLIC = /[\u0400-\u04FF]/;

function clip(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

/**
 * @returns строка для параметра `query` у Unsplash/Pexels
 */
export async function keywordsForStockPhotoSearch(userQuery: string): Promise<string> {
  const trimmed = clip(userQuery, 200);
  if (trimmed.length < 2) return trimmed;

  if (!CYRILLIC.test(trimmed)) {
    return clip(trimmed, 100);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return clip(trimmed, 100);
  }

  const model =
    process.env.OPENAI_STOCK_QUERY_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "You convert short user phrases into concise English keywords for stock photo search (Unsplash, Pexels). " +
              "Output ONLY the English keywords: lowercase, separate with spaces or commas, 3–14 words. " +
              "No quotes, no sentences, no explanation. " +
              "If the user names a place or person in Cyrillic, use common English exonyms or Latin transliteration when needed."
          },
          { role: "user", content: trimmed }
        ]
      })
    });

    if (!res.ok) {
      return clip(trimmed, 100);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw
      .replace(/^["']|["']$/g, "")
      .replace(/\n+/g, " ")
      .trim();
    if (cleaned.length < 2) {
      return clip(trimmed, 100);
    }
    return clip(cleaned, 100);
  } catch {
    return clip(trimmed, 100);
  }
}
