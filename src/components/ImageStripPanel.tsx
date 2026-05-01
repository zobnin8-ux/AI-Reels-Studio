"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { ImageSlideCard } from "@/components/ImageSlideCard";

type LightboxState = {
  dataUrl: string;
  title: string;
};

export function ImageStripPanel({ variant = "column" }: { variant?: "column" | "bar" }) {
  const { state } = useStudio();
  const seenImageIdsRef = useRef<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const showBatchProgress =
    state.images.length > 0 && state.images.some((x) => x.status === "waiting" || x.status === "generating");

  const doneCount = useMemo(
    () => state.images.filter((x) => x.status === "done").length,
    [state.images]
  );

  const telePct = useMemo(() => {
    if (state.images.length === 0) return 0;
    return Math.round((doneCount / state.images.length) * 100);
  }, [doneCount, state.images.length]);

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

  const stripMeta =
    state.slides.length > 0
      ? `${state.slides.length} слайд${state.slides.length > 1 ? "ов" : ""}`
      : state.images.length > 0
        ? `${state.images.length} кадр${state.images.length > 1 ? "ов" : ""}`
        : "ожидание";

  return (
    <>
      <div className="panel-strip">
        <div className="strip-row">
          <span className="strip-tag">Раскадровка</span>
          <span className="strip-meta">{stripMeta}</span>
        </div>
        <h2 className="strip-title">
          Кадры <b>·</b> превью
        </h2>
        <p className="strip-sub">Превью после Generate images; клик по готовому кадру — полный экран.</p>
      </div>

      <div className={variant === "bar" ? "frames-bar-body min-h-0" : "frames-body min-h-0"}>
        {showBatchProgress ? (
          <div className="busy-ribbon mb-3" role="status" aria-live="polite">
            <span className="dot-pulse" aria-hidden />
            Идёт генерация кадров…
          </div>
        ) : null}

        {state.images.length === 0 ? (
          variant === "bar" ? (
            <div className="frames-bar-empty">
              <div className="reel-frame placeholder" style={{ width: 220, aspectRatio: "9 / 16" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em" }}>ПУСТО</span>
              </div>
              <div className="reel-frame placeholder" aria-hidden style={{ width: 220, aspectRatio: "9 / 16" }} />
              <div className="reel-frame placeholder" aria-hidden style={{ width: 220, aspectRatio: "9 / 16" }} />
            </div>
          ) : (
            <div className="reel-row">
              <div className="reel-frame placeholder">
                <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em" }}>
                  ПУСТО
                </span>
              </div>
              <div className="reel-frame placeholder" aria-hidden />
            </div>
          )
        ) : (
          variant === "bar" ? (
            <div className="frames-bar-row" role="list">
              {state.images.map((img, idx) => (
                <div
                  key={img.id}
                  className={[
                    "reel-frame frames-bar-slot",
                    !seenImageIdsRef.current.has(img.id) ? "studio-enter" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="frame-num">#{String(idx + 1).padStart(2, "0")}</span>
                  <span className="frame-status">
                    {img.status === "generating"
                      ? "генерация"
                      : img.status === "waiting"
                        ? "очередь"
                        : img.status === "done"
                          ? "готово"
                          : "ошибка"}
                  </span>
                  <ImageSlideCard
                    variant="thumb"
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
          ) : (
            <div className="reel-row reel-row-stack">
              {state.images.map((img, idx) => (
                <div
                  key={img.id}
                  className={[
                    "reel-frame",
                    !seenImageIdsRef.current.has(img.id) ? "studio-enter" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="frame-num">#{String(idx + 1).padStart(2, "0")}</span>
                  <span className="frame-status">
                    {img.status === "generating"
                      ? "генерация"
                      : img.status === "waiting"
                        ? "очередь"
                        : img.status === "done"
                          ? "готово"
                          : "ошибка"}
                  </span>
                  <ImageSlideCard
                    variant="frame"
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
          )
        )}

        {variant === "bar" ? (
          <div className="telemetry frames-bar-telemetry">
            <div className="tele-row">
              <span className="tele-label">IMAGES</span>
              <span className="tele-value">
                {doneCount}/{state.images.length || 0} DONE
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${telePct}%` }} />
            </div>
          </div>
        ) : (
          <div className="telemetry">
            <div className="tele-row">
              <span className="tele-label">IMAGES</span>
              <span className="tele-value">
                {doneCount}/{state.images.length || 0} DONE
              </span>
            </div>
            <div className="tele-row">
              <span className="tele-label">LANE</span>
              <span className="tele-value">GPU</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${telePct}%` }} />
            </div>
          </div>
        )}
      </div>

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
