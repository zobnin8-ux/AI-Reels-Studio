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
    "OlgaTrip — closed mature female space ONLY: adult women together for inner reset; never generic travel stock or postcard landscape as hero.",
    "People casting (mandatory in prompt wording): ONLY women, age strictly 35–65 (prefer 35–45); NO men in frame or reflections/crowds; NO children, teenagers, students, young girls; NO mixed groups, couples, or families; same woman typology and calm energy across slides.",
    `Scene beat: ${m.scene_type} — internal shift along reel arc (tension → easing → presence → softness); quiet inner states: pause, breath, relief, soft attention.`,
    `Environment: ${m.environment} — place supports the woman, never replaces her as subject.`,
    `Social context: ${m.social_context} — real calm presence; not influencers, not staged tourists.`,
    `Visual focus / framing: ${m.visual_focus}, ${m.light_type}. Prefer face visible — three-quarter front, profile with readable face, or gentle engagement with lens; back view only occasionally and deliberately when anchor calls for it.`,
    "Camera & viewer: most frames must NOT be anonymous backs-only; viewer stays emotionally included. Specify angle explicitly in generation intent (e.g. three-quarter front view, profile with visible cheekbone).",
    "Forbidden: travel brochure vistas as main subject, Instagram vacation gloss, exaggerated posing, fake performative emotion.",
    "In describing subjects NEVER use vague nouns alone ('woman', 'traveler', 'people'); always tie explicit age: 'a 48-year-old woman', 'women aged 45–60 walking slowly'.",
    "No text, logos, captions, or readable elements on frame."
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
    "OlgaTrip — mature adult women only (35–65, prefer 35–45), traveling together as a quiet closed female circle for inner reset; warm documentary realism, feminine calm, emotionally inclusive framing (faces and 3/4 views prioritized); never postcard landscapes as sole hero; locations secondary to emotional interior state",
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
      "gentle daylight relief on faces, subtle openness in posture, quiet optimism without spectacle",
    soft: "breathable air in frame, soft shadows on skin, intimate pause, warmth without gloss",
    provocative:
      "quiet friction held in the face or hands, restrained tension turning toward ease, never melodrama",
    aggressive:
      "clear sober light, emotional honesty without harsh spectacle; woman still clearly readable as subject",
    neutral:
      "documentary female journey realism; observational but connected — viewer shares presence, not scenery brochure"
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
