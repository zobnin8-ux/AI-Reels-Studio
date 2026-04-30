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
          На всю ширину окна: последняя колонка — 1fr, чтобы не было «чёрной дыры» справа.
          Диалог и вывод делят оставшееся место (~1 : 1.35), лента кадров фикс 228px.
        */}
        <div className="grid h-full min-h-0 w-full min-w-[1280px] flex-1 grid-cols-[minmax(260px,300px)_minmax(0,1fr)_228px_minmax(0,1.35fr)] gap-0 overflow-x-auto overflow-y-hidden rounded-2xl">
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
