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
          Четыре колонки: контрол | диалог (ограничен по ширине) | узкая лента кадров (~6 см) | текстовый вывод.
          max-w + mx-auto: блок не разъезжается к краям широкого монитора.
        */}
        <div className="mx-auto grid h-full min-h-0 w-full max-w-[1540px] min-w-[1280px] flex-1 grid-cols-[300px_minmax(320px,460px)_228px_minmax(280px,380px)] gap-0 overflow-x-auto overflow-y-hidden rounded-2xl">
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
