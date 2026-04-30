"use client";

import { useMemo, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { ImageGenerationProgress } from "@/components/ImageGenerationProgress";
import { downloadZip, generateImagesFromState } from "@/lib/actions";
import type { SlidePrompt } from "@/lib/state";

export function OutputPanel() {
  const { state, dispatch } = useStudio();
  const [busy, setBusy] = useState<null | string>(null);
  const [scenarioOpen, setScenarioOpen] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [promptsShake, setPromptsShake] = useState(false);
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
    const hasPrompt =
      state.slides.length > 0
        ? state.slides.some((s) => state.prompts.find((p) => p.slideId === s.id)?.prompt?.trim())
        : state.prompts.some((p) => p.prompt.trim());
    if (!hasPrompt) return;

    setGenError(null);
    setBusy("images");
    try {
      const images = await generateImagesFromState(state, {
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
      setBusy(null);
    }
  }

  async function onDownload() {
    setBusy("zip");
    try {
      await downloadZip(state);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Ошибка архива";
      setGenError(m);
      setPromptsShake(true);
      window.setTimeout(() => setPromptsShake(false), 500);
    } finally {
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

  const allSlidesHavePrompts =
    state.slides.length > 0
      ? state.slides.every((s) => state.prompts.find((p) => p.slideId === s.id)?.prompt?.trim())
      : state.prompts.length > 0 && state.prompts.every((p) => p.prompt.trim());

  const canGenerateImages =
    state.slides.length > 0
      ? state.slides.some((s) => state.prompts.find((p) => p.slideId === s.id)?.prompt?.trim())
      : state.prompts.some((p) => p.prompt.trim());

  const pipelineBusy = showBatchProgress || busy === "images";

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
        <p className="strip-sub">Сценарий, промпты, подпись, музыка и сборка архива.</p>
      </div>

      <div className="assets-body min-h-0">
        {busy === "zip" ? (
          <div className="busy-ribbon mb-3" role="status" aria-live="polite">
            <span className="dot-pulse" aria-hidden />
            Сборка ZIP…
          </div>
        ) : null}

        {state.slides.length > 0 ? (
          <div className="asset-block">
            <div className="asset-head">
              <div className="asset-h">
                Сценарий <b>preview</b>
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

        <div className={["asset-block", promptsShake ? "studio-shake" : ""].filter(Boolean).join(" ")}>
          <div className="asset-head">
            <div className="asset-h">
              Промпты <b>по кадрам</b>
            </div>
            <span className="asset-badge">lines</span>
          </div>
          <p className="asset-desc">
            Одна строка — один кадр. Совпадает с Generate images. Blur поля промпта в карточке кадра сохраняет
            state.
          </p>
          <textarea
            className="textarea"
            value={promptLinesText}
            onChange={(e) => applyPromptTextarea(e.target.value)}
            placeholder={
              state.slides.length
                ? "Промпты по строкам — как слайды слева направо."
                : "Сначала слайды из диалога, или введи строки вручную."
            }
            rows={10}
          />
          <button
            type="button"
            className="gen-btn"
            onClick={() => void onGenerateImages()}
            disabled={!!busy || !canGenerateImages}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v10M8 7l4-4 4 4M5 21h14" />
            </svg>
            {busy === "images" ? <span className="studio-pulse-slow">Генерация…</span> : "Generate images"}
          </button>
          {pipelineBusy && busy === "images" ? (
            <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
              Полоса прогресса по кадрам — ниже.
            </p>
          ) : null}
          {showBatchProgress ? <ImageGenerationProgress images={state.images} /> : null}
          {genError ? (
            <p style={{ marginTop: 10, fontSize: 11, color: "#fca5a5" }}>{genError}</p>
          ) : null}
          {!canGenerateImages ? (
            <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              Нужен хотя бы один непустой промпт.
            </p>
          ) : state.slides.length > 0 && !allSlidesHavePrompts ? (
            <p style={{ marginTop: 8, fontSize: 11, color: "var(--warn)" }}>
              Для всех {state.slides.length} слайдов нужна строка промпта.
            </p>
          ) : null}
        </div>

        <div className="asset-block">
          <div className="asset-head">
            <div className="asset-h">
              Caption <b>пост</b>
            </div>
            <span className="asset-badge">text</span>
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

        <div className="asset-block">
          <div className="asset-head">
            <div className="asset-h">
              Музыка <b>meta</b>
            </div>
            <span className="asset-badge">library</span>
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

        <div className="export-dock">
          <div className="export-dock-title">Финальный пакет</div>
          <div className="export-list">
            В архив попадут: <span>сценарий</span>, <span>промпты</span>, <span>кадры</span>,{" "}
            <span>caption</span> и <span>музыка</span> (если заполнены).
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
            {busy === "zip" ? "Сборка…" : "Download ZIP"}
          </button>
        </div>
      </div>
    </>
  );
}
