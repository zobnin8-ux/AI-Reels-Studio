"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { useStudioActivity } from "@/lib/studio-activity";
import { ImageGenerationProgress } from "@/components/ImageGenerationProgress";
import { ReadinessChecklist } from "@/components/ReadinessChecklist";
import { downloadZip, generateImagesFromState } from "@/lib/actions";
import type { SlidePrompt } from "@/lib/state";

const OUTPUT_SCENARIO_OPEN_KEY = "ai-reels-studio:v2026:scenarioOpen";

export function OutputPanel() {
  const { state, dispatch } = useStudio();
  const { setZipBusy } = useStudioActivity();
  const [busy, setBusy] = useState<null | string>(null);
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

  const promptLinesText = useMemo(() => {
    if (state.slides.length === 0) {
      return state.prompts.map((p) => p.prompt).join("\n");
    }
    return state.slides
      .map((s) => state.prompts.find((p) => p.slideId === s.id)?.prompt ?? "")
      .join("\n");
  }, [state.slides, state.prompts]);

  function applyPromptTextarea(next: string) {
    const lines = next.split("\n");
    if (state.slides.length === 0) {
      const prompts: SlidePrompt[] = lines.map((prompt, i) => ({
        slideId: `slide_${i}`,
        prompt
      }));
      dispatch({ type: "set", patch: { prompts } });
      return;
    }
    const prompts: SlidePrompt[] = state.slides.map((s, i) => ({
      slideId: s.id,
      prompt: lines[i] ?? ""
    }));
    dispatch({ type: "set", patch: { prompts } });
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
    state.prompts.some((p) => p.prompt.trim()) ||
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

  // Persist mode so the panel feels stable.
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
          <span className="strip-meta">ассеты</span>
        </div>
        <h2 className="strip-title">
          Экспорт <b>·</b> ZIP
        </h2>
        <p className="strip-sub">
          Сценарий, опциональные уточнения к кадрам, подпись, музыка и сборка архива.
        </p>
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

        {mode === "draft" && state.slides.length > 0 ? (
          <div className="asset-block">
            <div className="asset-head">
              <div className="asset-h">
                Сценарий · <b>превью</b>
              </div>
              <button
                type="button"
                className="asset-badge"
                onClick={() => setScenarioOpen((o) => !o)}
              >
                {scenarioOpen ? "свернуть" : "развернуть"}
              </button>
            </div>
            <p className="asset-desc">Структура слайдов из диалога.</p>
            {scenarioOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {state.slides.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border-subtle)",
                      padding: 10,
                      background: "rgba(8,16,20,0.45)"
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>
                      {String(i + 1).padStart(2, "0")}. {s.title}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                      {s.text}
                    </div>
                  </div>
                ))}
                {state.approved ? (
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--ok)" }}>Сценарий утверждён.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "draft" ? (
          <div className={["asset-block", promptsShake ? "studio-shake" : ""].filter(Boolean).join(" ")}>
            <div className="asset-head">
              <div className="asset-h">
                Уточнения <b>по кадрам</b>
              </div>
              <span className="asset-badge">опция</span>
            </div>
            <p className="asset-desc">
              Опционально: короткие правки к автособранному промпту (одна строка — один кадр). Картинки строятся из
              текста слайда + селекторов; это поле можно оставить пустым.
            </p>
            <textarea
              className="textarea"
              value={promptLinesText}
              onChange={(e) => applyPromptTextarea(e.target.value)}
              placeholder={
                state.slides.length
                  ? "Уточнения по строкам — порядок как у слайдов (можно пусто)."
                  : "Сначала слайды из диалога."
              }
              rows={10}
            />
          </div>
        ) : (
          <div className={["asset-block", promptsShake ? "studio-shake" : ""].filter(Boolean).join(" ")}>
            <div className="asset-head">
              <div className="asset-h">
                Сборка <b>пакета</b>
              </div>
              <span className="asset-badge">сборка</span>
            </div>
            <p className="asset-desc">
              Тут только то, что нужно для финального результата: генерация кадров и скачивание ZIP.
            </p>

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
                  title="Кадры только по кнопке «Сгенерировать кадры»"
                >
                  Выкл
                </button>
                <button
                  type="button"
                  className={state.autoGenerateImages ? "active" : ""}
                  onClick={() => dispatch({ type: "set", patch: { autoGenerateImages: true } })}
                  disabled={!!busy}
                  title="Если в сообщении явно попросить «сгенерируй кадры», студия запустит генерацию автоматически"
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
                    "Сгенерировать кадры"
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
                  Нужны слайды из диалога — затем «Сгенерировать кадры».
                </p>
              ) : null}
            </div>
          </div>
        )}

        {mode === "draft" ? (
          <div className="asset-block">
          <div className="asset-head">
            <div className="asset-h">
              Подпись к <b>посту</b>
            </div>
            <span className="asset-badge">текст</span>
          </div>
          <p className="asset-desc">Подпись из диалога или правка здесь.</p>
          <textarea
            className="textarea"
            value={state.caption}
            onChange={(e) => dispatch({ type: "set", patch: { caption: e.target.value } })}
            placeholder="Подпись…"
            rows={4}
          />
          </div>
        ) : null}

        {mode === "draft" ? (
          <div className="asset-block">
          <div className="asset-head">
            <div className="asset-h">
              Музыка <b>meta</b>
            </div>
            <span className="asset-badge">мета</span>
          </div>
          <p className="asset-desc">Поисковые запросы и направления (без стриминга).</p>
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
        ) : null}

        <div className="export-dock">
          <div className="export-dock-title">Финальный пакет</div>
          <div className="export-list">
            В архив попадут: <span>сценарий</span>, <span>промпты OpenAI</span>,{" "}
            <span>уточнения</span>, <span>кадры</span>,{" "}
            <span>подпись</span> и <span>музыка</span> (если заполнены).
          </div>
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
