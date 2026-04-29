import { ControlPanel } from "@/components/ControlPanel";
import { DialoguePanel } from "@/components/DialoguePanel";
import { OutputPanel } from "@/components/OutputPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { StudioProvider } from "@/lib/studio-store";

export function AppShell() {
  return (
    <StudioProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel/60 shadow-soft backdrop-blur">
        {/*
          min-w-0 + minmax: иначе длинный контент в центре раздувает грид, overflow-hidden срезает боковые колонки.
          overflow-x-auto: на узком окне можно прокрутить к боковым панелям.
        */}
        <div className="grid h-full min-h-0 w-full min-w-[1180px] flex-1 grid-cols-[360px_minmax(0,1fr)_420px] gap-0 overflow-x-auto overflow-y-hidden rounded-2xl">
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
