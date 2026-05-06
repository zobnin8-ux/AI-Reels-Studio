import { getSystemPrompt, getCtaHint } from "@/lib/profiles";
import type { StudioState } from "@/lib/state";

export type SessionSnapshotForApi = Pick<
  StudioState,
  "topic" | "selectedAngleId" | "angles" | "slides" | "approved" | "imagePrompts" | "caption" | "music"
>;

export type SelectorSnapshotForApi = Pick<
  StudioState,
  "project" | "contentType" | "slideCount" | "ctaMode" | "website" | "triggerWord" | "customCta"
>;

function selectorsBlock(sel: SelectorSnapshotForApi) {
  const aspect =
    sel.contentType === "reels" ? "9:16 (1080×1920)" : "4:5 (1080×1350)";
  return `PROJECT: ${sel.project}
CONTENT FORMAT: ${sel.contentType} (${aspect})
SLIDE COUNT TARGET: ${sel.slideCount} (hint — not a hard cap on edits)
CTA MODE & RULES: ${getCtaHint(sel)}

Copy tone, pacing, warmth, and density follow the user's messages and the profile — there are no separate mood/visual dropdowns in the UI.`;
}

/** Full system prompt: profile + selectors + JSON contract + session snapshot (re-sent every request). */
export function buildDialogueSystemPrompt(
  selectors: SelectorSnapshotForApi,
  session: SessionSnapshotForApi
) {
  const profileSystem = getSystemPrompt(selectors);

  const sessionJson = JSON.stringify(
    {
      topic: session.topic,
      selectedAngleId: session.selectedAngleId,
      angles: session.angles,
      slides: session.slides,
      approved: session.approved,
      imagePrompts: session.imagePrompts,
      caption: session.caption,
      music: session.music
    },
    null,
    2
  );

  return `${profileSystem}

---
SESSION CONTEXT — HARD CONSTRAINTS FROM UI (only these; everything else comes from dialogue):
${selectorsBlock(selectors)}

---
CURRENT SESSION STATE (authoritative; update via statePatch only when user intent requires it):
${sessionJson}

---
RESPONSE FORMAT (mandatory — valid JSON only, single object):
{
  "reply": "<natural language for the user — markdown ok>",
  "statePatch": {
    "topic": string?,
    "angles": [{"id","label"}, ...]?,
    "selectedAngleId": string | null?,
    "slides": [{"id","title","text"}, ...]?,
    "approved": boolean?,
    "imagePrompts": [{"slideId","prompt"}, ...]?,
    "caption": string?,
    "music": {"queries":[],"recommendations":[],"avoid":[]}?
  }
}

CRITICAL RULES FOR imagePrompts:
- WHEN slides change (full rebuild OR any slide rewritten), include imagePrompts with one entry per slide (same slideIds, same order as slides).
- Each prompt MUST be in English, a single dense paragraph, 80–180 words.
- Each prompt MUST follow the active profile's IMAGE PROMPT SPEC (photographer references, film/lens, light, wardrobe, casting, environments, framing, mandatory closing line).
- Each prompt MUST end with the profile's mandatory closing line pattern, including vertical aspect: use "9:16" for reels and "4:5" for post when you name the aspect.
- If the user asks to rewrite ONE slide's image prompt only — return imagePrompts with only that slideId entry (the app merges by slideId).
- If the user asks to rewrite ALL image prompts — return a full imagePrompts array for every slide, keep slides unchanged.
- Do NOT contradict the profile TABOOS.
- Put imagePrompts in statePatch only when slides already exist in session (not for empty initial state).

RULES:
- HARD UI CONSTRAINTS (slide count target, reels/post format, CTA) override conflicting defaults; emotional tone and visual language are NOT chosen from removed dropdowns — derive them from conversation and script quality.
- Always return "reply" as what the user reads (creative partner tone).
- Infer intent from short messages ("эта", "эту", numbers): update selectedAngleId or refine slides accordingly.
- ANGLES / ВАРИАНТЫ: In "reply", list options only as **1. … 2. … 3. …** (Arabic numerals, max five). In statePatch.angles, ids must be **"1"** … **"5"** in order.
- When refining scenarios: EDIT current slides — preserve slide "id" when possible.
- Slide count: aim for SLIDE COUNT TARGET when generating full scenario; partial edits keep ids for untouched slides.
- Do NOT regenerate the entire scenario unless the user explicitly asks for a full redo.
- When user approves ("утверждаю", "approve", etc.): set approved: true.
- Respect CTA MODE: none / website / direct / custom per SESSION CONTEXT.
- Caption: statePatch.caption ONLY when the user explicitly asks for caption / подпись in this turn.
- Music: statePatch.music ONLY when the user explicitly asks for music / soundtrack in this turn.
- If nothing structural changes, omit statePatch or use {}.
- ON FIRST FULL SCRIPT: when user approves an angle and you author full slides, ALWAYS include matching imagePrompts (one per slide).
- ON SLIDE EDITS: if any slide text changes, regenerate that slide's imagePrompt to match.
- ON COSMETIC / SCENE TWEAKS ("слайд 3 теплее", "меньше людей в кадре 5", "в кафе"): UPDATE only that slide's imagePrompts entry; do NOT touch other slides' prompts unless asked.
- ON FULL VISUAL REWRITE: if user says "перепиши все промпты картинок" — regenerate all imagePrompts, slides unchanged.
- NEVER author imagePrompts that contradict the profile's TABOOS.
- ALWAYS follow IMAGE PROMPT SPEC of the active project.
- imagePrompts go in statePatch ONLY when slides exist.

`;

}
