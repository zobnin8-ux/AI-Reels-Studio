import type {
  Mood,
  OlgatripSceneMeta,
  PoslenegoSceneMeta,
  ProjectId,
  SceneMetaEntry,
  VisualStyle,
  ZobninSceneMeta
} from "@/lib/state";

/**
 * Сборка финального image prompt для OpenAI Image API по ТЗ:
 * MASTER_PROMPT + ACCOUNT_WORLD + TONE_MAP + VISUAL_STYLE_MAP + interpretSlide + COMPOSITION_RULES + NEGATIVE_RULES.
 * Опционально: косметическое уточнение пользователя (не часть ТЗ, добавляется в конец).
 */

export type BuildImagePromptInput = {
  account: ProjectId;
  tone: Mood;
  visualStyle: VisualStyle;
  slideText: string;
  cosmeticHint?: string;
  /** Краткие якоря из sceneMeta (форма зависит от account), не дублировать буквальный смысл slideText. */
  sceneAnchors?: string;
};

function formatPoslenegoSceneAnchors(m: PoslenegoSceneMeta): string {
  return [
    `Scene type: ${m.scene_type} (mood/moment, not literal text illustration).`,
    `Environment: ${m.environment} — keep minimal, realistic, physically coherent.`,
    `Visual focus: ${m.visual_focus} — frame accordingly; no staging or posing.`,
    "Avoid cars, roads, and driving unless the slide text absolutely requires it."
  ].join(" ");
}

function formatZobninSceneAnchors(m: ZobninSceneMeta): string {
  return [
    `Human moment: ${m.human_moment} — emotional beat (confusion, realization, tension); cinematic documentary, not explanatory.`,
    `AI interaction: ${m.ai_interaction} — person interacting with AI work (typing, reading, reacting); always a real human in frame.`,
    `Framing: ${m.framing} — prefer close-ups, screen light on face, hands on keyboard, over-shoulder, silhouette in dark room / office / night.`,
    `Environment: ${m.environment} — physically coherent real space (office, night interior, desk).`,
    `Visual focus: ${m.visual_focus} — where the eye lands (face, hands, screen glow, posture).`,
    "FORBIDDEN: UI mockups, wireframes, dashboards as graphics, diagrams, flowcharts, abstract blocks, node graphs, generic glowing tech backgrounds.",
    "FORBIDDEN: stock «tech aesthetic» without a human; illustrations that explain the system instead of a lived moment.",
    "NO readable text, UI labels, logos, letters, or captions on screen — human-centered photographic realism only."
  ].join(" ");
}

function formatOlgatripSceneAnchors(m: OlgatripSceneMeta): string {
  return [
    `Scene type: ${m.scene_type} — specific lived moment, documentary candid feel.`,
    `Environment: ${m.environment} — physically coherent space; do not default to car, road, or driving.`,
    `Social context: ${m.social_context} — relationship to others in frame without posing.`,
    `Visual focus: ${m.visual_focus} — no camera-facing subjects, no influencer staging.`,
    `Light: ${m.light_type} — vary palette across slides; not always beige or golden hour.`,
    "Avoid repeating the same environment or the coffee-table-conversation cliché across slides.",
    "No text, logos, captions, or readable elements — realistic travel atmosphere only."
  ].join(" ");
}

/** Текстовый блок для image API из SceneMetaEntry (косвенно; без буквального текста на кадре). */
export function formatSceneAnchorsFromMeta(m: SceneMetaEntry): string {
  if ("human_moment" in m && "ai_interaction" in m) return formatZobninSceneAnchors(m);
  if ("social_context" in m && "light_type" in m) return formatOlgatripSceneAnchors(m);
  return formatPoslenegoSceneAnchors(m as PoslenegoSceneMeta);
}

/** БЛОК 1 — подстановка {{account}}, {{tone}}, {{visualStyle}}, {{slideText}} в INPUT. */
const MASTER_PROMPT_TEMPLATE = `You are a senior art director creating high-end Instagram Reel slide backgrounds.

INPUT:
Account: {{account}}
Tone: {{tone}}
Visual Style: {{visualStyle}}
Slide Text: {{slideText}}

INTERPRETATION HIERARCHY:

ACCOUNT defines the world and allowed environments
TONE defines lighting, emotional atmosphere, contrast, density
STYLE defines visual execution and composition

CRITICAL:

Tone MUST override default emotional bias of the account
Do NOT default to sadness or darkness unless explicitly required by Tone

ART DIRECTION RULES:

Do NOT illustrate the text literally; translate the feeling and moment
Prefer subtle, real photographed scenes over obvious metaphors
Keep minimalism; avoid visual clutter
Composition must feel intentional and editorial

IMAGE CONSTRAINTS:

NO text, letters, captions, logos, UI, or readable signs
Realistic photography look (not "AI art")
Use negative space for later text overlay
Balanced asymmetry and depth

OUTPUT:
Return ONLY a clean, detailed image generation prompt. No explanations.`;

