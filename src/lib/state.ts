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

/** Системные якоря для OpenAI Image — Zobnin AI; задаётся моделью в statePatch (не показывать в reply). */
export type ZobninSceneMeta = {
  slideId: string;
  visual_type:
    | "system_diagram"
    | "ui_interface"
    | "workflow_pipeline"
    | "automation_flow"
    | "before_after_contrast"
    | "data_process"
    | "abstract_structure"
    | "human_operator";
  system_layer:
    | "input"
    | "process"
    | "output"
    | "bottleneck"
    | "failure_point"
    | "decision_point"
    | "result"
    | "full_system";
  environment:
    | "digital_workspace"
    | "dashboard"
    | "node_graph"
    | "code_editor"
    | "automation_canvas"
    | "abstract_grid"
    | "studio_desk"
    | "undefined";
  visual_focus:
    | "nodes"
    | "arrows"
    | "dashboard_cards"
    | "prompt_box"
    | "data_stream"
    | "split_screen"
    | "error_point"
    | "clean_output"
    | "human_hand"
    | "laptop_screen";
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
  /** Визуальные / системные якоря слайдов (форма зависит от project); синхрон с OpenAI Image. */
  sceneMeta: SceneMetaEntry[];
  images: GeneratedImage[];

  caption: string;
  music: MusicOutput;

  messages: ChatMessage[];
};

/** Проверка, что запись sceneMeta соответствует текущему проекту (формы JSON различаются). */
export function sceneMetaMatchesProject(project: ProjectId, m: SceneMetaEntry): boolean {
  if ("visual_type" in m) return project === "zobnin";
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
