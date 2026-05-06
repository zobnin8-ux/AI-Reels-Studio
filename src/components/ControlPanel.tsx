"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import type { ProjectId, StudioState } from "@/lib/state";
import { parseSessionImport, SESSION_EXPORT_VERSION } from "@/lib/session-import";

const projectOptions: { id: ProjectId; label: string }[] = [
  { id: "poslenego", label: "После него" },
  { id: "zobnin", label: "Zobnin AI" },
  { id: "olgatrip", label: "OlgaTrip" }
];

const emptyMusic = () => ({ queries: [] as string[], recommendations: [] as string[], avoid: [] as string[] });
const BG_MODE_KEY = "ai-reels-studio:v2026:bgMode";

type SessionImportNotice = { kind: "ok" | "error"; message: string };

function defaultsForProject(project: ProjectId): Partial<StudioState> {
  if (project === "olgatrip") {
    return {
      mood: "soft",
      visualStyle: "lightMinimal",
      outputMode: "both",
      ctaMode: "direct",
      website: "olgatrip.com",
      triggerWord: "море",
      customCta: ""
    };
  }
  if (project === "poslenego") {
    return {
      ctaMode: "website",
      website: "poslenego.com",
      triggerWord: "",
      customCta: ""
    };
  }
  return {};
}

