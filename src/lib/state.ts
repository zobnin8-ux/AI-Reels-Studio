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

/** Якоря для OpenAI Image — «После него»; задаётся моделью в statePatch (не показывать в reply). */
export type PoslenegoSceneMeta = {
  slideId: string;
  scene_type: "micro_action" | "internal" | "trigger" | "observation" | "contrast" | "silence";
  environment: "interior" | "public" | "transitional" | "undefined";
  visual_focus: "phone" | "hands" | "face" | "body" | "object" | "empty_space";
};

/** Якоря для OpenAI Image — Zobnin AI (человеко-центричные кадры); задаётся моделью в statePatch (не показывать в reply). */
export type ZobninSceneMeta = {
  slideId: string;
  human_moment:
    | "confusion"
    | "realization"
    | "tension"
    | "focus_work"
    | "overload"
    | "relief"
    | "doubt"
    | "breakthrough";
  ai_interaction:
    | "typing"
    | "reading_screen"
    | "reacting"
    | "thinking"
    | "discussing_with_colleague"
    | "paused_observing"
    | "undefined";
  framing:
    | "close_up"
    | "face_screen_light"
    | "hands_keyboard"
    | "over_shoulder"
    | "silhouette"
    | "medium_office"
    | "wide_desk"
    | "undefined";
  environment:
    | "dark_room"
    | "office"
    | "night_interior"
    | "home_office"
    | "desk"
    | "meeting_room"
    | "corridor"
    | "undefined";
  visual_focus:
    | "face"
    | "hands"
    | "eyes"
    | "screen_glow"
    | "posture"
    | "workspace"
    | "undefined";
};

/** Travel / atmosphere якоря — OlgaTrip; задаётся моделью в statePatch (не показывать в reply). */
export type OlgatripSceneMeta = {
  slideId: string;
  scene_type:
    | "movement"
    | "stillness"
    | "interaction"
    | "observation"
    | "micro_detail"
    | "transition"
    | "contrast";
  environment: "street" | "cafe" | "nature" | "interior" | "transit" | "undefined";
  social_context: "alone" | "with_group" | "among_strangers" | "brief_interaction" | "shared_silence";
  visual_focus:
    | "hands"
    | "back_view"
    | "body_fragment"
    | "object"
    | "environment"
    | "movement_trace";
  light_type: "daylight" | "golden_hour" | "indoor_soft" | "shadow" | "mixed_light";
};

export type SceneMetaEntry = PoslenegoSceneMeta | ZobninSceneMeta | OlgatripSceneMeta;

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
  /** Полная строка, отправленная в OpenAI Image API для этого кадра (можно править и перегенерировать). */
  finalPrompt?: string;
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

  /** Разрешить автогенерацию изображений по эвристике в чате. По умолчанию выключено. */
  autoGenerateImages: boolean;

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
  /** Визуальные / системные якоря слайдов (форма зависит от project); синхрон с OpenAI Image. */
  sceneMeta: SceneMetaEntry[];
  images: GeneratedImage[];

  caption: string;
  music: MusicOutput;

  messages: ChatMessage[];
};

/** Проверка, что запись sceneMeta соответствует текущему проекту (формы JSON различаются). */
export function sceneMetaMatchesProject(project: ProjectId, m: SceneMetaEntry): boolean {
  if ("human_moment" in m && "ai_interaction" in m) return project === "zobnin";
  if ("social_context" in m && "light_type" in m) return project === "olgatrip";
  if ("scene_type" in m) return project === "poslenego";
  return false;
}

export function createInitialState(): StudioState {
  return {
    provider: "openai",

    project: "poslenego",

    contentType: "reels",
    slideCount: 5,
    mood: "neutral",
    visualStyle: "editorial",
    outputMode: "both",
    autoGenerateImages: false,

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
    sceneMeta: [],
    images: [],

    caption: "",
    music: { queries: [], recommendations: [], avoid: [] },

    messages: []
  };
}
