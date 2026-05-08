"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { useStudioActivity } from "@/lib/studio-activity";
import { ImageGenerationProgress } from "@/components/ImageGenerationProgress";
import { ReadinessChecklist } from "@/components/ReadinessChecklist";
import { downloadZip, generateImagesFromState, regenerateOneImage } from "@/lib/actions";
import { requestDialogueTurn } from "@/lib/dialogue-bridge";
import { mergeImagePromptManual, upsertImageBySlideId } from "@/lib/image-prompt-sync";
import { resolveImagePrompt } from "@/lib/image-prompt-pipeline";
import type { Slide } from "@/lib/state";

const OUTPUT_SCENARIO_OPEN_KEY = "ai-reels-studio:v2026:scenarioOpen";

export function OutputPanel() {
  const { state, dispatch } = useStudio();
  const { setZipBusy } = useStudioActivity();
  const [busy, setBusy] = useState<null | string>(null);
  const [regenSlideId, setRegenSlideId] = useState<string | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(OUTPUT_SCENARIO_OPEN_KEY);
      if (raw === "0") return false;
      if (raw === "1") return true;
      return true;
    } catch {
      return true;
    }
  });
  const [mode, setMode] = useState<"draft" | "build">(() => {
    if (typeof window === "undefined") return "draft";
    try {
      return window.localStorage.getItem("ai-reels-studio:v2026:outputsMode") === "build" ? "build" : "draft";
    } catch {
      return "draft";
    }
  });
  const [genError, setGenError] = useState<string | null>(null);
  const [promptsShake, setPromptsShake] = useState(false);
  const genAbortRef = useRef<AbortController | null>(null);
  const showBatchProgress =
    state.images.length > 0 && state.images.some((x) => x.status === "waiting" || x.status === "generating");

  function updateSlide(slideId: string, patch: Partial<Slide>) {
    dispatch({
      type: "set",
      patch: {
        slides: state.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s))
      }
    });
  }

  function promptTextForSlide(slideId: string): string {
    const row = state.imagePrompts.find((p) => p.slideId === slideId);
    return (row?.manualOverride?.trim() || row?.prompt || "").trim();
  }

  function commitImagePrompt(slideId: string, text: string) {
    dispatch({
      type: "set",
      patch: { imagePrompts: mergeImagePromptManual(state, slideId, text) }
    });
  }

  async function onRegenerateSlide(slideId: string) {
    const imgRow = state.images.find((i) => i.slideId === slideId);
    const id = imgRow?.id ?? `img_${slideId}`;
    const ip = mergeImagePromptManual(state, slideId, promptTextForSlide(slideId));
    const merged = { ...state, imagePrompts: ip };
    setRegenSlideId(slideId);
    setGenError(null);
    try {
      const next = await regenerateOneImage(merged, id, slideId);
      dispatch({
        type: "set",
        patch: { imagePrompts: ip, images: upsertImageBySlideId(merged.images, next) }
      });
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Ошибка кадра";
      setGenError(m);
      const errRow: (typeof state.images)[number] = {
        id,
        slideId,
        prompt: imgRow?.prompt ?? "",
        finalPrompt: imgRow?.finalPrompt,
        status: "error",
        error: m
      };
      dispatch({
        type: "set",
        patch: { imagePrompts: ip, images: upsertImageBySlideId(merged.images, errRow) }
      });
      setPromptsShake(true);
      window.setTimeout(() => setPromptsShake(false), 500);
    } finally {
      setRegenSlideId(null);
    }
  }

  function askRewriteImagePrompt(slideIndex: number) {
    const s = state.slides[slideIndex];
    if (!s) return;
    const hint = typeof window !== "undefined" ? window.prompt("Уточнение для модели (необязательно)", "") : "";
    const lines = [
      `Перепиши только английский image prompt для слайда ${slideIndex + 1} (slideId: ${s.id}, заголовок: «${s.title}»).`,
      "Не меняй тексты других слайдов и не пересобирай сценарий целиком.",
      'В statePatch верни только imagePrompts с одним объектом {"slideId","prompt"} для этого slideId.',
      hint && hint.trim() ? `Пожелание: ${hint.trim()}` : ""
    ].filter(Boolean);
    requestDialogueTurn(lines.join("\n"));
  }

  function askGenerateMusic() {
    const hint = typeof window !== "undefined" ? window.prompt("Уточнение по музыке (необязательно)", "") : "";
    const lines = [
      "Подбери музыку для этого проекта и сценария.",
      "Верни ТОЛЬКО statePatch.music в формате: {\"queries\":[],\"recommendations\":[],\"avoid\":[]}.",
      "Queries: короткие поисковые запросы (1 строка = 1 запрос). Recommendations: направления/жанры/темпо/вокал/настроение. Avoid: что избегать.",
      "Не меняй slides, imagePrompts, caption и прочие поля.",
      hint && hint.trim() ? `Пожелание: ${hint.trim()}` : ""
    ].filter(Boolean);
    requestDialogueTurn(lines.join("\n"));
  }

  async function onGenerateImages() {
    if (state.slides.length === 0) return;

    setGenError(null);
    setBusy("images");
    genAbortRef.current?.abort();
    genAbortRef.current = new AbortController();
    try {
      const images = await generateImagesFromState(state, {
        signal: genAbortRef.current.signal,
        onProgress: ({ images: next }) => {
          dispatch({ type: "set", patch: { images: next } });
        }
      });
      dispatch({ type: "set", patch: { images } });
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Ошибка генерации изображений";
      setGenError(m);
      setPromptsShake(true);
      window.setTimeout(() => setPromptsShake(false), 500);
    } finally {
      genAbortRef.current = null;
      setBusy(null);
    }
  }

  async function onDownload() {
    setBusy("zip");
    setZipBusy(true);
    try {
      await downloadZip(state);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Ошибка архива";
      setGenError(m);
      setPromptsShake(true);
      window.setTimeout(() => setPromptsShake(false), 500);
    } finally {
      setZipBusy(false);
      setBusy(null);
    }
  }

  const hasSomethingToExport =
    state.slides.length > 0 ||
    state.imagePrompts.some((p) => p.prompt.trim()) ||
    state.caption.trim().length > 0 ||
    state.music.queries.length > 0 ||
    state.music.recommendations.length > 0 ||
    state.music.avoid.length > 0 ||
    state.messages.length > 0 ||
    state.images.some((i) => i.status === "done");

  const canGenerateImages = state.slides.length > 0;

  const pipelineBusy = showBatchProgress || busy === "images";
  const doneCount = state.images.filter((x) => x.status === "done").length;
  const errCount = state.images.filter((x) => x.status === "error").length;

  const draftSlideCards = useMemo(() => state.slides, [state.slides]);

  useEffect(() => {
    try {
      window.localStorage.setItem("ai-reels-studio:v2026:outputsMode", mode);
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OUTPUT_SCENARIO_OPEN_KEY, scenarioOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [scenarioOpen]);

  return (
    <>
      <div className="panel-strip">
        <div className="strip-row">
          <span className="strip-tag">Вывод</span>
        </div>
        <h2 className="strip-title">
          Экспорт <b>·</b> ZIP
        </h2>
        <div className="seg mt-3" role="group" aria-label="Режим правой панели">
          <button
            type="button"
            className={mode === "draft" ? "active" : ""}
            onClick={() => setMode("draft")}
            disabled={!!busy}
          >
            Черновик
          </button>
          <button
            type="button"
            className={mode === "build" ? "active" : ""}
            onClick={() => setMode("build")}
            disabled={!!busy}
          >
            Сборка
          </button>
        </div>
      </div>

      <div className="assets-body min-h-0">
        {busy === "zip" ? (
          <div className="busy-ribbon mb-3" role="status" aria-live="polite">
            <span className="dot-pulse" aria-hidden />
            Сборка ZIP…
          </div>
        ) : null}

        {mode === "draft" && draftSlideCards.length > 0 ? (
          <div className={["asset-block", promptsShake ? "studio-shake" : ""].filter(Boolean).join(" ")}>
            <div className="asset-head">
              <div className="asset-h">
                Слайды · <b>текст и промпты</b>
              </div>
              <button
                type="button"
                className="asset-badge"
                onClick={() => setScenarioOpen((o) => !o)}
              >
                {scenarioOpen ? "свернуть" : "развернуть"}
              </button>
            </div>
            {scenarioOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {state.approved ? (
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--ok)" }}>Сценарий утверждён.</div>
                ) : null}
                {draftSlideCards.map((s, i) => {
                  const img = state.images.find((x) => x.slideId === s.id);
                  const hasPrompt = Boolean(resolveImagePrompt(state.imagePrompts, s.id));
                  return (
                    <div
                      key={s.id}
                      style={{
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border-subtle)",
                        padding: 12,
                        background: "rgba(8,16,20,0.45)"
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6 }}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <input
                        className="input"
                        style={{ marginBottom: 8 }}
                        value={s.title}
                        onChange={(e) => updateSlide(s.id, { title: e.target.value })}
                        aria-label={`Заголовок слайда ${i + 1}`}
                      />
                      <textarea
                        className="textarea"
                        style={{ minHeight: 72 }}
                        value={s.text}
                        onChange={(e) => updateSlide(s.id, { text: e.target.value })}
                        aria-label={`Текст слайда ${i + 1}`}
                      />
                      <details style={{ marginTop: 10 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Промпт картинки (English)
                        </summary>
                        <textarea
                          className="textarea"
                          style={{ marginTop: 8, minHeight: 100, fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}
                          value={promptTextForSlide(s.id)}
                          onChange={(e) => commitImagePrompt(s.id, e.target.value)}
                          placeholder="Появится из ответа Anthropic…"
                        />
                      </details>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
                        <button
                          type="button"
                          className="gen-btn"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          disabled={!hasPrompt || regenSlideId === s.id || pipelineBusy}
                          onClick={() => void onRegenerateSlide(s.id)}
                        >
                          {regenSlideId === s.id ? "…" : "Перегенерировать этот кадр"}
                        </button>
                        <button
                          type="button"
                          className="studio-btn-ghost rounded-lg border border-border bg-black/20 px-3 py-1.5 text-xs"
                          onClick={() => askRewriteImagePrompt(i)}
                        >
                          Попросить Anthropic переписать промпт
                        </button>
                      </div>
                      {img?.imageBase64 && img.status === "done" ? (
                        <div
                          style={{
                            marginTop: 10,
                            maxWidth: 140,
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "1px solid var(--border-subtle)"
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${img.mimeType ?? "image/png"};base64,${img.imageBase64}`}
                            alt=""
                            style={{ width: "100%", display: "block" }}
                          />
                        </div>
                      ) : null}
                      {img?.error ? (
                        <p style={{ marginTop: 8, fontSize: 11, color: "#fca5a5" }}>{img.error}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {genError && mode === "draft" ? (
              <p style={{ marginTop: 10, fontSize: 11, color: "#fca5a5" }}>{genError}</p>
            ) : null}
          </div>
        ) : null}

        {mode === "build" ? (
          <div className={["asset-block", promptsShake ? "studio-shake" : ""].filter(Boolean).join(" ")}>
            <div className="asset-head">
              <div className="asset-h">
                Сборка <b>пакета</b>
              </div>
              <span className="asset-badge">сборка</span>
            </div>

            <ReadinessChecklist state={state} compact />

            <div className="field" style={{ marginTop: 10 }}>
              <span className="label mono">Автогенерация</span>
              <div
                className="seg"
                role="group"
                aria-label="Автогенерация кадров из чата"
                style={{ maxWidth: 260 }}
              >
                <button
                  type="button"
                  className={!state.autoGenerateImages ? "active" : ""}
                  onClick={() => dispatch({ type: "set", patch: { autoGenerateImages: false } })}
                  disabled={!!busy}
                  title="Кадры только по кнопке"
                >
                  Выкл
                </button>
                <button
                  type="button"
                  className={state.autoGenerateImages ? "active" : ""}
                  onClick={() => dispatch({ type: "set", patch: { autoGenerateImages: true } })}
                  disabled={!!busy}
                  title="Явный запрос в чате может запустить генерацию"
                >
                  Вкл
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="asset-badge">слайдов: {state.slides.length}</span>
              <span className="asset-badge">
                кадров: {doneCount}/{state.images.length || 0}
              </span>
              {errCount ? <span className="asset-badge">ошибок: {errCount}</span> : null}
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="gen-btn"
                  onClick={() => void onGenerateImages()}
                  disabled={!!busy || !canGenerateImages}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v10M8 7l4-4 4 4M5 21h14" />
                  </svg>
                  {busy === "images" ? (
                    <span className="studio-pulse-slow">Генерация…</span>
                  ) : (
                    "Сгенерировать все картинки"
                  )}
                </button>
                <button
                  type="button"
                  className="studio-btn-ghost rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30 disabled:opacity-50"
                  onClick={() => genAbortRef.current?.abort()}
                  disabled={!genAbortRef.current || busy !== "images"}
                >
                  Прервать
                </button>
              </div>
              {showBatchProgress ? <ImageGenerationProgress images={state.images} /> : null}
              {genError ? (
                <p style={{ marginTop: 10, fontSize: 11, color: "#fca5a5" }}>{genError}</p>
              ) : null}
              {!canGenerateImages ? (
                <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                  Нужны слайды из диалога — затем промпты от модели и «Сгенерировать все картинки».
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {mode === "draft" ? (
          <div className="asset-block">
            <div className="asset-head">
              <div className="asset-h">
                Подпись к <b>посту</b>
              </div>
              <span className="asset-badge">текст</span>
            </div>
            <textarea
              className="textarea"
              value={state.caption}
              onChange={(e) => dispatch({ type: "set", patch: { caption: e.target.value } })}
              placeholder="Подпись…"
              rows={4}
            />
          </div>
        ) : null}

        <div className="asset-block">
          <div className="asset-head">
            <div className="asset-h">Музыка</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="asset-badge">мета</span>
              <button
                type="button"
                className="asset-badge"
                onClick={() => askGenerateMusic()}
                disabled={!!busy}
                title="Попросить модель заполнить music (queries / recommendations / avoid)"
              >
                Запросить у модели
              </button>
            </div>
          </div>
          <div className="field">
            <span className="label mono">Поиск</span>
            <textarea
              className="textarea"
              value={state.music.queries.join("\n")}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  patch: {
                    music: {
                      ...state.music,
                      queries: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)
                    }
                  }
                })
              }
              placeholder="Одна строка — один запрос"
              rows={3}
            />
          </div>
          <div className="field">
            <span className="label mono">Направления</span>
            <textarea
              className="textarea"
              value={state.music.recommendations.join("\n")}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  patch: {
                    music: {
                      ...state.music,
                      recommendations: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)
                    }
                  }
                })
              }
              rows={3}
            />
          </div>
          <div className="field">
            <span className="label mono">Избегать</span>
            <textarea
              className="textarea"
              value={state.music.avoid.join("\n")}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  patch: {
                    music: {
                      ...state.music,
                      avoid: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)
                    }
                  }
                })
              }
              rows={2}
            />
          </div>
        </div>

        <div className="export-dock">
          <div className="export-dock-title">Архив</div>
          <button
            type="button"
            className="download-btn"
            onClick={() => void onDownload()}
            disabled={!!busy || !hasSomethingToExport}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
            </svg>
            {busy === "zip" ? "Сборка…" : "Скачать ZIP"}
          </button>
        </div>
      </div>
    </>
  );
}