export function ControlPanel() {
  const { state, dispatch } = useStudio();
  const prevProject = useRef<ProjectId>(state.project);
  /** true = класс `showcase` на body (сетка, шум, скан); false = спокойный фон для записи экрана */
  const [richStudioBackground, setRichStudioBackground] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(BG_MODE_KEY) === "rich";
    } catch {
      return false;
    }
  });
  const importRef = useRef<HTMLInputElement>(null);
  const [importNotice, setImportNotice] = useState<SessionImportNotice | null>(null);

  useEffect(() => {
    document.body.classList.toggle("showcase", richStudioBackground);
  }, [richStudioBackground]);

  useEffect(() => {
    if (!importNotice) return;
    const ms = importNotice.kind === "error" ? 12_000 : 7000;
    const t = window.setTimeout(() => setImportNotice(null), ms);
    return () => window.clearTimeout(t);
  }, [importNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(BG_MODE_KEY, richStudioBackground ? "rich" : "calm");
    } catch {
      // ignore
    }
  }, [richStudioBackground]);

  const hasCreativeContent = useMemo(() => {
    return (
      state.messages.length > 0 ||
      state.slides.length > 0 ||
      state.angles.length > 0 ||
      state.prompts.some((p) => p.prompt.trim().length > 0) ||
      state.caption.trim().length > 0 ||
      state.music.queries.length > 0 ||
      state.music.recommendations.length > 0 ||
      state.images.length > 0 ||
      state.sceneMeta.length > 0
    );
  }, [
    state.messages.length,
    state.slides.length,
    state.angles.length,
    state.prompts,
    state.caption,
    state.music,
    state.images.length,
    state.sceneMeta.length
  ]);

  function resetContentAfterProjectSwitch(nextProject: ProjectId) {
    dispatch({
      type: "set",
      patch: {
        project: nextProject,
        messages: [],
        topic: "",
        selectedAngleId: null,
        angles: [],
        slides: [],
        approved: false,
        prompts: [],
        sceneMeta: [],
        images: [],
        caption: "",
        music: emptyMusic(),
        ...defaultsForProject(nextProject)
      }
    });
  }

  function onProjectChange(nextProject: ProjectId) {
    if (nextProject === state.project) return;
    if (hasCreativeContent) {
      const ok = window.confirm("Смена проекта сбросит текущий сценарий, диалог и вывод.");
      if (!ok) {
        dispatch({ type: "set", patch: { project: prevProject.current } });
        return;
      }
    }
    prevProject.current = nextProject;
    resetContentAfterProjectSwitch(nextProject);
  }

  function exportSessionJson() {
    try {
      const envelope = {
        v: SESSION_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        state
      };
      const payload = JSON.stringify(envelope, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-reels-studio-session-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const res = parseSessionImport(parsed);
      if (!res.ok) {
        setImportNotice({ kind: "error", message: `Импорт отклонён: ${res.error}` });
        return;
      }
      dispatch({ type: "replace", state: res.state, resetSessionUndo: true });
      setImportNotice({ kind: "ok", message: "Сессия загружена из файла." });
    } catch {
      setImportNotice({
        kind: "error",
        message: "Не удалось прочитать файл."
      });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <>
      <div className="panel-strip">
        <div className="strip-row">
          <span className="strip-tag">Параметры</span>
        </div>
        <h2 className="strip-title">
          Сессия <b>контур</b>
        </h2>
      </div>

      <div className="panel-body min-h-0">
        {importNotice ? (
          <div
            role="status"
            aria-live="polite"
            className={[
              "session-import-notice",
              importNotice.kind === "ok" ? "session-import-notice--ok" : "session-import-notice--err"
            ].join(" ")}
          >
            <span>{importNotice.message}</span>
            <button
              type="button"
              className="session-import-notice-dismiss"
              onClick={() => setImportNotice(null)}
              aria-label="Закрыть уведомление"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="group">
          <div className="group-title">Проект</div>
          <div className="field">
            <span className="label mono">Профиль</span>
            <select
              className="select"
              value={state.project}
              onChange={(e) => onProjectChange(e.target.value as ProjectId)}
            >
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="group">
          <div className="group-title">Формат и длина</div>
          <div className="field-row">
            <div className="field">
              <span className="label">Тип</span>
              <select
                className="select"
                value={state.contentType}
                onChange={(e) =>
                  dispatch({ type: "set", patch: { contentType: e.target.value as StudioState["contentType"] } })
                }
              >
                <option value="reels">Ролики · 9:16 · 1080×1920</option>
                <option value="post">Пост · 4:5 (1080×1350)</option>
              </select>
            </div>
            <div className="field">
              <span className="label">Кадров</span>
              <select
                className="select"
                value={state.slideCount}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    patch: { slideCount: Number(e.target.value) as StudioState["slideCount"] }
                  })
                }
              >
                {[5, 7, 9, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="group">
          <div className="group-title">CTA и вывод</div>
          <div className="field">
            <span className="label">Режим CTA</span>
            <select
              className="select"
              value={state.ctaMode}
              onChange={(e) =>
                dispatch({ type: "set", patch: { ctaMode: e.target.value as StudioState["ctaMode"] } })
              }
            >
              <option value="website">Сайт</option>
              <option value="direct">Триггер в кадре</option>
              <option value="none">Без CTA</option>
              <option value="custom">Свой текст</option>
            </select>
          </div>
          {state.ctaMode === "website" ? (
            <div className="conditional">
              <div className="field">
                <span className="label mono">Сайт</span>
                <input
                  className="input"
                  value={state.website}
                  onChange={(e) => dispatch({ type: "set", patch: { website: e.target.value } })}
                  placeholder="poslenego.com"
                />
              </div>
            </div>
          ) : null}
          {state.ctaMode === "direct" ? (
            <div className="conditional">
              <div className="field">
                <span className="label mono">Триггер</span>
                <input
                  className="input"
                  value={state.triggerWord}
                  onChange={(e) => dispatch({ type: "set", patch: { triggerWord: e.target.value } })}
                  placeholder="Триггер-слово"
                />
              </div>
            </div>
          ) : null}
          {state.ctaMode === "custom" ? (
            <div className="conditional">
              <div className="field">
                <span className="label mono">Свой CTA</span>
                <input
                  className="input"
                  value={state.customCta}
                  onChange={(e) => dispatch({ type: "set", patch: { customCta: e.target.value } })}
                  placeholder="Свой CTA"
                />
              </div>
            </div>
          ) : null}
          <div className="field">
            <span className="label">Текст в выводе</span>
            <select
              className="select"
              value={state.outputMode}
              onChange={(e) =>
                dispatch({ type: "set", patch: { outputMode: e.target.value as StudioState["outputMode"] } })
              }
            >
              <option value="textInImages">Текст в кадрах</option>
              <option value="textSeparate">Текст отдельно</option>
              <option value="both">И то, и другое</option>
            </select>
          </div>
        </div>

        <div className="group">
          <div className="group-title">Тема</div>
          <div className="field">
            <span className="label mono">Тема</span>
            <input
              className="input"
              value={state.topic}
              onChange={(e) => dispatch({ type: "set", patch: { topic: e.target.value } })}
              placeholder="Тема / что обсуждаем?"
            />
          </div>
        </div>

        <div className="group">
          <div className="group-title">Фон студии</div>
          <div className="field">
            <span className="label mono">Режим оформления</span>
            <div className="mode-pill" role="group" aria-label="Режим оформления фона">
              <button
                type="button"
                className={!richStudioBackground ? "active" : ""}
                onClick={() => setRichStudioBackground(false)}
              >
                Спокойный
              </button>
              <button
                type="button"
                className={richStudioBackground ? "active" : ""}
                onClick={() => setRichStudioBackground(true)}
              >
                Насыщенный
              </button>
            </div>
          </div>
        </div>

        <div className="group">
          <div className="group-title">Провайдер</div>
          <div className="seg" role="group" aria-label="Провайдер LLM">
            <button
              type="button"
              className={state.provider === "openai" ? "active" : ""}
              onClick={() => dispatch({ type: "set", patch: { provider: "openai" } })}
            >
              OpenAI
            </button>
            <button
              type="button"
              className={state.provider === "anthropic" ? "active" : ""}
              onClick={() => dispatch({ type: "set", patch: { provider: "anthropic" } })}
            >
              Anthropic
            </button>
          </div>
        </div>

        <details className="group session-file-details">
          <summary className="group-title session-file-summary">Файл сессии</summary>
          <div className="field-row session-file-fields">
            <div className="field">
              <button type="button" className="gen-btn w-full" onClick={() => exportSessionJson()}>
                Сохранить файл
              </button>
            </div>
            <div className="field">
              <button type="button" className="gen-btn w-full" onClick={() => importRef.current?.click()}>
                Загрузить файл
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="field session-file-reset">
            <button
              type="button"
              className="studio-btn-ghost w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30"
              onClick={() => {
                const ok = window.confirm("Сбросить всю сессию? Это очистит диалог, сценарий и ассеты.");
                if (ok) dispatch({ type: "resetAll" });
              }}
            >
              Сбросить всё
            </button>
          </div>
        </details>
      </div>
    </>
  );
}
