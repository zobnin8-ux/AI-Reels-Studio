export type ProjectId = "poslenego" | "zobnin" | "olgatrip";

export type ContentType = "reels" | "post";

/** Tone / Mood (ТЗ) */
export type Mood = "aggressive" | "soft" | "provocative" | "positive" | "neutral";

/** Visual Style (ТЗ) */
export type VisualStyle =
  | "darkBrutal"
  | "lightMinimal"
  | "brightPositive"
  | "portraLifestyle"
  | "editorial"
  | "tech";

export type OutputMode = "textInImages" | "textSeparate" | "both";

/** CTA Mode — «None» без сайта/триггера */
export type CtaMode = "website" | "direct" | "none" | "custom";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** Только естественный ответ (`reply` из API), без сырого JSON */
  content: string;
};

export type Angle = {
  id: string;
  label: string;
};

export type Slide = {
  id: string;
  title: string;
  text: string;
};

/** Опциональные краткие уточнения к автособранному image prompt (поле `prompt` в JSON/API для совместимости). */
export type SlidePrompt = {
  slideId: string;
  prompt: string;
};

export type MusicOutput = {
  queries: string[];
  recommendations: string[];
  avoid: string[];
};

export type ImageStatus = "waiting" | "generating" | "done" | "error";

export type GeneratedImage = {
  id: string;
  slideId?: string;
  /** Косметическое уточнение для кадра (для UI), не полный prompt в API. */
  prompt: string;
  status: ImageStatus;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
};

export type StudioState = {
  provider: "openai" | "anthropic";

  project: ProjectId;

  contentType: ContentType;
  slideCount: 5 | 7 | 9 | 10 | 12;
  mood: Mood;
  visualStyle: VisualStyle;
  outputMode: OutputMode;

  ctaMode: CtaMode;
  website: string;
  triggerWord: string;
  customCta: string;

  topic: string;
  selectedAngleId: string | null;
  angles: Angle[];
  slides: Slide[];
  /** Явное утверждение сценария (из диалога / statePatch) */
  approved: boolean;
  prompts: SlidePrompt[];
  images: GeneratedImage[];

  caption: string;
  music: MusicOutput;

  messages: ChatMessage[];
};

export function createInitialState(): StudioState {
  return {
    provider: "openai",

    project: "poslenego",

    contentType: "reels",
    slideCount: 5,
    mood: "neutral",
    visualStyle: "editorial",
    outputMode: "both",

    ctaMode: "website",
    website: "poslenego.com",
    triggerWord: "",
    customCta: "",

    topic: "",
    selectedAngleId: null,
    angles: [],
    slides: [],
    approved: false,
    prompts: [],
    images: [],

    caption: "",
    music: { queries: [], recommendations: [], avoid: [] },

    messages: []
  };
}
