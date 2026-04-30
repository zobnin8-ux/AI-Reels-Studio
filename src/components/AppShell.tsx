"use client";

import { ControlPanel } from "@/components/ControlPanel";
import { DialoguePanel } from "@/components/DialoguePanel";
import { ImageActivitySync } from "@/components/ImageActivitySync";
import { ImageStripPanel } from "@/components/ImageStripPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { StudioTopBar } from "@/components/StudioTopBar";
import { StudioActivityProvider, useStudioActivity } from "@/lib/studio-activity";
import { StudioProvider } from "@/lib/studio-store";

function AppGrid() {
  const { chatBusy, imagePipelineBusy } = useStudioActivity();

  return (
    <main className="layout">
      <aside className="panel anim-1 min-h-0">
        <PanelErrorBoundary label="Control Panel">
          <ControlPanel />
        </PanelErrorBoundary>
      </aside>

      <section
        className={[
          "panel stage anim-2 flex-col min-h-0",
          chatBusy ? "is-chat-busy" : ""
        ].join(" ")}
      >
        <PanelErrorBoundary label="Диалог">
          <DialoguePanel />
        </PanelErrorBoundary>
      </section>

      <section className={["panel frames anim-3 min-h-0", imagePipelineBusy ? "is-images-busy" : ""].join(" ")}>
        <PanelErrorBoundary label="Кадры">
          <ImageStripPanel />
        </PanelErrorBoundary>
      </section>

      <aside className="panel anim-4 min-h-0">
        <PanelErrorBoundary label="Вывод">
          <OutputPanel />
        </PanelErrorBoundary>
      </aside>
    </main>
  );
}

export function AppShell() {
  return (
    <div className="v2026-shell">
      <div className="bg-grid" aria-hidden />
      <div className="bg-glow" aria-hidden />
      <div className="bg-noise" aria-hidden />
      <div className="scan-line" aria-hidden />
      <StudioProvider>
        <StudioActivityProvider>
          <ImageActivitySync />
          <StudioTopBar />
          <AppGrid />
        </StudioActivityProvider>
      </StudioProvider>
    </div>
  );
}
