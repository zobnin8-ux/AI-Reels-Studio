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

/** Zobnin AI — системные якоря для визуализации без текста на кадре. */
export const zobninSceneMetaSchema = z.object({
  slideId: z.string(),
  visual_type: z.enum([
    "system_diagram",
    "ui_interface",
    "workflow_pipeline",
    "automation_flow",
    "before_after_contrast",
    "data_process",
    "abstract_structure",
    "human_operator"
  ]),
  system_layer: z.enum([
    "input",
    "process",
    "output",
    "bottleneck",
    "failure_point",
    "decision_point",
    "result",
    "full_system"
  ]),
  environment: z.enum([
    "digital_workspace",
    "dashboard",
    "node_graph",
    "code_editor",
    "automation_canvas",
    "abstract_grid",
    "studio_desk",
    "undefined"
  ]),
  visual_focus: z.enum([
    "nodes",
    "arrows",
    "dashboard_cards",
    "prompt_box",
    "data_stream",
    "split_screen",
    "error_point",
    "clean_output",
    "human_hand",
    "laptop_screen"
  ])
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

/** Порядок: zobnin (visual_type) → olgatrip (social_context+light_type) → poslenego. */
export const sceneMetaEntrySchema = z.union([
  zobninSceneMetaSchema,
  olgatripSceneMetaSchema,
  poslenegoSceneMetaSchema
]);

export const statePatchSchema = z.object({
  topic: z.string().optional(),
  angles: z.array(angleSchema).optional(),
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