/** БЛОК 2 — дословно по ТЗ (строки без префиксов). */
const ACCOUNT_WORLD: Record<ProjectId, string> = {
  poslenego:
    "intimate personal environments, apartments, windows, quiet streets, solitude, transitional emotional states, morning/evening light, no glamour, no crowds, no tourism scenes",
  olgatrip:
    "authentic travel scenes, small groups, cities, streets, cafes, water, natural light, sense of movement and presence, no mass tourism, no crowds, no bus tours",
  zobnin:
    "human-centered documentary scenes: real people using AI at work — typing, reading outputs, reacting; moments of confusion, realization, tension; cinematic framing — close-ups, face lit by screen, dark room, office, night, desk; photorealistic; never diagrams or UI chrome as the subject"
};

/** БЛОК 3 — дословно по ТЗ. */
const TONE_MAP: Record<ProjectId, Record<Mood, string>> = {
  poslenego: {
    positive:
      "soft natural light, emotional relief, open space, calm clarity, feeling of release, lightness without euphoria",
    soft: "warm tones, gentle light, intimacy, vulnerability, soft gradients, quiet atmosphere",
    provocative:
      "psychological tension, asymmetry, unusual framing, subtle discomfort",
    aggressive: "harsh contrast, deep shadows, tight framing, emotional pressure, sharp edges",
    neutral: "balanced light, realism, documentary feel, low emotional bias"
  },
  olgatrip: {
    positive:
      "bright natural light, open spaces, movement, freshness, sense of freedom and decision",
    soft: "warm tones, golden hour, soft shadows, cozy details, feminine calm",
    provocative:
      "contrast between freedom and привычка, slight tension in framing, sense of decision point",
    aggressive: "anti-tourism contrast, sharp clarity, no crowd, decisive framing",
    neutral: "travel realism, city details, observational tone"
  },
  zobnin: {
    positive:
      "quiet clarity, subtle relief on the face, controlled light, sense of breakthrough without spectacle",
    soft: "soft screen spill on skin, shallow depth, intimate workspace, calm concentration",
    provocative: "uncomfortable truth in posture or stare, asymmetric crop, tension between face and glow",
    aggressive: "harsh screen-to-shadow contrast, tight crop, fatigue or friction readable in the body",
    neutral: "documentary office/night realism, neutral grading, observational distance, no staged grin"
  }
};

/** БЛОК 4 — дословно по ТЗ; portraLifestyle отдельным кейсом. */
const VISUAL_STYLE_MAP: Record<VisualStyle, string> = {
  darkBrutal: "dark brutalist aesthetic, near-black base, high contrast, bold aggressive composition",
  lightMinimal: "ultra minimal light composition, lots of air, soft tones, clean hierarchy",
  brightPositive: "bright energetic palette, controlled vibrant accents, high readability",
  portraLifestyle:
    "realistic lifestyle photography, natural light, candid moments, soft film look (portra-like), human presence allowed but not posed",
  editorial:
    "high-end editorial photography, strong composition, whitespace, premium magazine feel",
  tech: "futuristic tech aesthetic, grid-based layout, precise alignment, subtle glow accents"
};

/** БЛОК 6 — дословно. */
const COMPOSITION_RULES =
  "use cinematic composition, intentional framing, asymmetry, depth, and clear negative space for text overlay";

/** БЛОК 7 — дословно. */
const NEGATIVE_RULES =
  "no text, no letters, no typography, no captions, no logos, no UI, no watermarks, no readable signs, no clutter";

/** БЛОК 5 — дословно (кроме экранирования кавычек внутри текста слайда). */
function interpretSlide(text: string): string {
  const t = text.replace(/"/g, '\\"');
  return `
Create a scene that expresses the emotional meaning of:
"${t}"

Do NOT illustrate literally. Focus on mood, light, and moment.
`.trimStart();
}

function interpolateMaster(
  account: ProjectId,
  tone: Mood,
  visualStyle: VisualStyle,
  slideText: string
): string {
  const st = slideText.trim() || "";
  return MASTER_PROMPT_TEMPLATE.replace(/\{\{account\}\}/g, account)
    .replace(/\{\{tone\}\}/g, tone)
    .replace(/\{\{visualStyle\}\}/g, visualStyle)
    .replace(/\{\{slideText\}\}/g, st);
}

/**
 * БЛОК 8 — сборка как в ТЗ; опционально одна добавка для ручных косметических правок в UI.
 */
export function buildImagePrompt(input: BuildImagePromptInput): string {
  const { account, tone, visualStyle, slideText, cosmeticHint, sceneAnchors } = input;

  const core = [
    interpolateMaster(account, tone, visualStyle, slideText),
    ACCOUNT_WORLD[account],
    TONE_MAP[account][tone],
    VISUAL_STYLE_MAP[visualStyle],
    interpretSlide(slideText),
    COMPOSITION_RULES,
    NEGATIVE_RULES
  ].join("\n\n");

  let out = core.replace(/\n{3,}/g, "\n\n").trim();

  const anchors = sceneAnchors?.trim();
  if (anchors) {
    out += `\n\nVISUAL ANCHORS (internal — guide composition and focus; do not illustrate on-slide text literally):\n${anchors}`;
  }

  const hint = cosmeticHint?.trim();
  if (hint) {
    out += `\n\nUSER REFINEMENT (cosmetic only):\n${hint}`;
  }

  return out;
}

/** Текст слайда для поля slideText: заголовок + тело. */
export function slideBodyForImagePrompt(slide: { title: string; text: string }): string {
  const t = slide.title.trim();
  const b = slide.text.trim();
  if (t && b) return `${t}\n\n${b}`;
  return t || b || "";
}
