"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { ReadinessChecklist } from "@/components/ReadinessChecklist";
import type { ProjectId, StudioState } from "@/lib/state";

const projectOptions: { id: ProjectId; label: string }[] = [
  { id: "poslenego", label: "После него" },
  { id: "zobnin", label: "Zobnin AI" },
  { id: "olgatrip", label: "OlgaTrip" }
];

const emptyMusic = () => ({ queries: [] as string[], recommendations: [] as string[], avoid: [] as string[] });

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
  const [richStudioBackground, setRichStudioBackground] = useState(true);

  useEffect(() => {
    document.body.classList.toggle("showcase", richStudioBackground);
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
      state.images.length > 0
    );
  }, [
    state.messages.length,
    state.slides.length,
    state.angles.length,
    state.prompts,
    state.caption,
    state.music,
    state.images.length
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

  const stripMeta = "live · api";

  return (
    <>
      <div className="panel-strip">
        <div className="strip-row">
          <span className="strip-tag">Параметры</span>
          <span className="strip-meta">{stripMeta}</span>
        </div>
        <h2 className="strip-title">
          Сессия <b>контур</b>
        </h2>
        <p className="strip-sub">Контур съёмки: проект, формат, тон и провайдер модели.</p>
      </div>

      <div className="panel-body min-h-0">
        <div className="group">
          <div className="group-title">Проект</div>
          <p className="group-hint">Контекст и системный промпт. Смена очистит черновик.</p>
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
          <p className="group-hint">Как выглядит вывод и сколько кадров в сценарии.</p>
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
                <option value="reels">Reels · 9:16 · 1080×1920</option>
                <option value="post">Post · 4:5 (1080×1350)</option>
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
          <div className="group-title">Тон и стиль</div>
          <p className="group-hint">Настроение для текста в чате и для света/контраста в генерации кадров.</p>
          <div className="field-row">
            <div className="field">
              <span className="label">Тон</span>
              <select
                className="select"
                value={state.mood}
                onChange={(e) =>
                  dispatch({ type: "set", patch: { mood: e.target.value as StudioState["mood"] } })
                }
              >
                <option value="aggressive">Aggressive</option>
                <option value="soft">Soft</option>
                <option value="provocative">Provocative</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div className="field">
              <span className="label">Визуал</span>
              <select
                className="select"
                value={state.visualStyle}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    patch: { visualStyle: e.target.value as StudioState["visualStyle"] }
                  })
                }
              >
                <option value="darkBrutal">Dark brutal</option>
                <option value="lightMinimal">Light minimal</option>
                <option value="brightPositive">Bright positive</option>
                <option value="portraLifestyle">Portra lifestyle</option>
                <option value="editorial">Editorial</option>
                <option value="tech">Tech</option>
              </select>
            </div>
          </div>
        </div>

        <div className="group">
          <div className="group-title">CTA и вывод</div>
          <p className="group-hint">Как зовём в действие и где текст относительно картинки.</p>
          <div className="field">
            <span className="label">CTA mode</span>
            <select
              className="select"
              value={state.ctaMode}
              onChange={(e) =>
                dispatch({ type: "set", patch: { ctaMode: e.target.value as StudioState["ctaMode"] } })
              }
            >
              <option value="website">Website</option>
              <option value="direct">Direct trigger</option>
              <option value="none">None</option>
              <option value="custom">Custom</option>
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
            <span className="label">Output mode</span>
            <select
              className="select"
              value={state.outputMode}
              onChange={(e) =>
                dispatch({ type: "set", patch: { outputMode: e.target.value as StudioState["outputMode"] } })
              }
            >
              <option value="textInImages">Text inside images</option>
              <option value="textSeparate">Text separate</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>

        <div className="group">
          <div className="group-title">Тема</div>
          <p className="group-hint">Коротко, о чём ролик — попадёт в контекст диалога.</p>
          <div className="field">
            <span className="label mono">Topic</span>
            <input
              className="input"
              value={state.topic}
              onChange={(e) => dispatch({ type: "set", patch: { topic: e.target.value } })}
              placeholder="Тема / что обсуждаем?"
            />
          </div>
        </div>

        <ReadinessChecklist state={state} />

        <div className="group">
          <div className="group-title">Фон студии</div>
          <p className="group-hint">
            Спокойный — меньше сетки и декора (удобнее при записи экрана). Насыщенный — полный визуал интерфейса.
          </p>
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
          <p className="group-hint">Какой API держит диалог и JSON-патчи состояния.</p>
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
      </div>
    </>
  );
}
