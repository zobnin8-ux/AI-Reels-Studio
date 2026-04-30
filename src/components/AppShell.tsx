"use client";

import { ControlPanel } from "@/components/ControlPanel";
import { DialoguePanel } from "@/components/DialoguePanel";
import { ImageActivitySync } from "@/components/ImageActivitySync";
import { ImageStripPanel } from "@/components/ImageStripPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { StudioActivityProvider, useStudioActivity } from "@/lib/studio-activity";
import { StudioProvider } from "@/lib/studio-store";

function AppGrid() {
  const { chatBusy, imagePipelineBusy } = useStudioActivity();

  return (
    <div className="grid h-full min-h-0 w-full min-w-[1480px] flex-1 grid-cols-[minmax(260px,300px)_minmax(0,1fr)_456px_minmax(0,1.15fr)] gap-0 overflow-x-auto overflow-y-hidden rounded-2xl">
      <aside className="min-h-0 min-w-0 border-r border-border bg-panel p-4">
        <PanelErrorBoundary label="Control Panel">
          <ControlPanel />
        </PanelErrorBoundary>
      </aside>

      <section
        className={[
          "min-h-0 min-w-0 bg-panel2 p-4",
          chatBusy ? "studio-panel-chat-active rounded-xl" : ""
        ].join(" ")}
      >
        <PanelErrorBoundary label="Диалог">
          <DialoguePanel />
        </PanelErrorBoundary>
      </section>

      <div
        className={imagePipelineBusy ? "min-h-0 min-w-0 studio-panel-images-active rounded-xl" : "min-h-0 min-w-0"}
      >
        <PanelErrorBoundary label="Кадры">
          <ImageStripPanel />
        </PanelErrorBoundary>
      </div>

      <aside
        className={[
          "min-h-0 min-w-0 border-l border-border bg-panel p-4",
          imagePipelineBusy ? "studio-panel-images-active rounded-xl" : ""
        ].join(" ")}
      >
        <PanelErrorBoundary label="Вывод">
          <OutputPanel />
        </PanelErrorBoundary>
      </aside>
    </div>
  );
}

export function AppShell() {
  return (
    <StudioProvider>
      <StudioActivityProvider>
        <ImageActivitySync />
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/90 bg-panel/65 shadow-soft backdrop-blur">
          <AppGrid />
        </div>
      </StudioActivityProvider>
    </StudioProvider>
  );
}
