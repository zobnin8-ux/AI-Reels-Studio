import type { ContentType, ImagePrompt, ProjectId } from "@/lib/state";

const NO_TEXT_PHRASES = ["no text", "no letters", "no typography", "no captions", "no logos", "no readable"];

const ASPECT_PHRASES = {
  reels: ["9:16", "vertical 9:16"],
  post: ["4:5", "vertical 4:5"]
} as const;

/**
 * Смягчает типичные формулировки, из‑за которых gpt-image даёт ложные moderation_blocked
 * (усталость, драма, ночь, алкоголь и т.д.). Только для Zobnin — у других профилей другая эстетика.
 */
export function softenImagePromptForModeration(prompt: string): string {
  let s = prompt;
  const pairs: [RegExp, string][] = [
    // OPENAI MODERATION HYGIENE safety net (profile zobnin §7.11) — prefer clean prompts from the model
    [/\bnot\s+stressed,?\s*just\s+evaluating\b/gi, "composed and attentive"],
    [/\bnot\s+frustrated,?\s*not\s+pleased,?\s*just\s+assessing\b/gi, "calm and focused, mid-thought"],
    [/\bno\s+longer\s+overwhelmed\b/gi, "focused and present"],
    [/\bwithout\s+anxiety\s+or\s+tension\b/gi, "calm and steady"],
    [/\bhand\s+on\s+(his|her|their|the)?\s*temple\b/gi, "hand resting near the desk edge"],
    [/\brubbing\s+(his|her|their)?\s*eyes\b/gi, "looking at the screen"],
    [/\btouching\s+(his|her|their)?\s*forehead\b/gi, "upright posture at the desk"],
    [/\bhand\s+on\s+chin\s+in\s+worry\b/gi, "hand resting on the desk"],
    [/\bfingers\s+pressed\s+to\s+(his|her|their)?\s*face\b/gi, "fingers on the keyboard"],
    [/\bhead\s+in\s+hands\b/gi, "seated upright at the desk"],
    [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+man\b/gi, "a man in his early forties"],
    [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+woman\b/gi, "a woman in her early forties"],
    [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+(guy|male)\b/gi, "a man in his early forties"],
    [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+(gal|female)\b/gi, "a woman in her early forties"],
    [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+(person|professional|executive)\b/gi, "an adult professional"],
    [/\bscrutinizing\b/gi, "looking closely at"],
    [/\bstudying\s+intently\b/gi, "reading carefully"],
    [/\bdissecting\b/gi, "working through"],
    [/\bskeptical\b/gi, "thoughtful"],
    [/\bsuspicious\b/gi, "curious"],
    [/\bassessing\b/gi, "considering"],
    [/\bevaluating\b/gi, "working through"],
    [/\bexamining\b/gi, "looking at"],
    [/\banalyzing\b/gi, "reviewing"],
    [/\bjudging\b/gi, "considering"],
    [/\bweighing\b/gi, "considering"],
    [/\bdoubtful\b/gi, "thoughtful"],
    [/\bcritical (expression|look|gaze)\b/gi, "thoughtful $1"],
    [/\bpiercing (gaze|look|eyes)\b/gi, "attentive $1"],
    [/\bpointed (expression|look|gaze)\b/gi, "direct $1"],
    [/\bintense\b/gi, "steady"],
    [/\binterrogat\w*\b/gi, "discussion"],
    [/\bsurveillance\b/gi, "overview"],
    [/\binvestigating\b/gi, "reviewing"],
    [/\bconfrontation\b/gi, "conversation"],
    [/\bSteve Jobs\b/gi, "a tech executive"],
    [/\bSheryl Sandberg\b/gi, "an executive"],
    [/\bPatti Smith\b/gi, "a musician"],
    [/\blate at night\b/gi, "mid-morning"],
    [/\bpast midnight\b/gi, "late morning"],
    [/\bdeep into the night\b/gi, "mid-morning"],
    [/\b3\s*am\b/gi, "10am"],
    [/\b2\s*am\b/gi, "10am"],
    [/\bdimly lit\b/gi, "sunlit"],
    [/\bdark room\b/gi, "bright office"],
    [/\bdark office\b/gi, "daylit office"],
    [/\bnight office\b/gi, "daytime office"],
    [/\bgloomy\b/gi, "bright"],
    [/\bsingle desk lamp\b/gi, "large window"],
    [/\bscreen[- ]?glow on (the )?face\b/gi, "soft daylight on face"],
    [/\bmonitor light on (the )?face\b/gi, "window light on face"],
    [/\bexhaust(ed|ion|ing)?\b/gi, "composed"],
    [/\bfrustrat(ed|ion|ing)?\b/gi, "thoughtful"],
    [/\boverwhelm(ed|ing)?\b/gi, "focused"],
    [/\bstress(ed|ful|ing)?\b/gi, "attentive"],
    [/\bweary\b/gi, "alert"],
    [/\btired eyes\b/gi, "clear eyes"],
    [/\btired\b/gi, "composed"],
    [/\bangr(y|ily)\b/gi, "calm"],
    [/\bfuriou(s|ly)\b/gi, "steady"],
    [/\banxious\b/gi, "calm"],
    [/\banxiety\b/gi, "focus"],
    [/\bdistress(ed|ing)?\b/gi, "neutral poise"],
    [/\bdesperate\b/gi, "intent"],
    [/\bcrying\b/gi, "thinking quietly"],
    [/\btears\b/gi, ""],
    [/\bsobbing\b/gi, ""],
    [/\bpanic\b/gi, "consideration"],
    [/\bscared\b/gi, "composed"],
    [/\btrauma\b/gi, ""],
    [/\babuse(d|sive)?\b/gi, ""],
    [/\bviolence\b/gi, ""],
    [/\bviolent\b/gi, ""],
    [/\bargument\b/gi, "discussion"],
    [/\barguing\b/gi, "talking professionally"],
    [/\bfight(ing)?\b/gi, "collaboration"],
    [/\bhostile\b/gi, "professional"],
    [/\btense atmosphere\b/gi, "calm atmosphere"],
    [/\btense\b/gi, "relaxed"],
    [/\btension\b/gi, "ease"],
    [/\bconflict(ed|ing)?\b/gi, "dialogue"],
    [/\bintimate\b/gi, "professional"],
    [/\bseductive\b/gi, ""],
    [/\bsexy\b/gi, ""],
    [/\bnude|naked\b/gi, "fully dressed"],
    [/\bwine\b/gi, "tea"],
    [/\bbeer\b/gi, "sparkling water"],
    [/\bwhiskey|whisky|vodka\b/gi, "coffee"],
    [/\bcocktail\b/gi, "coffee"],
    [/\balcohol(ic)?\b/gi, "drink"],
    [/\bdrunk\b/gi, ""],
    [/\bsuffering\b/gi, ""],
    [/\bsuffers\b/gi, "works"],
    [/\bsuffered\b/gi, "handled"],
    [/\bsuffer\b/gi, "manage"],
    [/\bpain(ful|fully)?\b/gi, "effort"],
    [/\bgrim\b/gi, "neutral"],
    [/\bbleak\b/gi, "minimal"],
    [/\bhopeless\b/gi, "measured"],
    [/\bburnout\b/gi, "steady work"],
    [/\bclenched\b/gi, "relaxed"],
    [/\bfurrowed brow\b/gi, "gentle focus"],
    [/\bbad news\b/gi, "routine update"],
    [/\bsexual\b/gi, ""],
    [/\brage\b/gi, ""],
    [/\bhorror\b/gi, ""],
    [/\bterrified\b/gi, "composed"],
    [/\bshouting\b/gi, "speaking"],
    [/\bscreaming\b/gi, ""],
    [/\bwasted time\b/gi, "time allocation"],
    [/\bwasted\b/gi, "spent"],
    [/\bhopelessly\b/gi, "carefully"],
    [/\bhelpless\b/gi, "attentive"],
    [/\bdepressed\b/gi, "reflective"],
    [/\bsuicid(e|al)\b/gi, ""],
    [/\btraumatized\b/gi, ""],
    [/\bcooling coffee\b/gi, "mug on desk"],
    [/\bstale coffee\b/gi, "coffee mug"]
  ];
  for (const [re, rep] of pairs) {
    s = s.replace(re, rep);
  }
  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .trim();
  return s;
}

