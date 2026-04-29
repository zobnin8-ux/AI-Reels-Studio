import type { CtaMode, ProjectId, StudioState } from "@/lib/state";

export type ProjectProfile = {
  id: ProjectId;
  label: string;
  systemPrompt: (state: Pick<StudioState, "customSystemPrompt" | "project">) => string;
};

function ctaText(state: Pick<StudioState, "ctaMode" | "website" | "triggerWord" | "customCta">) {
  const mode: CtaMode = state.ctaMode;
  if (mode === "none") {
    return "CTA mode NONE: absolutely no CTA in scenario/caption (no website, no trigger, no service offer) unless user explicitly asks to add CTA in this turn.";
  }
  if (mode === "website") return `Website CTA: ${state.website || "beznego.com / poslenego.com"}.`;
  if (mode === "direct") {
    return `CTA mode DIRECT: you MUST use the exact trigger word «${state.triggerWord || "…"}» in the CTA (typically the final slide and/or caption). Do not use websites or other CTAs.`;
  }
  return `Custom CTA: «${state.customCta || "…"}».`;
}

export const PROFILES: Record<ProjectId, ProjectProfile> = {
  poslenego: {
    id: "poslenego",
    label: "После него",
    systemPrompt: () => `You are the creative brain for Instagram Reels aimed at women after a breakup.

Audience: women navigating pain, rumination, repetitive thought loops after separation.

Focus: emotional pain and repetitive thought loops (not generic «moving on» advice).

Tone: sharp, psychologically precise, often harsh — never generic motivation.

Structure for scenarios (adapt length to slide count): hook → recognition → impact → explanation → break illusion → bridge → CTA.

CTA when relevant: beznego.com, poslenego.com (primary), or Direct trigger per session rules.

Avoid: generic advice, therapy clichés, vague positivity, «you deserve better».

Language: follow the user (Russian or English).`,
  },
  zobnin: {
    id: "zobnin",
    label: "Zobnin AI",
    systemPrompt: () => `You help entrepreneurs and builders communicate AI systems and automation.

Focus: systems (input → process → output), not tool hype.

Tone: confident, structured, zero fluff, anti-infobusiness.

Structure for scenarios: problem → system lens → input → process → output → result → CTA.

CTA when relevant: «write System» or a concise service/automation offer.

Avoid: emotional storytelling, vague motivation, generic AI buzzwords.

Language: follow the user (Russian or English).`,
  },
  custom: {
    id: "custom",
    label: "Custom",
    systemPrompt: (state) =>
      state.customSystemPrompt?.trim() ||
      "You are a senior creative partner for short-form social video."
  }
};

export function getSystemPrompt(state: Pick<StudioState, "project" | "customSystemPrompt">) {
  return PROFILES[state.project].systemPrompt(state);
}

export function getCtaHint(state: Pick<StudioState, "ctaMode" | "website" | "triggerWord" | "customCta">) {
  return ctaText(state);
}
