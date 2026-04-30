"use client";

import { useEffect, useRef, useState } from "react";
import { ImageGenerationProgress } from "@/components/ImageGenerationProgress";
import { useStudio } from "@/lib/studio-store";
import { ImageSlideCard } from "@/components/ImageSlideCard";

type LightboxState = {
  dataUrl: string;
  title: string;
};

/** Колонка превью кадров у чата; клик по картинке — полноразмерное превью. */
export function ImageStripPanel() {
  const { state } = useStudio();
  const seenImageIdsRef = useRef<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const showBatchProgress =
    state.images.length > 0 && state.images.some((x) => x.status === "waiting" || x.status === "generating");

  useEffect(() => {
    const set = seenImageIdsRef.current;
    state.images.forEach((img) => set.add(img.id));
  }, [state.images]);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <>
      <aside className="flex h-full min-h-0 min-w-0 flex-col border-x border-border bg-panel/80 p-3">
        <div className="shrink-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Кадры</div>
          <p className="mt-0.5 text-[10px] leading-snug text-muted">
            Генерация здесь; промпты и подпись — в колонке справа. Кадр — нажми для полного размера.
          </p>
          {showBatchProgress ? (
            <div className="mt-2">
              <ImageGenerationProgress images={state.images} />
            </div>
          ) : null}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          {state.images.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-black/15 p-3 text-center text-[10px] leading-relaxed text-muted">
              После «Generate images» превью появятся в этой полосе.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {state.images.map((img, idx) => (
                <div key={img.id} className={!seenImageIdsRef.current.has(img.id) ? "studio-enter" : ""}>
                  <ImageSlideCard
                    index={idx}
                    image={img}
                    onPreview={
                      img.status === "done" && img.imageBase64
                        ? () =>
                            setLightbox({
                              dataUrl: `data:${img.mimeType ?? "image/png"};base64,${img.imageBase64}`,
                              title: `Кадр ${String(idx + 1).padStart(2, "0")}`
                            })
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.title}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            Закрыть
          </button>
          <div className="max-h-[min(96vh,1200px)] max-w-[min(96vw,900px)] pointer-events-none select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.dataUrl}
              alt={lightbox.title}
              className="pointer-events-auto max-h-[min(96vh,1200px)] w-auto max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="pointer-events-none absolute bottom-6 left-0 right-0 text-center text-xs text-white/70">
            {lightbox.title} · Esc или клик вне кадра
          </div>
        </div>
      ) : null}
    </>
  );
}

