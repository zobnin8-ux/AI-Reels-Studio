import { ControlPanel } from "@/components/ControlPanel";
import { DialoguePanel } from "@/components/DialoguePanel";
import { ImageStripPanel } from "@/components/ImageStripPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { StudioProvider } from "@/lib/studio-store";

export function AppShell() {
  return (
    <StudioProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/90 bg-panel/65 shadow-soft backdrop-blur">
        {/*
          Лента кадров 456px (~вдвое от 228px). Справа «Вывод» уже по flex — место уходит с полей правее.
          Диалог 1fr : вывод 1.15fr (правый блок чуть уже относительно чата).
        */}
        <div className="grid h-full min-h-0 w-full min-w-[1480px] flex-1 grid-cols-[minmax(260px,300px)_minmax(0,1fr)_456px_minmax(0,1.15fr)] gap-0 overflow-x-auto overflow-y-hidden rounded-2xl">
          <aside className="min-h-0 min-w-0 border-r border-border bg-panel p-4">
            <PanelErrorBoundary label="Control Panel">
              <ControlPanel />
            </PanelErrorBoundary>
          </aside>

          <section className="min-h-0 min-w-0 bg-panel2 p-4">
            <PanelErrorBoundary label="Диалог">
              <DialoguePanel />
            </PanelErrorBoundary>
          </section>

          <PanelErrorBoundary label="Кадры">
            <ImageStripPanel />
          </PanelErrorBoundary>

          <aside className="min-h-0 min-w-0 border-l border-border bg-panel p-4">
            <PanelErrorBoundary label="Вывод">
              <OutputPanel />
            </PanelErrorBoundary>
          </aside>
        </div>
      </div>
    </StudioProvider>
  );
}
