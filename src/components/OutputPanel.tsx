"use client";

import { useMemo, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { ImageSlideCard } from "@/components/ImageSlideCard";
import { downloadZip, generateImagesFromState } from "@/lib/actions";
import type { SlidePrompt } from "@/lib/state";

export function OutputPanel() {
  const { state, dispatch } = useStudio();
  const [busy, setBusy] = useState<null | string>(null);
  const [scenarioOpen, setScenarioOpen] = useState(true);

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

    setBusy("images");
    try {
      const images = await generateImagesFromState(state);
      dispatch({ type: "set", patch: { images } });
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    setBusy("zip");
    try {
      await downloadZip(state);
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

  const canGenerateImages =
    state.slides.length > 0
      ? state.slides.some((s) => state.prompts.find((p) => p.slideId === s.id)?.prompt?.trim())
      : state.prompts.some((p) => p.prompt.trim());

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <div>
        <div className="text-sm font-medium text-muted">Вывод</div>
        <div className="text-xl font-semibold tracking-tight">Ассеты</div>
        <p className="mt-1 text-xs text-muted">
          Здесь — сценарий, промпты, подпись и музыка после запросов в диалоге. Картинки — только кнопкой ниже.
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

      <div className="rounded-xl border border-border bg-black/20 p-3">
        <div className="text-xs font-medium text-muted">Промпты по кадрам</div>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Одна строка — один кадр (порядок как у слайдов). Можно править вручную; диалог не перезаписывает без
          запроса.
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
          className="mt-2 w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30 disabled:opacity-50"
        >
          {busy === "images" ? "Генерация…" : "Generate images"}
        </button>
      </div>

      <div className="min-h-0 space-y-3">
        <div className="text-xs font-medium text-muted">Изображения</div>
        {state.images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-black/10 p-4 text-center text-xs text-muted">
            После промптов нажми «Generate images». Перегенерация — у каждого кадра.
          </div>
        ) : (
          state.images.map((img, idx) => <ImageSlideCard key={img.id} index={idx} image={img} />)
        )}
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

      <button
        type="button"
        onClick={() => void onDownload()}
        disabled={!!busy || !hasSomethingToExport}
        className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text hover:bg-accent/15 disabled:opacity-50"
      >
        {busy === "zip" ? "Архив…" : "Download ZIP"}
      </button>
    </div>
  );
}
