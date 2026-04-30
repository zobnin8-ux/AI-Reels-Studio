"use client";

import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/studio-store";
import { ImageSlideCard } from "@/components/ImageSlideCard";

/** Узкая колонка только для превью кадров — сразу у чата, без «лестницы» в общем скролле вывода. */
export function ImageStripPanel() {
  const { state } = useStudio();
  const seenImageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const set = seenImageIdsRef.current;
    state.images.forEach((img) => set.add(img.id));
  }, [state.images]);

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-x border-border bg-panel/80 p-3">
      <div className="shrink-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Кадры</div>
        <p className="mt-0.5 text-[10px] leading-snug text-muted">
          Генерация здесь; промпты и подпись — в колонке справа.
        </p>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
        {state.images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-black/15 p-3 text-center text-[10px] leading-relaxed text-muted">
            После «Generate images» превью появятся в этой полосе.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {state.images.map((img, idx) => (
              <div
                key={img.id}
                className={!seenImageIdsRef.current.has(img.id) ? "studio-enter" : ""}
              >
                <ImageSlideCard index={idx} image={img} />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
