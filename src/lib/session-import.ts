import type { StudioState } from "@/lib/state";

export const SESSION_EXPORT_VERSION = 1 as const;

export type SessionExportEnvelopeV1 = {
  v: typeof SESSION_EXPORT_VERSION;
  exportedAt?: string;
  state: StudioState;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function asString(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

function asNumber(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function asBool(x: unknown): boolean | null {
  return typeof x === "boolean" ? x : null;
}

function asStringArray(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  if (!x.every((t) => typeof t === "string")) return null;
  return x;
}

function asMusic(x: unknown): StudioState["music"] | null {
  if (!isRecord(x)) return null;
  const queries = asStringArray(x.queries);
  const recommendations = asStringArray(x.recommendations);
  const avoid = asStringArray(x.avoid);
  if (!queries || !recommendations || !avoid) return null;
  return { queries, recommendations, avoid };
}

function asChatMessages(x: unknown): StudioState["messages"] | null {
  if (!Array.isArray(x)) return null;
  const out: StudioState["messages"] = [];
  for (const m of x) {
    if (!isRecord(m)) return null;
    const id = asString(m.id);
    const role = asString(m.role);
    const content = asString(m.content);
    if (!id || (role !== "user" && role !== "assistant") || content === null) return null;
    out.push({ id, role, content });
  }
  return out;
}

function asSlides(x: unknown): StudioState["slides"] | null {
  if (!Array.isArray(x)) return null;
  const out: StudioState["slides"] = [];
  for (const s of x) {
    if (!isRecord(s)) return null;
    const id = asString(s.id);
    const title = asString(s.title);
    const text = asString(s.text);
    if (!id || title === null || text === null) return null;
    out.push({ id, title, text });
  }
  return out;
}

function asAngles(x: unknown): StudioState["angles"] | null {
  if (!Array.isArray(x)) return null;
  const out: StudioState["angles"] = [];
  for (const a of x) {
    if (!isRecord(a)) return null;
    const id = asString(a.id);
    const label = asString(a.label);
    if (!id || label === null) return null;
    out.push({ id, label });
  }
  return out;
}

function asPrompts(x: unknown): StudioState["prompts"] | null {
  if (!Array.isArray(x)) return null;
  const out: StudioState["prompts"] = [];
  for (const p of x) {
    if (!isRecord(p)) return null;
    const slideId = asString(p.slideId);
    const prompt = asString(p.prompt);
    if (!slideId || prompt === null) return null;
    out.push({ slideId, prompt });
  }
  return out;
}

function asImages(x: unknown): StudioState["images"] | null {
  if (!Array.isArray(x)) return null;
  const out: StudioState["images"] = [];
  for (const img of x) {
    if (!isRecord(img)) return null;
    const id = asString(img.id);
    const slideId = img.slideId === undefined ? undefined : asString(img.slideId) ?? undefined;
    const prompt = asString(img.prompt);
    const finalPrompt = img.finalPrompt === undefined ? undefined : asString(img.finalPrompt) ?? undefined;
    const status = asString(img.status);
    const mimeType = img.mimeType === undefined ? undefined : asString(img.mimeType) ?? undefined;
    const error = img.error === undefined ? undefined : asString(img.error) ?? undefined;
    const imageBase64 = img.imageBase64 === undefined ? undefined : asString(img.imageBase64) ?? undefined;
    if (!id || prompt === null) return null;
    if (
      status !== "waiting" &&
      status !== "generating" &&
      status !== "done" &&
      status !== "error"
    ) {
      return null;
    }
    out.push({ id, slideId, prompt, finalPrompt, status, imageBase64, mimeType, error });
  }
  return out;
}

function asSceneMeta(x: unknown): StudioState["sceneMeta"] | null {
  if (!Array.isArray(x)) return null;
  // sceneMeta формы сложные; для импорта достаточно проверить, что это массив объектов с slideId.
  const out: StudioState["sceneMeta"] = [];
  for (const m of x) {
    if (!isRecord(m)) return null;
    const slideId = asString(m.slideId);
    if (!slideId) return null;
    out.push(m as StudioState["sceneMeta"][number]);
  }
  return out;
}

export function parseSessionImport(raw: unknown):
  | { ok: true; state: StudioState }
  | { ok: false; error: string } {
  let candidate: unknown = raw;

  // Envelope v1
  if (isRecord(raw) && raw.v === SESSION_EXPORT_VERSION && "state" in raw) {
    candidate = raw.state;
  }

  if (!isRecord(candidate)) return { ok: false, error: "JSON должен быть объектом." };

  const provider = asString(candidate.provider);
  const project = asString(candidate.project);
  const contentType = asString(candidate.contentType);
  const slideCount = asNumber(candidate.slideCount);
  const mood = asString(candidate.mood);
  const visualStyle = asString(candidate.visualStyle);
  const outputMode = asString(candidate.outputMode);
  const autoGenerateImages = asBool(candidate.autoGenerateImages);
  const ctaMode = asString(candidate.ctaMode);
  const website = asString(candidate.website);
  const triggerWord = asString(candidate.triggerWord);
  const customCta = asString(candidate.customCta);
  const topic = asString(candidate.topic);
  const selectedAngleId =
    candidate.selectedAngleId === null
      ? null
      : candidate.selectedAngleId === undefined
        ? null
        : asString(candidate.selectedAngleId);
  const approved = asBool(candidate.approved);
  const caption = asString(candidate.caption);

  if (provider !== "openai" && provider !== "anthropic") return { ok: false, error: "Неверный provider." };
  if (project !== "poslenego" && project !== "zobnin" && project !== "olgatrip") {
    return { ok: false, error: "Неверный project." };
  }
  if (contentType !== "reels" && contentType !== "post") return { ok: false, error: "Неверный contentType." };
  if (![5, 7, 9, 10, 12].includes(slideCount ?? -1)) return { ok: false, error: "Неверный slideCount." };
  if (
    mood !== "aggressive" &&
    mood !== "soft" &&
    mood !== "provocative" &&
    mood !== "positive" &&
    mood !== "neutral"
  ) {
    return { ok: false, error: "Неверный mood." };
  }
  if (
    visualStyle !== "darkBrutal" &&
    visualStyle !== "lightMinimal" &&
    visualStyle !== "brightPositive" &&
    visualStyle !== "portraLifestyle" &&
    visualStyle !== "editorial" &&
    visualStyle !== "tech"
  ) {
    return { ok: false, error: "Неверный visualStyle." };
  }
  if (outputMode !== "textInImages" && outputMode !== "textSeparate" && outputMode !== "both") {
    return { ok: false, error: "Неверный outputMode." };
  }
  if (ctaMode !== "website" && ctaMode !== "direct" && ctaMode !== "none" && ctaMode !== "custom") {
    return { ok: false, error: "Неверный ctaMode." };
  }
  if (website === null || triggerWord === null || customCta === null || topic === null || caption === null) {
    return { ok: false, error: "Неверные строковые поля." };
  }
  if (approved === null) return { ok: false, error: "Неверный approved." };
  if (selectedAngleId === undefined) return { ok: false, error: "Неверный selectedAngleId." };

  const angles = asAngles(candidate.angles);
  const slides = asSlides(candidate.slides);
  const prompts = asPrompts(candidate.prompts);
  const sceneMeta = asSceneMeta(candidate.sceneMeta);
  const images = asImages(candidate.images);
  const messages = asChatMessages(candidate.messages);
  const music = asMusic(candidate.music);

  if (!angles || !slides || !prompts || !sceneMeta || !images || !messages || !music) {
    return { ok: false, error: "Неверная структура массивов (angles/slides/prompts/sceneMeta/images/messages/music)." };
  }

  const state: StudioState = {
    provider,
    project,
    contentType,
    slideCount: slideCount as StudioState["slideCount"],
    mood: mood as StudioState["mood"],
    visualStyle: visualStyle as StudioState["visualStyle"],
    outputMode: outputMode as StudioState["outputMode"],
    autoGenerateImages: autoGenerateImages ?? false,
    ctaMode: ctaMode as StudioState["ctaMode"],
    website,
    triggerWord,
    customCta,
    topic,
    selectedAngleId,
    angles,
    slides,
    approved,
    prompts,
    sceneMeta,
    images,
    caption,
    music,
    messages
  };

  return { ok: true, state };
}
