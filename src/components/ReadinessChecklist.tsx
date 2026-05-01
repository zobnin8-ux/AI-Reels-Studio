"use client";

import { useMemo } from "react";
import type { StudioState } from "@/lib/state";

type ItemStatus = "empty" | "progress" | "done" | "skip";

function iconClass(s: ItemStatus): string {
  if (s === "done") return "check-icon done";
  if (s === "progress") return "check-icon progress";
  if (s === "skip") return "check-icon skip";
  return "check-icon empty";
}

export function ReadinessChecklist({ state }: { state: StudioState }) {
  const items = useMemo(() => {
    const hasSlides = state.slides.length > 0;
    const anyCosmetic =
      state.prompts.some((p) => p.prompt.trim().length > 0) && state.slides.length > 0;

    const imgBusy =
      state.images.length > 0 &&
      state.images.some((x) => x.status === "waiting" || x.status === "generating");
    const imgDone =
      state.images.length > 0 &&
      state.images.every((x) => x.status === "done" || x.status === "error") &&
      state.images.some((x) => x.status === "done");

    const musicTouched =
      state.music.queries.length > 0 ||
      state.music.recommendations.length > 0 ||
      state.music.avoid.length > 0;

    const scenario: ItemStatus = hasSlides ? "done" : state.messages.length > 0 ? "progress" : "empty";
    const refinements: ItemStatus = hasSlides
      ? anyCosmetic
        ? "done"
        : "skip"
      : state.prompts.some((p) => p.prompt.trim())
        ? "done"
        : "empty";
    const frames: ItemStatus =
      state.images.length === 0 ? "empty" : imgBusy ? "progress" : imgDone ? "done" : "progress";
    const caption: ItemStatus = state.caption.trim() ? "done" : "empty";
    const music: ItemStatus = musicTouched ? "done" : "skip";
    const exportReady =
      hasSlides ||
      state.prompts.some((p) => p.prompt.trim()) ||
      state.caption.trim().length > 0 ||
      musicTouched ||
      state.messages.length > 0 ||
      state.images.some((i) => i.status === "done");
    const zip: ItemStatus = exportReady ? "done" : "empty";

    return [
      { key: "scenario", label: "Сценарий", stateLabel: hasSlides ? "готово" : "ждём", status: scenario },
      {
        key: "refinements",
        label: "Уточнения кадров",
        stateLabel: anyCosmetic ? "есть" : "не нужны",
        status: refinements
      },
      { key: "frames", label: "Кадры", stateLabel: imgBusy ? "генерация" : imgDone ? "синхрон" : "—", status: frames },
      { key: "caption", label: "Caption", stateLabel: state.caption.trim() ? "есть" : "—", status: caption },
      { key: "music", label: "Музыка", stateLabel: musicTouched ? "заполнено" : "по запросу", status: music },
      { key: "zip", label: "Экспорт ZIP", stateLabel: exportReady ? "доступен" : "ждём данные", status: zip }
    ];
  }, [state]);

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="readiness">
      <div className="readiness-head">
        <div className="readiness-title">Готовность пайплайна</div>
        <div className="readiness-count">
          <b>{doneCount}</b> / {items.length}
        </div>
      </div>
      <div className="checklist">
        {items.map((it) => (
          <div
            key={it.key}
            className={[
              "check-item",
              it.status === "done" ? "done" : "",
              it.status === "progress" ? "progress" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className={iconClass(it.status)} aria-hidden />
            <div className="check-label">{it.label}</div>
            <div className="check-state">{it.stateLabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
