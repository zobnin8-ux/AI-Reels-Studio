"use client";

import type { GeneratedImage } from "@/lib/state";
import { useStudio } from "@/lib/studio-store";
import { regenerateOneImage } from "@/lib/actions";
import { mergeImagePromptManual } from "@/lib/image-prompt-sync";
import { resolveImagePrompt, sanitizeForOpenAIImage } from "@/lib/image-prompt-pipeline";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function resolvedPromptText(
  imagePrompts: { slideId: string; prompt: string; manualOverride?: string }[],
  slideId: string | undefined
): string {
  if (!slideId) return "";
  const row = imagePrompts.find((p) => p.slideId === slideId);
  if (!row) return "";
  return (row.manualOverride?.trim() || row.prompt.trim() || "").trim();
}

export function ImageSlideCard({
  index,
  image,
  onPreview,
  variant = "card"
}: {
  index: number;
  image: GeneratedImage;
  onPreview?: () => void;
  variant?: "card" | "frame" | "thumb" | "frameRail";
}) {
  const { state, dispatch } = useStudio();
  const [localPrompt, setLocalPrompt] = useState(() =>
    resolvedPromptText(state.imagePrompts, image.slideId)
  );
  const [busy, setBusy] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const prevErrorRef = useRef<string | undefined>(undefined);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const railSheetPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalPrompt(resolvedPromptText(state.imagePrompts, image.slideId));
  }, [state.imagePrompts, image.slideId]);

  useEffect(() => {
    if (image.error && image.error !== prevErrorRef.current) {
      setErrorShake(true);
      window.setTimeout(() => setErrorShake(false), 500);
    }
    prevErrorRef.current = image.error;
  }, [image.error]);

  function commitPromptToStore() {
    if (!image.slideId?.trim()) return;
    const imagePrompts = mergeImagePromptManual(state, image.slideId, localPrompt);
    dispatch({ type: "set", patch: { imagePrompts } });
  }

  async function onRegenerate() {
    if (!image.slideId?.trim()) return;
    const imagePrompts = mergeImagePromptManual(state, image.slideId, localPrompt);
    const mergedState = { ...state, imagePrompts };
    dispatch({ type: "set", patch: { imagePrompts } });
    setBusy(true);
    try {
      const nextImage = await regenerateOneImage(mergedState, image.id, image.slideId);
      const next = mergedState.images.map((x) => (x.id === image.id ? nextImage : x));
      dispatch({ type: "set", patch: { images: next } });
    } finally {
      setBusy(false);
    }
  }

  const lockPromptEdit = busy || image.status === "generating";

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
  const isFrameRail = variant === "frameRail";
  const isFrameLike = isFrame || isFrameRail;
  const isThumb = variant === "thumb";

  const canRegenerate = useMemo(() => {
    return !!image.slideId?.trim() && !busy && !lockPromptEdit;
  }, [busy, image.slideId, lockPromptEdit]);

  const sanitizedPreview = useMemo(() => {
    if (!image.slideId) return "";
    const raw = resolveImagePrompt(state.imagePrompts, image.slideId);
    return raw ? sanitizeForOpenAIImage(raw, state.contentType, state.project) : "";
  }, [state.imagePrompts, state.contentType, image.slideId]);

  useEffect(() => {
    if (!railSheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRailSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railSheetOpen]);

  useEffect(() => {
    if (!railSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [railSheetOpen]);

  useEffect(() => {
    if (!railSheetOpen) return;
    const panelEl = railSheetPanelRef.current;
    if (!panelEl) return;
    const sheetRoot: HTMLDivElement = panelEl;

    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function listFocusable(root: HTMLDivElement) {
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          "button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled])"
        )
      );
    }

    const raf = requestAnimationFrame(() => {
      const nodes = listFocusable(sheetRoot);
      (nodes[0] ?? sheetRoot).focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const nodes = listFocusable(sheetRoot);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    sheetRoot.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      sheetRoot.removeEventListener("keydown", onKeyDown);
      prevFocus?.focus();
    };
  }, [railSheetOpen]);

  async function copySanitizedPrompt() {
    const text = sanitizedPreview.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={[
        isThumb
          ? "reel-frame-inner min-h-0 overflow-hidden p-2"
          : isFrameRail
            ? "reel-frame-inner overflow-hidden p-2"
            : isFrameLike
              ? "reel-frame-inner overflow-y-auto p-2"
              : "studio-card-frame min-w-0 overflow-hidden rounded-xl border border-border bg-panel/40 p-3",
        errorShake ? "studio-shake border-red-400/35" : ""
      ].join(" ")}
    >
      {!isFrameLike && !isThumb ? (
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
          isThumb ? "mt-0 flex min-h-0 flex-1 flex-col" : isFrameLike ? "mt-0 flex flex-1 flex-col" : "mt-3 grid grid-cols-1 gap-3"
        ].join(" ")}
      >
        {isFrameRail ? (
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted/90">
              {image.status === "done" ? "Готово" : image.status === "generating" ? "Генерация" : image.status === "waiting" ? "Очередь" : "Ошибка"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="asset-badge"
                disabled={!sanitizedPreview.trim()}
                onClick={() => void copySanitizedPrompt()}
                title="Скопировать строку, уходящую в OpenAI (после санитарной досыпки)"
                aria-label={`Кадр ${index + 1}: скопировать промпт`}
              >
                {copied ? "Скопировано" : "Копировать"}
              </button>
              <button
                type="button"
                className="asset-badge"
                disabled={!canRegenerate}
                onClick={() => void onRegenerate()}
                title="Перегенерировать кадр"
                aria-label={`Кадр ${index + 1}: перегенерировать изображение`}
              >
                ↻
              </button>
              <button
                type="button"
                className="asset-badge"
                onClick={() => setRailSheetOpen(true)}
                title="Промпт и перегенерация в боковой панели"
                aria-label={`Кадр ${index + 1}: открыть панель промпта`}
              >
                Details
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={[
            isThumb
              ? "mx-auto flex w-full min-w-0 flex-[1.35] items-center justify-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elev-3)]"
              : isFrameLike
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
                <span>превью</span>
              )}
            </div>
          )}
        </div>
        {isFrameRail && typeof document !== "undefined" && railSheetOpen
          ? createPortal(
              <div className="frame-rail-sheet-root" role="presentation">
                <button
                  type="button"
                  className="frame-rail-sheet-backdrop"
                  aria-label="Закрыть панель промпта"
                  tabIndex={-1}
                  onClick={() => setRailSheetOpen(false)}
                />
                <div
                  ref={railSheetPanelRef}
                  className="frame-rail-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`frame-rail-sheet-title-${image.id}`}
                >
                  <div className="frame-rail-sheet-head">
                    <h2 id={`frame-rail-sheet-title-${image.id}`} className="frame-rail-sheet-title">
                      Кадр {String(index + 1).padStart(2, "0")} · промпт
                    </h2>
                    <button
                      type="button"
                      className="frame-rail-sheet-close"
                      onClick={() => setRailSheetOpen(false)}
                      aria-label="Закрыть"
                    >
                      ×
                    </button>
                  </div>
                  <div className="frame-rail-sheet-body">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted/90">
                      Английский промпт (Anthropic → вы правите)
                    </div>
                    <textarea
                      value={localPrompt}
                      onChange={(e) => setLocalPrompt(e.target.value)}
                      onBlur={() => commitPromptToStore()}
                      readOnly={lockPromptEdit}
                      title="Плотный английский промпт для gpt-image"
                      placeholder="Сначала получи промпты из диалога…"
                      className="textarea min-h-[140px] w-full font-mono text-[11px] leading-snug"
                    />
                    <div className="text-[10px] text-muted/80">Строка в OpenAI (с досыпкой формата / no-text)</div>
                    <div className="max-h-[100px] overflow-y-auto rounded border border-border bg-black/25 p-2 font-mono text-[10px] text-muted/90">
                      {sanitizedPreview || "—"}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <button
                        type="button"
                        className="asset-badge"
                        disabled={!sanitizedPreview.trim()}
                        onClick={() => void copySanitizedPrompt()}
                      >
                        {copied ? "Скопировано" : "Копировать в API"}
                      </button>
                      <button
                        type="button"
                        className="gen-btn py-2 text-[11px]"
                        onClick={() => void onRegenerate()}
                        disabled={busy || lockPromptEdit}
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
              </div>,
              document.body
            )
          : null}
        {!isFrameRail ? (
          <div className={["min-w-0 overflow-hidden", isThumb ? "min-h-0 flex-1 space-y-2" : "space-y-2"].join(" ")}>
            {isFrameLike || isThumb ? (
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted/90">Промпт картинки (EN)</div>
            ) : (
              <div className="text-xs font-medium text-muted">Промпт картинки (англ.)</div>
            )}
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              onBlur={() => commitPromptToStore()}
              readOnly={lockPromptEdit}
              title="Текст от модели; правка здесь задаёт manualOverride"
              placeholder="Промпт из диалога…"
              className={
                isThumb
                  ? "textarea min-h-[72px] flex-1 resize-none font-mono text-[10px] leading-snug"
                  : isFrameLike
                    ? "textarea min-h-[100px] font-mono text-[11px] leading-snug"
                    : "min-h-32 w-full min-w-0 max-w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 font-mono text-[11px] outline-none focus:ring-2 focus:ring-accent/30"
              }
            />
            {isFrameLike || isThumb ? (
              <div className="text-[10px] text-muted/80">В OpenAI (после санитарной досыпки)</div>
            ) : (
              <div className="text-xs font-medium text-muted">Финальная строка в API</div>
            )}
            <div
              className={
                isThumb
                  ? "max-h-[56px] overflow-y-auto rounded-md border border-border bg-black/20 p-2 font-mono text-[9px] text-muted/85"
                  : isFrameLike
                    ? "max-h-[72px] overflow-y-auto rounded-md border border-border bg-black/20 p-2 font-mono text-[10px] text-muted/85"
                    : "max-h-24 overflow-y-auto rounded-xl border border-border bg-black/25 px-3 py-2 font-mono text-[10px] text-muted/85"
              }
            >
              {sanitizedPreview || "—"}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="asset-badge"
                disabled={!sanitizedPreview.trim()}
                onClick={() => void copySanitizedPrompt()}
              >
                {copied ? "Ок" : "Копировать"}
              </button>
              <button
                type="button"
                onClick={() => void onRegenerate()}
                disabled={busy || lockPromptEdit}
                className={
                  isThumb
                    ? "gen-btn mt-0 py-1.5 text-[10px]"
                    : isFrameLike
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
        ) : null}
      </div>
    </div>
  );
}
