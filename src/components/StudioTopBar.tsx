"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudio } from "@/lib/studio-store";

const projectOptions: { id: string; label: string }[] = [
  { id: "poslenego", label: "После него" },
  { id: "zobnin", label: "Zobnin AI" },
  { id: "olgatrip", label: "OlgaTrip" },
  { id: "custom", label: "Custom" }
];

function formatSes(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}·${mm}`;
}

export function StudioTopBar() {
  const { state } = useStudio();
  const [showcase, setShowcase] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const projectLabel = useMemo(
    () => projectOptions.find((p) => p.id === state.project)?.label ?? state.project,
    [state.project]
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("showcase", showcase);
  }, [showcase]);

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

      <div className="mode-switch">
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.12em"
          }}
        >
          режим
        </span>
        <div className="mode-pill" role="group" aria-label="Режим интерфейса">
          <button
            type="button"
            className={!showcase ? "active" : ""}
            onClick={() => setShowcase(false)}
          >
            Daily
          </button>
          <button
            type="button"
            className={showcase ? "active" : ""}
            onClick={() => setShowcase(true)}
          >
            Showcase
          </button>
        </div>
      </div>

      <div className="top-meta">
        <div className="meta-chip">
          <span className="dot" />
          <span>В сети</span>
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
