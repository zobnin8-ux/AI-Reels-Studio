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
  const aspect =
    sel.contentType === "reels" ? "9:16 (1080×1920)" : "4:5 (1080×1350)";
  return `PROJECT: ${sel.project}
CONTENT FORMAT: ${sel.contentType} (${aspect})
SLIDE COUNT TARGET: ${sel.slideCount}
MOOD/TONE: ${sel.mood}
VISUAL STYLE: ${sel.visualStyle}
OUTPUT MODE (text on images vs separate): ${sel.outputMode}
CTA MODE & RULES: ${getCtaHint(sel)}`;
}

function olgatripRules(project: SelectorSnapshotForApi["project"]) {
  if (project !== "olgatrip") return "";
  return `
OLGATRIP — booster (profile above is canonical):
- SELECTORS + SESSION STATE win on conflicts; SCENE DIVERSITY ENGINE + anti-repetition always apply.
- Full-package "reply": IDEA → HOOK → SCRIPT (0–3 / 3–10 / 10–25 / 25–35) → CAPTION → MUSIC MOOD; never image prompts for backgrounds.
- statePatch.prompts: short cosmetic hints only on explicit user ask for regeneration tweaks.
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
- Respect OUTPUT MODE strictly for COPY (slides/caption), not for image pipeline:
  - textInImages: slides should be concise on-screen copy (short lines), not long narration paragraphs.
  - textSeparate: keep slide text as structure/idea; avoid writing heavy on-image wording.
  - both: provide concise on-image line + supporting context in slide text.
- Respect CTA MODE strictly:
  - none: do not add any CTA in slides/caption.
  - website: CTA must use the selected website.
  - direct: CTA must use the selected trigger word.
  - custom: CTA must use customCta.
- Image backgrounds are NOT authored here: OpenAI Image API uses slide text + PROJECT + MOOD/TONE + VISUAL STYLE in a fixed app-side template. Do not invent full English image prompts unless the user explicitly asks for short cosmetic refinement lines for regeneration.
- Caption: fill statePatch.caption when the user asks for a caption / подпись.
- Music: put statePatch.music ONLY when the user explicitly asks for music / soundtrack / треки / подбор музыки. Never fill "music" from scenario slides, numbered slide titles, or creative script content. If the user did not ask for music this turn, omit "music" entirely from statePatch.
- If nothing structural changes, omit statePatch or use {}.
- When the user asks for cosmetic tweaks for a slide frame ("теплее", "меньше людей", "улучши промпт кадра N" as refinement hints), put a SHORT line in statePatch.prompts for that slideId (slideId must match). These are optional notes for regeneration, not full image prompts.
- When the user asks to refine a slide tweak from chat, update statePatch.prompts for that slideId with the short new refinement text.

`;

}
