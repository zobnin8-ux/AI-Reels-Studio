"use client";

import type { GeneratedImage } from "@/lib/state";
import { useStudio } from "@/lib/studio-store";
import { regenerateOneImage } from "@/lib/actions";
import { mergePromptForSlide } from "@/lib/prompt-sync";
import { useEffect, useRef, useState } from "react";

export function ImageSlideCard({
  index,
  image,
  onPreview,
  variant = "card"
}: {
  index: number;
  image: GeneratedImage;
  /** Клик по готовому превью — полноэкранный просмотр (если передан). */
  onPreview?: () => void;
  /** В колонке v2026 — компактный вид внутри `.reel-frame`. */
  variant?: "card" | "frame" | "thumb";
}) {
  const { state, dispatch } = useStudio();
  const [localPrompt, setLocalPrompt] = useState(image.prompt);
  const [busy, setBusy] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const prevErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setLocalPrompt(image.prompt);
  }, [image.prompt]);

  useEffect(() => {
    if (image.error && image.error !== prevErrorRef.current) {
      setErrorShake(true);
      window.setTimeout(() => setErrorShake(false), 500);
    }
    prevErrorRef.current = image.error;
  }, [image.error]);

  function commitPromptToStore() {
    if (!image.slideId?.trim()) return;
    const prompts = mergePromptForSlide(state, image.slideId, localPrompt);
    dispatch({ type: "set", patch: { prompts } });
  }

  async function onRegenerate() {
    if (!image.slideId?.trim()) return;
    const prompts = mergePromptForSlide(state, image.slideId, localPrompt);
    const mergedState = { ...state, prompts };
    dispatch({ type: "set", patch: { prompts } });
    setBusy(true);
    try {
      const nextImage = await regenerateOneImage(mergedState, image.id, image.slideId, localPrompt);
      const next = state.images.map((x) => (x.id === image.id ? nextImage : x));
      dispatch({ type: "set", patch: { images: next } });
    } finally {
      setBusy(false);
    }
  }

  const status = image.status;
  const statusLabel =
    status === "waiting"
      ? "очередь"
      : status === "generating"
        ? "генерация"
        : status === "done"
          ? "готово"
          : "ошибка";

  const isFrame = variant === "frame";
  const isThumb = variant === "thumb";

  return (
    <div
      className={[
        isThumb
          ? "reel-frame-inner min-h-0 overflow-hidden p-2"
          : isFrame
            ? "reel-frame-inner overflow-y-auto p-2"
            : "studio-card-frame min-w-0 overflow-hidden rounded-xl border border-border bg-panel/40 p-3",
        errorShake ? "studio-shake border-red-400/35" : ""
      ].join(" ")}
    >
      {!isFrame && !isThumb ? (
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="text-sm font-semibold">
            {String(index + 1).padStart(2, "0")}. Кадр
          </div>
          <span className="rounded-full border border-border bg-black/30 px-2 py-1 text-xs text-muted">
            {statusLabel}
          </span>
        </div>
      ) : null}

      <div
        className={[
          "min-w-0 min-h-0 gap-2",
          isThumb ? "mt-0 flex min-h-0 flex-1 flex-col" : isFrame ? "mt-0 flex flex-1 flex-col" : "mt-3 grid grid-cols-1 gap-3"
        ].join(" ")}
      >
        <div
          className={[
            isThumb
              ? "mx-auto flex w-full min-w-0 flex-[1.35] items-center justify-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elev-3)]"
              : isFrame
                ? "mx-auto flex w-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elev-3)]"
                : "mx-auto flex w-full max-w-[min(100%,320px)] min-w-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40",
            !isThumb && state.contentType === "reels" ? "aspect-[9/16]" : "",
            !isThumb && state.contentType !== "reels" ? "aspect-[4/5]" : ""
          ].join(" ")}
        >
          {image.imageBase64 ? (
            onPreview ? (
              <button
                type="button"
                className="group relative flex h-full w-full cursor-zoom-in items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent/40"
                onClick={() => onPreview()}
                aria-label="Открыть кадр на весь экран"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${image.mimeType ?? "image/png"};base64,${image.imageBase64}`}
                  alt=""
                  className="max-h-full max-w-full object-contain transition group-hover:opacity-95"
                />
                <span
                  className="pointer-events-none absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white/90 opacity-0 shadow-md backdrop-blur-sm transition group-hover:opacity-100"
                  aria-hidden
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent py-2 text-center text-[10px] text-white/90 opacity-0 transition group-hover:opacity-100">
                  Нажми для превью
                </span>
              </button>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:${image.mimeType ?? "image/png"};base64,${image.imageBase64}`}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-muted">
              {status === "generating" ? (
                <span className="studio-pulse-slow font-medium text-accent/95">Генерация…</span>
              ) : status === "waiting" ? (
                <span>В очереди</span>
              ) : (
                <span>preview</span>
              )}
            </div>
          )}
        </div>
        <div className={["min-w-0 overflow-hidden", isThumb ? "min-h-0 flex-1 space-y-2" : "space-y-2"].join(" ")}>
          {!isFrame && !isThumb ? (
            <div className="text-xs font-medium text-muted">Уточнение (опция)</div>
          ) : null}
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            onBlur={() => commitPromptToStore()}
            className={
              isThumb
                ? "textarea min-h-[56px] flex-1 resize-none font-mono text-[10px] leading-snug"
                : isFrame
                  ? "textarea min-h-[72px] font-mono text-[11px]"
                  : "min-h-20 w-full min-w-0 max-w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent/30"
            }
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onRegenerate()}
              disabled={busy}
              className={
                isThumb
                  ? "gen-btn mt-0 py-1.5 text-[10px]"
                  : isFrame
                    ? "gen-btn mt-1 py-2 text-[11px]"
                    : "studio-btn-ghost rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30 disabled:opacity-50"
              }
            >
              {busy ? "…" : "Перегенерировать"}
            </button>
          </div>
          {image.error ? (
            <div className="max-w-full whitespace-pre-wrap break-all text-xs text-red-300">
              {image.error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