/** Готовит финальную строку под OpenAI Image: промпт от модели + минимальные доп. ограничения при отсутствии. */
export function sanitizeForOpenAIImage(
  rawPrompt: string,
  contentType: ContentType,
  project?: ProjectId
): string {
  let out = rawPrompt.trim();
  if (project === "zobnin") {
    out = softenImagePromptForModeration(out);
  }

  const lower = out.toLowerCase();
  const hasNoText = NO_TEXT_PHRASES.some((p) => lower.includes(p));
  if (!hasNoText) {
    out += "\n\nNo text, letters, captions, logos, or readable signs in the frame.";
  }

  const aspectKeywords = ASPECT_PHRASES[contentType];
  const hasAspect = aspectKeywords.some((p) => lower.includes(p.toLowerCase()));
  if (!hasAspect) {
    const aspect = contentType === "reels" ? "9:16" : "4:5";
    out += `\n\nVertical ${aspect} framing. Reserve generous negative space for later text overlay.`;
  }

  if (project === "zobnin") {
    // Не дописывать «substances / violence / intimacy» — сами слова в хвосте повышают риск ложного moderation_blocked.
    out +=
      "\n\nImage safety: bright editorial office scene; adults in professional clothing at work; calm, neutral mood; suitable for a general-audience business magazine.";
  }

  return out;
}

/** Промпт для слайда: ручная правка перебивает текст от модели. */
export function resolveImagePrompt(imagePrompts: ImagePrompt[], slideId: string): string | null {
  const entry = imagePrompts.find((p) => p.slideId === slideId);
  if (!entry) return null;
  const o = entry.manualOverride?.trim();
  if (o) return o;
  const p = entry.prompt.trim();
  return p || null;
}
