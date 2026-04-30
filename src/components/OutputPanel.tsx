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
        ? state.slides.some((s) =>
            state.prompts.find((p) => p.slideId === s.id)?.prompt?.trim()
          )
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
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto pr-0.5">
        {pipelineBusy ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-cyan-400/60 bg-cyan-950/55 px-3 py-2 text-[12px] font-medium leading-snug text-cyan-50 shadow-[inset_0_0_26px_rgba(6,182,212,0.22)]"
          >
            <span
              className="studio-dot-soft h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.55)]"
              aria-hidden
            />
            Генерация кадров… ждите завершения полосы прогресса.
          </div>
        ) : null}
        {busy === "zip" ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-amber-400/55 bg-amber-950/45 px-3 py-2 text-[12px] font-medium leading-snug text-amber-50"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300/90" aria-hidden />
            Сборка ZIP…
          </div>
        ) : null}

        <div>
          <div className="text-sm font-medium text-muted">Вывод</div>
          <div className="text-xl font-semibold tracking-tight">Ассеты</div>
          <p className="mt-1 text-xs text-muted">
            Сценарий, промпты, подпись и музыка. Превью кадров — в узкой колонке у чата; здесь кнопка генерации и
            ZIP.
          </p>
        </div>

        {state.slides.length > 0 ? (
          <div className="rounded-xl border border-border bg-black/20 p-3">
            <button
            type="button"
            onClick={() => setScenarioOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-muted"
          >
            Сценарий (preview)
            <span className="text-[10px]">{scenarioOpen ? "−" : "+"}</span>
            </button>
          {scenarioOpen ? (
            <div className="mt-2 space-y-3 text-sm">
              {state.slides.map((s, i) => (
                <div key={s.id} className="rounded-lg border border-border/60 bg-black/20 p-2">
                  <div className="text-[11px] font-semibold text-muted">
                    {String(i + 1).padStart(2, "0")}. {s.title}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{s.text}</div>
                </div>
              ))}
              {state.approved ? (
                <div className="text-[11px] font-medium text-accent">Сценарий отмечен как утверждённый.</div>
              ) : null}
            </div>
          ) : null}
          </div>
        ) : null}

      <div
        className={[
          "rounded-xl border border-border bg-black/20 p-3",
          promptsShake ? "studio-shake border-red-400/35" : ""
        ].join(" ")}
      >
        <div className="text-xs font-medium text-muted">Промпты по кадрам</div>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Одна строка — один кадр (порядок как у слайдов 1→N). То же попадает в «Generate images». Если правишь
          промпт в карточке кадра ниже — кликни мимо поля (blur), чтобы сохранить в состояние.
        </p>
        <textarea
          value={promptLinesText}
          onChange={(e) => applyPromptTextarea(e.target.value)}
          placeholder={
            state.slides.length
              ? "Промпты по строкам — совпадают со слайдами слева направо."
              : "Сначала появятся слайды в диалоге, или введи промпты построчно."
          }
          rows={10}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="button"
          onClick={() => void onGenerateImages()}
          disabled={!!busy || !canGenerateImages}
          className="studio-btn-primary mt-2 w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30 disabled:opacity-50"
        >
          {busy === "images" ? (
            <span className="studio-pulse-slow">Генерация…</span>
          ) : (
            "Generate images"
          )}
        </button>
        {showBatchProgress ? (
          <ImageGenerationProgress images={state.images} />
        ) : null}
        {genError ? (
          <p className="mt-2 text-[11px] leading-snug text-red-300/95">{genError}</p>
        ) : null}
        {!canGenerateImages ? (
          <p className="mt-1 text-[11px] text-muted">
            Кнопка активна, когда есть хотя бы один непустой промпт в блоке выше (или из диалога в state).
          </p>
        ) : state.slides.length > 0 && !allSlidesHavePrompts ? (
          <p className="mt-1 text-[11px] text-amber-200/90">
            Для всех {state.slides.length} слайдов должна быть строка промпта; иначе часть кадров выдаст ошибку.
            Допиши пустые строки или попроси полный список промптов в диалоге.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-black/20 p-3">
        <div className="text-xs font-medium text-muted">Caption</div>
        <textarea
          value={state.caption}
          onChange={(e) => dispatch({ type: "set", patch: { caption: e.target.value } })}
          placeholder="Подпись из диалога или правка здесь…"
          rows={4}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="rounded-xl border border-border bg-black/20 p-3">
        <div className="text-xs font-medium text-muted">Музыка</div>
        <p className="mt-1 text-[11px] text-muted">Поисковые запросы и направления (без стриминга).</p>
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-[10px] font-medium uppercase text-muted">Поиск</div>
            <textarea
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
              placeholder="Одна строка — один запрос к библиотеке"
              rows={3}
              className="mt-1 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase text-muted">Направления</div>
            <textarea
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
              className="mt-1 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase text-muted">Избегать</div>
            <textarea
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
              className="mt-1 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
      </div>
      </div>

      <div className="shrink-0 border-t border-border bg-panel pt-3">
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={!!busy || !hasSomethingToExport}
          className="studio-btn-primary w-full rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text hover:bg-accent/15 disabled:opacity-50"
        >
          {busy === "zip" ? "Архив…" : "Download ZIP"}
        </button>
      </div>
    </div>
  );
}
