import { ControlPanel } from "@/components/ControlPanel";
import { DialoguePanel } from "@/components/DialoguePanel";
import { OutputPanel } from "@/components/OutputPanel";
import { StudioProvider } from "@/lib/studio-store";

export function AppShell() {
  return (
    <StudioProvider>
      <div className="h-full rounded-2xl border border-border bg-panel/60 shadow-soft backdrop-blur">
        <div className="grid h-full grid-cols-[360px_minmax(520px,1fr)_420px] gap-0 overflow-hidden rounded-2xl">
          <aside className="h-full border-r border-border bg-panel p-4">
            <ControlPanel />
          </aside>

          <section className="h-full bg-panel2 p-4">
            <DialoguePanel />
          </section>

          <aside className="h-full border-l border-border bg-panel p-4">
            <OutputPanel />
          </aside>
        </div>
      </div>
    </StudioProvider>
  );
}

