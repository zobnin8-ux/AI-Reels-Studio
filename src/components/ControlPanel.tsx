"use client";

import { useMemo, useRef } from "react";
import { useStudio } from "@/lib/studio-store";
import type { ProjectId, StudioState } from "@/lib/state";

const projectOptions: { id: ProjectId; label: string }[] = [
  { id: "poslenego", label: "После него" },
  { id: "zobnin", label: "Zobnin AI" },
  { id: "olgatrip", label: "OlgaTrip" },
  { id: "custom", label: "Custom" }
];

const emptyMusic = () => ({ queries: [] as string[], recommendations: [] as string[], avoid: [] as string[] });

/** Селекторы по умолчанию при смене проекта (не трогаем zobnin/custom без нужды). */
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

  const showCustom = state.project === "custom";

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

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="studio-sheen flex items-center justify-between rounded-xl border border-border/60 bg-black/18 px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-muted">AI Reels Studio</div>
          <div className="text-xl font-semibold tracking-tight">Control Panel</div>
        </div>
        {state.mockMode ? (
          <span className="rounded-full border border-border bg-black/40 px-2 py-1 text-xs text-accent">
            MOCK
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted">Project</label>
        <select
          value={state.project}
          onChange={(e) => onProjectChange(e.target.value as ProjectId)}
          className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
        >
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {showCustom ? (
          <textarea
            value={state.customSystemPrompt}
            onChange={(e) => dispatch({ type: "set", patch: { customSystemPrompt: e.target.value } })}
            placeholder="Системный промпт для Custom — подставляется в каждый запрос вместо профиля."
            className="min-h-24 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Content Type</label>
          <select
            value={state.contentType}
            onChange={(e) =>
              dispatch({ type: "set", patch: { contentType: e.target.value as StudioState["contentType"] } })
            }
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="reels">Reels (9:16)</option>
            <option value="post">Post (1:1)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Slides Count</label>
          <select
            value={state.slideCount}
            onChange={(e) =>
              dispatch({
                type: "set",
                patch: { slideCount: Number(e.target.value) as StudioState["slideCount"] }
              })
            }
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          >
            {[5, 7, 9, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Tone / Mood</label>
          <select
            value={state.mood}
            onChange={(e) =>
              dispatch({ type: "set", patch: { mood: e.target.value as StudioState["mood"] } })
            }
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="aggressive">Aggressive</option>
            <option value="soft">Soft</option>
            <option value="provocative">Provocative</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Visual Style</label>
          <select
            value={state.visualStyle}
            onChange={(e) =>
              dispatch({
                type: "set",
                patch: { visualStyle: e.target.value as StudioState["visualStyle"] }
              })
            }
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
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

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted">CTA Mode</label>
        <select
          value={state.ctaMode}
          onChange={(e) =>
            dispatch({ type: "set", patch: { ctaMode: e.target.value as StudioState["ctaMode"] } })
          }
          className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="website">Website</option>
          <option value="direct">Direct trigger</option>
          <option value="none">None</option>
          <option value="custom">Custom</option>
        </select>

        {state.ctaMode === "website" ? (
          <input
            value={state.website}
            onChange={(e) => dispatch({ type: "set", patch: { website: e.target.value } })}
            placeholder="beznego.com / poslenego.com"
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        ) : null}
        {state.ctaMode === "direct" ? (
          <input
            value={state.triggerWord}
            onChange={(e) => dispatch({ type: "set", patch: { triggerWord: e.target.value } })}
            placeholder="Триггер-слово"
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        ) : null}
        {state.ctaMode === "custom" ? (
          <input
            value={state.customCta}
            onChange={(e) => dispatch({ type: "set", patch: { customCta: e.target.value } })}
            placeholder="Свой CTA"
            className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted">Output Mode</label>
        <select
          value={state.outputMode}
          onChange={(e) =>
            dispatch({ type: "set", patch: { outputMode: e.target.value as StudioState["outputMode"] } })
          }
          className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="textInImages">Text inside images</option>
          <option value="textSeparate">Text separate</option>
          <option value="both">Both</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted">Topic</label>
        <input
          value={state.topic}
          onChange={(e) => dispatch({ type: "set", patch: { topic: e.target.value } })}
          placeholder="Тема / что обсуждаем?"
          className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="mt-auto space-y-2 rounded-xl border border-border bg-black/25 p-3">
        <div className="text-xs font-medium text-muted">Provider</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "set", patch: { provider: "openai" } })}
            className={[
              "studio-btn-ghost flex-1 rounded-lg border px-3 py-2 text-sm",
              state.provider === "openai"
                ? "border-accent/40 bg-accent/10 text-text"
                : "border-border bg-black/20 text-muted hover:bg-black/30"
            ].join(" ")}
          >
            OpenAI
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "set", patch: { provider: "anthropic" } })}
            className={[
              "studio-btn-ghost flex-1 rounded-lg border px-3 py-2 text-sm",
              state.provider === "anthropic"
                ? "border-accent2/40 bg-accent2/10 text-text"
                : "border-border bg-black/20 text-muted hover:bg-black/30"
            ].join(" ")}
          >
            Anthropic
          </button>
        </div>
      </div>
    </div>
  );
}
