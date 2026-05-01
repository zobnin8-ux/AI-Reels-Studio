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

/** Строки из сценария (слайды), не поисковые запросы к библиотеке музыки. */
export function looksLikeScenarioSlideLine(line: string): boolean {
  const s = line.trim();
  if (/^[\-*•]\s*Слайд\s*\d/i.test(s)) return true;
  if (/Слайд\s*\d\s*[—–-]/i.test(s)) return true;
  if (/^\d+[\).]\s*\*?\s*Слайд\s*\d/i.test(s)) return true;
  if (/\bСлайд\s*\d\s*[—–-]\s*(Hook|Recognition|Impact|Хук|Признание)/i.test(s)) return true;
  return false;
}

export function isMusicBlockEmpty(m: StudioState["music"] | undefined): boolean {
  if (!m) return true;
  return m.queries.length === 0 && m.recommendations.length === 0 && m.avoid.length === 0;
}

/** Пользователь явно просит музыку / подбор / саунд. */
export function wantsMusicKeyword(text: string): boolean {
  return /\b(музык|music|трек|саунд|sound|плейлист|playlist|spotify)\b/i.test(text);
}

/**
 * Заполняем блок «Музыка» в UI только если это явный запрос подбора музыки.
 * Не используем широкие эвристики по тексту ответа модели без запроса пользователя.
 */
export function userExplicitMusicIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (wantsMusicKeyword(t)) return true;
  if (
    /\b(подбери|подобрать|наподбери|найди|найти|предложи|выбери|порекомендуй|дай|накидай|сгенерируй)\s+(музыку|музык|треки?|трек|саунд|аудио|плейлист|подбор\s+музык|музыкальн\w+\s+ряд)/i.test(
      t
    )
  ) {
    return true;
  }
  if (/\b(музыкальн\w+\s+подбор|подбор\s+треков|саундтрек|звук\w*\s+к\s+ролику|бордер\s+под)\b/i.test(t)) {
    return true;
  }
  if (/\b(как(ой|ие)\s+трек|как(ая|ую)\s+музык|что\s+поставить\s+под)\b/i.test(t)) return true;
  if (/\b(аудио|инструментал|фонов\w*\s+трек|плейлист)\b/i.test(t)) return true;
  if (/\bмузык\w*\s*(к\s+ролику|для\s+ролика|под\s+видео|в\s+рилс|для\s+рилс)/i.test(t)) return true;
  if (/\b(перегенерир|обнови|друг\w+)\s+.*\bмузык/i.test(t)) return true;
  if (/\b(suggest|pick|recommend|give)\s+(me\s+)?(some\s+)?(tracks?|songs?|music|playlist)/i.test(t)) {
    return true;
  }
  if (/\b(bgm|background\s+music|soundtrack)\b/i.test(t)) return true;
  return false;
}

/** Уточнение только если уже шли реплики про музыку (узкий набор, без «по кадрам» и т.п.). */
export function wantsMusicRefinement(text: string): boolean {
  return /\b(подбери\s+сам|выбери\s+сам|сам(а)?\s+(реши|подбери))\b/i.test(text);
}

/** Продолжение темы музыки: «ещё варианты треков», «другая музыка» — без повторного «подбери музыку». */
export function wantsMusicFollowUp(text: string): boolean {
  return (
    /\b(ещё|еще|друг(ие|ой)|вариант|переподбери)\s+(музык|трек|саунд|плейлист)/i.test(text) ||
    /\b(музык|треки?|саунд).{0,40}(ещё|еще|друг|вариант)/i.test(text)
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

  // Нумерованные треки построчно (без флага `m` у `^` матчился только первый пункт в начале всего текста).
  for (const rawLine of body.split("\n")) {
    const numberedM = rawLine.match(/^\s*\d+[\).]\s*(.+)$/);
    if (!numberedM) continue;
    const line = cleanLine(numberedM[1] ?? "");
    if (line.length < 6) continue;
    if (looksLikeScenarioSlideLine(line)) continue;
    if (/—|–|-/.test(line) || /["'`«»]/.test(line) || /\b(feat|ft\.)/i.test(line)) {
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
    for (const rawLine of body.split("\n")) {
      const bulletM = rawLine.match(/^\s*[-*•]\s*(.+)$/);
      if (!bulletM) continue;
      const line = cleanLine(bulletM[1] ?? "");
      if (looksLikeScenarioSlideLine(line)) continue;
      if (line.length >= 8 && (/—|–|-/.test(line) || /["'`«»]/.test(line))) {
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

  // Свободные строки «исполнитель — трек» без нумерации (частый ответ модели в prose).
  if (out.recommendations.length === 0) {
    for (const rawLine of body.split("\n")) {
      const line = cleanLine(rawLine);
      if (line.length < 12 || line.length > 220) continue;
      if (looksLikeScenarioSlideLine(line)) continue;
      if (/^(#{1,3}\s|\*\*|[-*•]\s)/.test(rawLine.trim())) continue;
      if ((/—|–/.test(line) || /\s-\s/.test(line)) && /[A-Za-zА-Яа-яЁё]{2,}/.test(line)) {
        out.recommendations.push(line);
        const q = line
          .replace(/\([^)]*\)/g, "")
          .replace(/["'`«»]/g, "")
          .replace(/\s*[—–-]\s*/g, " ")
          .trim()
          .slice(0, 120);
        if (q.length > 2) out.queries.push(q);
      }
      if (out.recommendations.length >= 8) break;
    }
    out.queries = [...new Set(out.queries)];
  }

  return out;
}
