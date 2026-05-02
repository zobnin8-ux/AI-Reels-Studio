import { z } from "zod";

export const slideSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string()
});

export const angleSchema = z.object({
  id: z.string(),
  label: z.string()
});

export const slidePromptSchema = z.object({
  slideId: z.string(),
  prompt: z.string()
});

export const musicOutputSchema = z.object({
  queries: z.array(z.string()),
  recommendations: z.array(z.string()),
  avoid: z.array(z.string())
});

/** После него — lifestyle/scene якоря. */
export const poslenegoSceneMetaSchema = z.object({
  slideId: z.string(),
  scene_type: z.enum([
    "micro_action",
    "internal",
    "trigger",
    "observation",
    "contrast",
    "silence"
  ]),
  environment: z.enum(["interior", "public", "transitional", "undefined"]),
  visual_focus: z.enum(["phone", "hands", "face", "body", "object", "empty_space"])
});

/** Zobnin AI — человеко-центричные кинематографические якоря (не диаграммы / не UI mockups). */
export const zobninSceneMetaSchema = z.object({
  slideId: z.string(),
  human_moment: z.enum([
    "confusion",
    "realization",
    "tension",
    "focus_work",
    "overload",
    "relief",
    "doubt",
    "breakthrough"
  ]),
  ai_interaction: z.enum([
    "typing",
    "reading_screen",
    "reacting",
    "thinking",
    "discussing_with_colleague",
    "paused_observing",
    "undefined"
  ]),
  framing: z.enum([
    "close_up",
    "face_screen_light",
    "hands_keyboard",
    "over_shoulder",
    "silhouette",
    "medium_office",
    "wide_desk",
    "undefined"
  ]),
  environment: z.enum([
    "dark_room",
    "office",
    "night_interior",
    "home_office",
    "desk",
    "meeting_room",
    "corridor",
    "undefined"
  ]),
  visual_focus: z.enum(["face", "hands", "eyes", "screen_glow", "posture", "workspace", "undefined"])
});

/** OlgaTrip — travel / lived moment якоря (отличается от poslenego полями social_context и light_type). */
export const olgatripSceneMetaSchema = z.object({
  slideId: z.string(),
  scene_type: z.enum([
    "movement",
    "stillness",
    "interaction",
    "observation",
    "micro_detail",
    "transition",
    "contrast"
  ]),
  environment: z.enum(["street", "cafe", "nature", "interior", "transit", "undefined"]),
  social_context: z.enum([
    "alone",
    "with_group",
    "among_strangers",
    "brief_interaction",
    "shared_silence"
  ]),
  visual_focus: z.enum([
    "hands",
    "back_view",
    "body_fragment",
    "object",
    "environment",
    "movement_trace"
  ]),
  light_type: z.enum(["daylight", "golden_hour", "indoor_soft", "shadow", "mixed_light"])
});

/** Порядок: zobnin (human_moment+ai_interaction) → olgatrip (social_context+light_type) → poslenego. */
export const sceneMetaEntrySchema = z.union([
  zobninSceneMetaSchema,
  olgatripSceneMetaSchema,
  poslenegoSceneMetaSchema
]);

export const statePatchSchema = z.object({
  topic: z.string().optional(),
  angles: z.array(angleSchema).max(5).optional(),
  selectedAngleId: z.string().nullable().optional(),
  slides: z.array(slideSchema).optional(),
  approved: z.boolean().optional(),
  prompts: z.array(slidePromptSchema).optional(),
  sceneMeta: z.array(sceneMetaEntrySchema).optional(),
  caption: z.string().optional(),
  music: musicOutputSchema.optional()
});

export const chatApiResponseSchema = z.object({
  reply: z.string(),
  statePatch: statePatchSchema.optional()
});

export type StatePatch = z.infer<typeof statePatchSchema>;
export type ChatApiResponse = z.infer<typeof chatApiResponseSchema>;
