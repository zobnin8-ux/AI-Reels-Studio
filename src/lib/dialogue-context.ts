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
  return `CONTENT FORMAT: ${sel.contentType} (${aspect})
SLIDE COUNT TARGET: ${sel.slideCount}
MOOD/TONE: ${sel.mood}
VISUAL STYLE: ${sel.visualStyle}
OUTPUT MODE (text on images vs separate): ${sel.outputMode}
CTA MODE & RULES: ${getCtaHint(sel)}
CUSTOM SYSTEM (project Custom only): ${sel.customSystemPrompt.slice(0, 500)}${sel.customSystemPrompt.length > 500 ? "…" : ""}`;
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
- Always return "reply" as what the user reads (creative partner tone).
- Infer intent from short messages ("эта", "эту", numbers): update selectedAngleId or refine slides accordingly.
- When refining scenarios: EDIT the current slides — preserve slide "id" fields whenever possible; keep structure unless the user asks to change structure or slide count.
- Slide count: aim for exactly SLIDE COUNT TARGET slides when generating/rebuilding full scenario; if user asks partial edits, keep existing ids for untouched slides.
- Do NOT regenerate the entire scenario from scratch unless the user explicitly asks for a full redo.
- When user approves ("утверждаю", "approve", etc.): set approved: true.
- When user asks for per-slide image prompts: fill "prompts" aligned with current slides (slideId must match slide id).
- Caption / music: fill statePatch when user asks; caption must not blindly repeat slide body text.
- If nothing structural changes, omit statePatch or use {}.
- When the user asks for image prompts for any slide, you MUST also put the full "prompts" array in statePatch (one entry per slide, slideId must match), not only text in "reply" — the right panel reads state, not the chat text.

`;

}
