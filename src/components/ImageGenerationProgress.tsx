"use client";

import type { GeneratedImage } from "@/lib/state";

/** Stage 2: полоса прогресса и подпись по state.images во время пакетной генерации. */
export function ImageGenerationProgress({ images }: { images: GeneratedImage[] }) {
  if (images.length === 0) return null;

  const total = images.length;
  const finished = images.filter((x) => x.status === "done" || x.status === "error").length;
  const genIx = images.findIndex((x) => x.status === "generating");
  const pct = total ? Math.min(100, Math.round((finished / total) * 100)) : 0;

  let subtitle: string | null = null;
  if (genIx >= 0) subtitle = `Сейчас обрабатывается кадр ${genIx + 1} из ${total}`;
  else if (finished < total && images.some((x) => x.status === "waiting")) {
    const w = images.findIndex((x) => x.status === "waiting");
    if (w >= 0) subtitle = `В очереди: кадр ${w + 1} из ${total}`;
  } else if (finished === total) {
    subtitle = "Готово.";
  }

  return (
    <div className="space-y-2 rounded-lg border border-accent/25 bg-black/25 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="font-medium text-text/90">Генерация изображений</span>
        <span className="tabular-nums text-text/80">
          готово {finished} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/45 ring-1 ring-border/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent2/90 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={finished}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      {subtitle ? <p className="text-[10px] leading-snug text-muted">{subtitle}</p> : null}
    </div>
  );
}

