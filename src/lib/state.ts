export type ProjectId = "poslenego" | "zobnin" | "custom";

export type ContentType = "reels" | "post";

/** Tone / Mood (ТЗ) */
export type Mood = "aggressive" | "soft" | "provocative" | "positive" | "neutral";

/** Visual Style (ТЗ) */
export type VisualStyle =
  | "darkBrutal"
  | "lightMinimal"
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
  prompt: string;
  status: ImageStatus;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
};

export type StudioState = {
  mockMode: boolean;
  provider: "openai" | "anthropic";

  project: ProjectId;
  customSystemPrompt: string;

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
    mockMode: process.env.NEXT_PUBLIC_AI_MOCK_MODE === "1",
    provider: "openai",

    project: "poslenego",
    customSystemPrompt: "",

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
