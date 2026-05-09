import type { ContentType, ImagePrompt, ProjectId } from "@/lib/state";

const NO_TEXT_PHRASES = ["no text", "no letters", "no typography", "no captions", "no logos", "no readable"];

const ASPECT_PHRASES = {
  reels: ["9:16", "vertical 9:16"],
  post: ["4:5", "vertical 4:5"]
} as const;

/**
 * Смягчает типичные формулировки, из‑за которых gpt-image даёт ложные moderation_blocked
 * (усталость, драма, ночь, алкоголь и т.д.). Универсальные замены + проектные нюансы.
 */
export function softenImagePromptForModeration(prompt: string, project: ProjectId): string {
  let s = prompt;

  type Replacement = string | ((substring: string, ...args: unknown[]) => string);

  // === UNIVERSAL (all projects) ===
  const universalPairs: Array<[RegExp, Replacement]> = [
    // 1) Real people names / "in the spirit of"
    [/\bin the spirit of [A-Z][a-zà-ÿ'-]+(?:\s+(?:and|&)\s+[A-Z][a-zà-ÿ'-]+){0,3}(?:\s+[A-Z][a-zà-ÿ'-]+){0,2}\b/gi, "with editorial documentary feel"],
    [
      /\b(?:Annie Leibovitz|Wolfgang Tillmans|Dan Winters|Henrik Knudsen|Alec Soth|Martin Schoeller|Platon|Lars Tunbjörk|Gregory Crewdson)\b/gi,
      ""
    ],
    [/\b(?:Joel Meyerowitz|Saul Leiter|Slim Aarons|Steve McCurry|Vivian Maier|Gray Malin)\b/gi, ""],
    [/\b(?:Todd Hido|Sally Mann|Rinko Kawauchi|Nan Goldin|Hannah Starkey)\b/gi, ""],

    // 2) Negative constructions that often spike moderation
    [/\bno men in frame(?:\s+or\s+reflections)?\b/gi, "women only in frame, including reflections"],
    [/\bno children(?:\s+in frame)?\b/gi, "adults only in frame"],
    [/\bnot\s+stressed,?\s*just\s+evaluating\b/gi, "composed and attentive"],
    [/\bnot\s+frustrated,?\s*not\s+pleased,?\s*just\s+assessing\b/gi, "calm and focused, mid-thought"],
    [/\bnot crying\b/gi, "calm"],

    // 3) Alcohol everywhere → safe substitutes
    [/\bcarafe of ros[éeé]\b/gi, "carafe of sparkling water"],
    [/\bglass of (?:wine|red wine|white wine|ros[éeé]|champagne|prosecco)\b/gi, "tea cup"],
    [/\bwine glass(?:es)?\b/gi, "tea cup"],
    [/\bwine bar\b/gi, "small café"],
    [/\bwine tasting\b/gi, "coffee tasting"],
    [/\bwineries\b/gi, "small artisan farms"],
    [/\bwine\b/gi, "tea"],
    [/\bros[éeé]\b/gi, "sparkling water"],
    [/\bchampagne\b/gi, "sparkling water"],
    [/\bprosecco\b/gi, "sparkling water"],
    [/\bcocktail\b/gi, "coffee"],
    [/\bbeer\b/gi, "sparkling water"],
    [/\b(whiskey|whisky|vodka|gin|vermouth|aperitif)\b/gi, "coffee"],
    [/\balcohol(?:ic)?\b/gi, "drink"],
    [/\bdrunk\b/gi, ""],

    // 5) Intimate / sensual — per-project below (olgatrip must not inject extra "warm")
    [/\bseductive\b/gi, ""],
    [/\bsexy\b/gi, ""],
    [/\bsexual\b/gi, ""],
    [/\bnude|naked\b/gi, "fully dressed"],

    // 6) Body-focus words
    [/\bbare shoulders\b/gi, "soft shoulders"],
    [/\bcleavage\b/gi, ""],
    [/\bthigh(s)?\b/gi, "lap"],
    [/\bbelly\b/gi, "midsection"],
    [/\bcollarbone\b/gi, "neckline"],

    // 7) Conflict / violence
    [/\bargument\b/gi, "discussion"],
    [/\barguing\b/gi, "talking"],
    [/\bfight(ing)?\b/gi, "interaction"],
    [/\bhostile\b/gi, "neutral"],
    [/\btense atmosphere\b/gi, "calm atmosphere"],
    [/\btrauma\b/gi, ""],
    [/\babuse(d|sive)?\b/gi, ""],
    [/\bviolence\b/gi, ""],
    [/\bviolent\b/gi, ""],
    [/\brage\b/gi, ""],
    [/\bhorror\b/gi, ""],
    [/\bsuicid(e|al)\b/gi, ""],
    [/\btraumatized\b/gi, ""],

    // 8) Tears / grief visual triggers
    [/\btears\b/gi, ""],
    [/\bsobbing\b/gi, ""],
    [/\bcrying\b/gi, "looking away"],
    [/\bweeping\b/gi, ""],
    [/\bmascara streaks?\b/gi, ""],
    [/\bsmudged makeup\b/gi, ""],
    [/\bswollen eyes\b/gi, "tired eyes"],
    [/\bred eyes\b/gi, ""],
    [/\btrembling lips?\b/gi, "soft mouth"],

    // 9) Bed / sleeping scene triggers
    [/\b(?:on|sitting on|edge of|in)\s+an?\s+unmade\s+bed\b/gi, "in a chair by the window"],
    [/\bunmade\s+bed\b/gi, "armchair"],
    [/\brumpled\s+sheets?\b/gi, ""],
    [/\b(?:bed)\s+sheets?\b/gi, "fabric"],
    [/\bpillow\s+on\s+the\s+floor\b/gi, ""],
    [/\bin\s+bed\b/gi, "in the room"],
    [/\bunder\s+the\s+covers\b/gi, ""],
    [/\bmattress\b/gi, "couch"],

    // 10) Other common moderation spikes
    [/\bdead\s+plant\b/gi, "small plant"],
    [/\bdead\b/gi, ""],
    [/\bbad news\b/gi, "routine update"],
    [/\bsuffering\b/gi, ""],
    [/\bsuffer(s|ed)?\b/gi, ""],
    [/\bpain(ful|fully)?\b/gi, "effort"],
    [/\bdepressed\b/gi, "reflective"],
    [/\bhopeless\b/gi, "measured"],
    [/\bshouting\b/gi, "speaking"],
    [/\bscreaming\b/gi, ""],
    [/\bterrified\b/gi, "composed"],
    [/\bdesperate\b/gi, "intent"]
  ];

  for (const [re, rep] of universalPairs) {
    s = s.replace(re, rep as never);
  }

  // === PROJECT-SPECIFIC ===
  if (project === "poslenego") {
    const poslenegoPairs: Array<[RegExp, Replacement]> = [
      [/\bintimate\b/gi, "quiet"],
      [/\bsensual\b/gi, "soft"]
    ];
    for (const [re, rep] of poslenegoPairs) s = s.replace(re, rep as never);
  }

  if (project === "zobnin") {
    const zobninPairs: Array<[RegExp, Replacement]> = [
      [/\bintimate\b/gi, "warm"],
      [/\bsensual\b/gi, "warm"],
      [
        /\b(a|an)\s+(\d{1,2})[- ]year[- ]old\s+(man|woman|guy|gal|male|female|person|professional|executive)\b/gi,
        (_match: string, ...args: unknown[]) => {
          const kind = String(args[2] ?? "");
          const isMale = /man|guy|male/i.test(kind);
          const isFemale = /woman|gal|female/i.test(kind);
          if (isMale) return "a man in his early thirties";
          if (isFemale) return "a woman in her early thirties";
          return "an adult professional in their early thirties";
        }
      ],
      // night/dark triggers
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

      // scrutiny / suspicion lexicon (screen-adjacent often)
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
      [/\bpiercing (gaze|look|eyes)\b/gi, "attentive $1"],
      [/\bpointed (expression|look|gaze)\b/gi, "direct $1"],
      [/\bintense\b/gi, "steady"],

      // face/head-touch gestures
      [/\bhand\s+on\s+(his|her|their|the)?\s*temple\b/gi, "hand resting near the desk edge"],
      [/\brubbing\s+(his|her|their)?\s*eyes\b/gi, "looking at the screen"],
      [/\btouching\s+(his|her|their)?\s*forehead\b/gi, "upright posture at the desk"],
      [/\bhand\s+on\s+chin\s+in\s+worry\b/gi, "hand resting on the desk"],
      [/\bfingers\s+pressed\s+to\s+(his|her|their)?\s*face\b/gi, "fingers on the keyboard"],
      [/\bhead\s+in\s+hands\b/gi, "seated upright at the desk"]
    ];
    for (const [re, rep] of zobninPairs) s = s.replace(re, rep as never);
  }

  if (project === "olgatrip") {
    const olgatripPairs: Array<[RegExp, Replacement]> = [
      [/\bintimate\b/gi, "close"],
      [/\bsensual\b/gi, "elegant"],
      [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+(woman|gal|female|person)\b/gi, "a woman in her early thirties"],
      [/\b(a|an)\s+\d{1,2}[- ]year[- ]old\s+(man|guy|male)\b/gi, ""],
      [/\bwomen in their forties\b/gi, "women in their early thirties"],
      [/\bwomen in their late forties\b/gi, "women in their early thirties"],
      [/\bwomen in their mid-forties\b/gi, "women in their early thirties"],
      [/\bwomen in their fifties\b/gi, "women in their early thirties"],
      [/\bin her forties\b/gi, "in her early thirties"],
      [/\bin her late forties\b/gi, "in her early thirties"],
      [/\bin her mid-forties\b/gi, "in her early thirties"],
      [/\bin her fifties\b/gi, "in her early thirties"],
      [/\bmature women\b/gi, "young women"],
      [/\bmature adult women\b/gi, "young adult women"]
    ];
    for (const [re, rep] of olgatripPairs) {
      s = s.replace(re, rep as never);
    }
  }

  // Final cleanup
  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+\.\s*/g, ". ")
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
  if (project) {
    out = softenImagePromptForModeration(out, project);
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
