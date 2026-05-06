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

function asImagePrompts(x: unknown): StudioState["imagePrompts"] | null {
  if (!Array.isArray(x)) return null;
  const out: StudioState["imagePrompts"] = [];
  for (const p of x) {
    if (!isRecord(p)) return null;
    const slideId = asString(p.slideId);
    const prompt = asString(p.prompt);
    const manualOverride =
      p.manualOverride === undefined ? undefined : asString(p.manualOverride) ?? undefined;
    if (!slideId || prompt === null) return null;
    out.push({ slideId, prompt, manualOverride });
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

/** Нормализует slideCount из старых сессий (10/12 → ближайший 5/7/9). */
function normalizeSlideCount(n: number | null): StudioState["slideCount"] | null {
  if (n === 5 || n === 7 || n === 9) return n;
  if (n === 10 || n === 12) return 9;
  return null;
}

export function parseSessionImport(raw: unknown):
  | { ok: true; state: StudioState }
  | { ok: false; error: string } {
  let candidate: unknown = raw;

  if (isRecord(raw) && raw.v === SESSION_EXPORT_VERSION && "state" in raw) {
    candidate = raw.state;
  }

  if (!isRecord(candidate)) return { ok: false, error: "JSON должен быть объектом." };

  const provider = asString(candidate.provider);
  const project = asString(candidate.project);
  const contentType = asString(candidate.contentType);
  const slideCountRaw = asNumber(candidate.slideCount);
  const slideCount = normalizeSlideCount(slideCountRaw);
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
  if (slideCount === null) return { ok: false, error: "Неверный slideCount (ожидается 5, 7 или 9)." };
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
  const images = asImages(candidate.images);
  const messages = asChatMessages(candidate.messages);
  const music = asMusic(candidate.music);

  let imagePrompts: StudioState["imagePrompts"];
  if (candidate.imagePrompts === undefined) {
    imagePrompts = [];
  } else {
    const parsed = asImagePrompts(candidate.imagePrompts);
    if (!parsed) return { ok: false, error: "Неверный imagePrompts." };
    imagePrompts = parsed;
  }

  if (!angles || !slides || !images || !messages || !music) {
    return { ok: false, error: "Неверная структура массивов (angles/slides/images/messages/music)." };
  }

  const state: StudioState = {
    provider,
    project,
    contentType,
    slideCount,
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
    imagePrompts,
    images,
    caption,
    music,
    messages
  };

  return { ok: true, state };
}
