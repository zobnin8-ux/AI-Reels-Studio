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

/** Ответ модели — длинные промпты. */
export const imagePromptSchema = z.object({
  slideId: z.string(),
  prompt: z.string().min(50)
});

/** Снимок сессии из UI — промпт может быть пустым до ответа модели. */
export const sessionImagePromptSchema = z.object({
  slideId: z.string(),
  prompt: z.string(),
  manualOverride: z.string().optional()
});

export const musicOutputSchema = z.object({
  queries: z.array(z.string()),
  recommendations: z.array(z.string()),
  avoid: z.array(z.string())
});

export const statePatchSchema = z.object({
  topic: z.string().optional(),
  angles: z.array(angleSchema).max(5).optional(),
  selectedAngleId: z.string().nullable().optional(),
  slides: z.array(slideSchema).optional(),
  approved: z.boolean().optional(),
  imagePrompts: z.array(imagePromptSchema).optional(),
  caption: z.string().optional(),
  music: musicOutputSchema.optional()
});

export const chatApiResponseSchema = z.object({
  reply: z.string(),
  statePatch: statePatchSchema.optional()
});

export type StatePatch = z.infer<typeof statePatchSchema>;
export type ChatApiResponse = z.infer<typeof chatApiResponseSchema>;
