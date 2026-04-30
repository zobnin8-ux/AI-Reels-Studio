import { getSystemPrompt, getCtaHint } from "@/lib/profiles";
import type { StudioState } from "@/lib/state";

export type SessionSnapshotForApi = Pick<
  StudioState,
  | "topic"
  | "selectedAngleId"
  | "angles"
  | "slides"
  | "approved"
  | "prompts"
  | "caption"
  | "music"
>;

export type SelectorSnapshotForApi = Pick<
  StudioState,
  | "project"
  | "customSystemPrompt"
  | "contentType"
  | "slideCount"
  | "mood"
  | "visualStyle"
  | "outputMode"
  | "ctaMode"
  | "website"
  | "triggerWord"
  | "customCta"
>;

function selectorsBlock(sel: SelectorSnapshotForApi) {
  const aspect = sel.contentType === "reels" ? "9:16" : "1:1";
  const customExtra =
    sel.project === "custom"
      ? `\nCUSTOM SYSTEM (project Custom): ${sel.customSystemPrompt.slice(0, 500)}${sel.customSystemPrompt.length > 500 ? "…" : ""}`
      : "";
  return `PROJECT: ${sel.project}
CONTENT FORMAT: ${sel.contentType} (${aspect})
SLIDE COUNT TARGET: ${sel.slideCount}
MOOD/TONE: ${sel.mood}
VISUAL STYLE: ${sel.visualStyle}
OUTPUT MODE (text on images vs separate): ${sel.outputMode}
CTA MODE & RULES: ${getCtaHint(sel)}${customExtra}`;
}

function olgatripRules(project: SelectorSnapshotForApi["project"]) {
  if (project !== "olgatrip") return "";
  return `
OLGATRIP / CASHMERE COAST (always respect with this project):
- Scenario beats for Reels: align slide flow with 0–3s hook → 3–10 visual → 10–25 micro-story → 25–35 soft close (total ~20–35s); slide titles may note seconds.
- Full-package answers in "reply": use sections IDEA → HOOK → SCRIPT (with second ranges) → VISUAL PROMPTS (English only) → CAPTION → MUSIC MOOD.
- statePatch.prompts: English prompts; visual tone = beige/cashmere/sand, golden hour, muted palette; no selfie / no direct eye contact / no neon or gimmick effects — unless user overrides selectors.
- Copy quality: if it sounds like generic travel or hard sell, rewrite; use concrete moments, not adjectives from the forbidden list in the profile.
`;
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
      prompts: session.prompts,
      caption: session.caption,
      music: session.music
    },
    null,
    2
  );

  return `${profileSystem}

---
SESSION CONTEXT SELECTORS (must respect on every answer):
${selectorsBlock(selectors)}
${olgatripRules(selectors.project)}

---
CURRENT SESSION STATE (authoritative; update via statePatch only when user intent requires it):
${sessionJson}

---
RESPONSE FORMAT (mandatory — valid JSON only, single object):
{
  "reply": "<natural language for the user — markdown ok>",
  "statePatch": {
    /* optional; include ONLY keys that change */
    "topic": string?,
    "angles": [{"id","label"}, ...]?,
    "selectedAngleId": string | null?,
    "slides": [{"id","title","text"}, ...]?,
    "approved": boolean?,
    "prompts": [{"slideId","prompt"}, ...]?,
    "caption": string?,
    "music": {"queries":[],"recommendations":[],"avoid":[]}?
  }
}

RULES:
- SELECTORS HAVE HIGHEST PRIORITY and OVERRIDE project-profile defaults whenever they conflict.
- Always return "reply" as what the user reads (creative partner tone).
- Infer intent from short messages ("эта", "эту", numbers): update selectedAngleId or refine slides accordingly.
- When refining scenarios: EDIT the current slides — preserve slide "id" fields whenever possible; keep structure unless the user asks to change structure or slide count.
- Slide count: aim for exactly SLIDE COUNT TARGET slides when generating/rebuilding full scenario; if user asks partial edits, keep existing ids for untouched slides.
- Do NOT regenerate the entire scenario from scratch unless the user explicitly asks for a full redo.
- When user approves ("утверждаю", "approve", etc.): set approved: true.
- Respect OUTPUT MODE strictly:
  - textInImages: slides should be concise on-screen copy (short lines), not long narration paragraphs.
  - textSeparate: keep slide text as structure/idea; avoid writing heavy on-image wording.
  - both: provide concise on-image line + supporting context in slide text.
- Respect CTA MODE strictly:
  - none: do not add any CTA in slides/caption.
  - website: CTA must use the selected website.
  - direct: CTA must use the selected trigger word.
  - custom: CTA must use customCta.
- Respect VISUAL STYLE in all prompt-generation tasks; if user requests prompt rewrite, keep same visual style unless user asks to change it.
- Typography / fonts (for prompt tasks):
  - If OUTPUT MODE is textInImages or both, image prompts MUST specify a typography system: font family suggestion, weight, size hierarchy, alignment, and safe margins.
  - Prefer clean, widely available fonts: Inter / SF Pro / Helvetica Neue for tech/editorial, and a restrained serif (e.g., Playfair/Georgia) only when VISUAL STYLE is editorial and user wants it.
  - Text must be legible: high contrast, minimal words per line, avoid tiny captions.
  - If slide text or on-image copy is in Russian (Cyrillic): keep authentic Cyrillic in slide bodies and in image prompts — do NOT Latinize/transliterate Russian unless the user asks. Image generators struggle with text; spell short on-image phrases clearly and repeat the exact Cyrillic phrase in the prompt when needed.
- When user asks for per-slide image prompts: fill "prompts" aligned with current slides (slideId must match slide id).
- Caption: fill statePatch.caption when the user asks for a caption / подпись.
- Music: put statePatch.music ONLY when the user explicitly asks for music / soundtrack / треки / подбор музыки. Never fill "music" from scenario slides, numbered slide titles, or creative script content. If the user did not ask for music this turn, omit "music" entirely from statePatch.
- If nothing structural changes, omit statePatch or use {}.
- When the user asks for image prompts for any slide, you MUST also put the full "prompts" array in statePatch (one entry per slide, slideId must match), not only text in "reply" — the right panel reads state, not the chat text.
- When the user asks to improve/refine/rewrite a slide image prompt ("улучши промпт", "перепиши промпт для кадра N"), you MUST update statePatch.prompts for that slideId with the new prompt text.

`;

}
