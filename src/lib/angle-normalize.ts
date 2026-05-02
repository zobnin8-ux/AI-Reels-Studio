import type { Angle } from "@/lib/state";

export const MAX_ANGLES = 5;
export const ANGLE_IDS = ["1", "2", "3", "4", "5"] as const;

/** Нумерация только 1…5 по порядку, без букв и звёзд в данных состояния. */
export function normalizeAnglesList(angles: { id: string; label: string }[]): Angle[] {
  return angles.slice(0, MAX_ANGLES).map((a, i) => ({
    id: ANGLE_IDS[i]!,
    label: (a.label ?? "").trim()
  }));
}

/** После нормализации id выбранный угол сопоставляется по прежнему id из ответа модели или по цифре 1–5. */
export function remapSelectedAngleIdAfterNormalize(
  rawAngles: { id: string; label: string }[],
  normalized: Angle[],
  selectedAngleId: string | null
): string | null {
  if (selectedAngleId === null) return null;
  const idx = rawAngles.findIndex((a) => a.id === selectedAngleId);
  if (idx >= 0 && idx < normalized.length) return normalized[idx]!.id;
  if (/^[1-5]$/.test(selectedAngleId)) {
    const n = Number(selectedAngleId);
    if (n >= 1 && n <= normalized.length) return selectedAngleId;
    return null;
  }
  return null;
}

/** Обновление только selectedAngleId без смены списка углов (список уже с id "1"…"5"). */
export function coerceSelectedAngleId(selectedAngleId: string | null, angles: Angle[]): string | null {
  if (selectedAngleId === null) return null;
  const byId = angles.findIndex((a) => a.id === selectedAngleId);
  if (byId >= 0) return String(byId + 1);
  if (/^[1-5]$/.test(selectedAngleId)) {
    const n = Number(selectedAngleId);
    if (n >= 1 && n <= angles.length) return selectedAngleId;
  }
  return null;
}
