"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { useStudioActivity } from "@/lib/studio-activity";

const projectOptions: { id: string; label: string }[] = [
  { id: "poslenego", label: "После него" },
  { id: "zobnin", label: "Zobnin AI" },
  { id: "olgatrip", label: "OlgaTrip" }
];

function formatSes(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}·${mm}`;
}

export function StudioTopBar() {
  const { state } = useStudio();
  const { chatBusy, imagePipelineBusy, zipBusy } = useStudioActivity();
  const [now, setNow] = useState(() => new Date());

  const projectLabel = useMemo(
    () => projectOptions.find((p) => p.id === state.project)?.label ?? state.project,
    [state.project]
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const imgDone = useMemo(() => state.images.filter((x) => x.status === "done").length, [state.images]);
  const imgTotal = state.images.length;
  const genIx = useMemo(() => state.images.findIndex((x) => x.status === "generating"), [state.images]);
  const statusLabel = zipBusy
    ? "ZIP"
    : imagePipelineBusy
      ? "Кадры"
      : chatBusy
        ? "Чат"
        : "Готово";
  const statusTone = zipBusy
    ? "var(--warn)"
    : imagePipelineBusy
      ? "var(--accent)"
      : chatBusy
        ? "rgba(167, 139, 250, 0.95)"
        : "var(--ok)";
  const statusDetail =
    zipBusy
      ? "Сборка архива…"
      : imagePipelineBusy && genIx >= 0
        ? `Кадр ${genIx + 1}/${imgTotal || 0}`
        : imagePipelineBusy && imgTotal > 0
          ? `Очередь · ${imgDone}/${imgTotal}`
          : chatBusy
            ? "Запрос к модели…"
            : state.slides.length > 0
              ? `${state.slides.length} слайдов`
              : "Начни с темы и чата";

  return (
    <header className="topbar shrink-0">
      <div className="brand">
        <div className="reactor" aria-hidden>
          <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1">
            <g className="ring-1">
              <circle cx="18" cy="18" r="16" strokeDasharray="2 4" />
              <circle cx="18" cy="2" r="1.2" fill="currentColor" />
            </g>
            <g className="ring-2">
              <circle cx="18" cy="18" r="11" strokeDasharray="6 3" />
            </g>
            <g className="core">
              <circle cx="18" cy="18" r="5" strokeWidth="1.2" />
              <circle cx="18" cy="18" r="2" fill="currentColor" />
            </g>
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-mark">
            Reels <b>Studio</b>
          </span>
          <span className="brand-sub">v 2 0 2 6 · neural studio</span>
        </div>
      </div>

      <div className="top-meta">
        <div className="meta-chip" title={statusDetail}>
          <span className="dot" style={{ background: statusTone }} />
          <span>{statusLabel}</span>
        </div>
        <div className="meta-chip" title={statusDetail}>
          <span className="key">STP</span>
          <span className="val" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {statusDetail}
          </span>
        </div>
        <div className="meta-chip">
          <span className="key">SLD</span>
          <span className="val">{state.slides.length}</span>
        </div>
        <div className="meta-chip">
          <span className="key">IMG</span>
          <span className="val">
            {imgDone}/{imgTotal || 0}
          </span>
        </div>
        <div className="meta-chip">
          <span className="key">PRJ</span>
          <span className="val">{projectLabel}</span>
        </div>
        <div className="meta-chip">
          <span className="key">SES</span>
          <span className="val">{formatSes(now)}</span>
        </div>
      </div>
    </header>
  );
}
