import type { StudioState } from "@/lib/state";

function tryExtractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanLine(raw: string): string {
  let s = (raw ?? "").trim();
  s = s.replace(/^\s*[-*•]\s+/, "");
  s = s.replace(/\*\*/g, "");
  s = s.replace(/^[`"'«»\s]+|[`"'«»\s]+$/g, "");
  return s.replace(/\s+/g, " ").trim();
}

export function isMusicBlockEmpty(m: StudioState["music"] | undefined): boolean {
  if (!m) return true;
  return m.queries.length === 0 && m.recommendations.length === 0 && m.avoid.length === 0;
}

/** Пользователь явно просит музыку / подбор / саунд. */
export function wantsMusicKeyword(text: string): boolean {
  return /\b(музык|music|трек|саунд|sound|плейлист|playlist|spotify)\b/i.test(text);
}

/** Уточнение к уже начатому разговору о музыке без слова «музыка». */
export function wantsMusicRefinement(text: string): boolean {
  return /\b(подбери\s+сам|выбери\s+сам|сам(а)?\s+(реши|подбери)|по\s+смыслу|по\s+теме|по\s+кадрам|для\s+инстаграм|for\s+instagram|you\s+pick)\b/i.test(
    text
  );
}

/** Ответ похож на подбор треков (нумерация, исполнители, «избегать»). */
export function looksLikeMusicReply(reply: string): boolean {
  if (reply.length < 40) return false;
  const t = reply;
  if (/(^|\n)\d+[\).]\s*.+[—\-–].+["']/.test(t)) return true;
  if (/\b(feat\.|ft\.|spotify|soundtrack|альбом|EP|single)\b/i.test(t)) return true;
  if (/(Billie|Bon Iver|Lana Del|James Blake|Daughter|Khalid)\b/i.test(t)) return true;
  if (/(избегай|avoid|не\s+бери|не\s+используй).{0,120}(поп|drop|бит)/is.test(t)) return true;
  if ((t.match(/[—–-]\s*["'`«]/g) ?? []).length >= 2) return true;
  return false;
}

export function extractMusicFromReply(reply: string): StudioState["music"] {
  const json = tryExtractJson(reply);
  const empty = (): StudioState["music"] => ({
    queries: [],
    recommendations: [],
    avoid: []
  });

  const maybe = json?.music as
    | { queries?: unknown; recommendations?: unknown; avoid?: unknown }
    | undefined;
  if (maybe && (maybe.queries || maybe.recommendations || maybe.avoid)) {
    return {
      queries: Array.isArray(maybe.queries)
        ? maybe.queries.map((x) => cleanLine(String(x))).filter(Boolean)
        : [],
      recommendations: Array.isArray(maybe.recommendations)
        ? maybe.recommendations.map((x) => cleanLine(String(x))).filter(Boolean)
        : [],
      avoid: Array.isArray(maybe.avoid) ? maybe.avoid.map((x) => cleanLine(String(x))).filter(Boolean) : []
    };
  }

  const out = empty();
  let body = reply.replace(/```[\w-]*\n([\s\S]*?)```/g, "$1");

  // Блок «Избегать / Avoid»
  const avoidSplit = body.split(/(?:^|\n)(?:#{0,3}\s*)?(?:\*\*)?(Избегать|Avoid|Не\s+брать|Не\s+использовать)(?:\*\*)?\s*[:\-]?\s*/i);
  if (avoidSplit.length > 1) {
    const tail = avoidSplit.slice(1).join("");
    const lines = tail.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^(#{1,3}\s*)?(Рекоменд|Поиск|queries|\d+\.)/i.test(line)) break;
      const c = cleanLine(line);
      if (c.length > 2 && out.avoid.length < 16) out.avoid.push(c);
      if (out.avoid.length >= 6) break;
    }
  }

  // Нумерованные треки: 1. **Artist — "Title"** или 1. Artist — Title
  const numbered = body.match(/^\s*\d+[\).]\s*([^\n]+)/gm) ?? [];
  for (const row of numbered) {
    const inner = row.replace(/^\s*\d+[\).]\s*/, "").trim();
    const line = cleanLine(inner);
    if (line.length < 6) continue;
    if (/—|–|-/.test(line) || /"/.test(line) || /\b(feat|ft\.)/i.test(line)) {
      out.recommendations.push(line);
      const q = line
        .replace(/\([^)]*\)/g, "")
        .replace(/["'`«»]/g, "")
        .replace(/\s+—\s+/g, " ")
        .trim()
        .slice(0, 120);
      if (q.length > 2) out.queries.push(q);
    }
  }

  out.queries = [...new Set(out.queries)];

  // Маркированный список треков
  if (out.recommendations.length === 0) {
    const bullets = body.match(/^\s*[-*•]\s*([^\n]+)$/gm) ?? [];
    for (const row of bullets) {
      const inner = row.replace(/^\s*[-*•]\s*/, "").trim();
      const line = cleanLine(inner);
      if (line.length >= 8 && (/—|–|-/.test(line) || /"/.test(line))) {
        out.recommendations.push(line);
        const q = line.replace(/\([^)]*\)/g, "").replace(/["'`«»]/g, "").trim().slice(0, 120);
        if (q.length > 2) out.queries.push(q);
      }
    }
    out.queries = [...new Set(out.queries)];
  }

  // Старый формат строк query:/rec:/avoid:
  if (out.recommendations.length === 0) {
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^(query|поиск)\s*[:\-]/i.test(line)) {
        out.queries.push(cleanLine(line.replace(/^(query|поиск)\s*[:\-]/i, "")));
      } else if (/^(rec|recommend|направл)/i.test(line)) {
        out.recommendations.push(cleanLine(line.replace(/^(rec|recommend|направл\w*)\s*[:\-]/i, "")));
      } else if (/^(avoid|избег)/i.test(line)) {
        out.avoid.push(cleanLine(line.replace(/^(avoid|избег\w*)\s*[:\-]/i, "")));
      }
    }
  }

  return out;
}
