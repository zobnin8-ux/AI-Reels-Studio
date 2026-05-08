export type ProjectId = "poslenego" | "zobnin" | "olgatrip";

export type ContentType = "reels" | "post";

/** CTA Mode */
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

/** Готовый английский промпт под gpt-image от Anthropic; `manualOverride` — правка в UI. */
export type ImagePrompt = {
  slideId: string;
  prompt: string;
  manualOverride?: string;
};

export type MusicOutput = {
  queries: string[];
  recommendations: string[];
  avoid: string[];
};

export type ReferenceImage = {
  id: string;
  kind: "unsplash" | "upload";
  /** Small preview URL or data URL. */
  thumb: string;
  /** Full-size URL or data URL. */
  full: string;
  /** Optional attribution / metadata. */
  author?: string;
  sourceUrl?: string;
};

export type ReferencesState = {
  query: string;
  source: "unsplash" | "pexels";
  items: ReferenceImage[];
  pinterestUrls: string[];
  /** Если true — при «Сгенерировать все картинки» в панели Вывод референсы уходят в OpenAI (images.edit). */
  applyOnGenerate: boolean;
};

export type ImageStatus = "waiting" | "generating" | "done" | "error";

export type GeneratedImage = {
  id: string;
  slideId?: string;
  /** Устаревшее поле для подписи в UI; синхронизируется с imagePrompts при необходимости */
  prompt: string;
  /** Строка, отправленная в OpenAI Image API */
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
  /** Целевое число слайдов (подсказка модели): 5 / 7 / 9 */
  slideCount: 5 | 7 | 9;

  /** Разрешить автогенерацию изображений по эвристике в чате. */
  autoGenerateImages: boolean;

  ctaMode: CtaMode;
  website: string;
  triggerWord: string;
  customCta: string;

  topic: string;
  selectedAngleId: string | null;
  angles: Angle[];
  slides: Slide[];
  approved: boolean;
  imagePrompts: ImagePrompt[];
  images: GeneratedImage[];

  caption: string;
  music: MusicOutput;
  /** Reference images for the user (not sent to the model). */
  references: ReferencesState;

  messages: ChatMessage[];
};

export function createInitialState(): StudioState {
  return {
    provider: "anthropic",

    project: "poslenego",

    contentType: "reels",
    slideCount: 7,
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
    imagePrompts: [],
    images: [],

    caption: "",
    music: { queries: [], recommendations: [], avoid: [] },
    references: { query: "", source: "unsplash", items: [], pinterestUrls: [], applyOnGenerate: false },

    messages: []
  };
}
