import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <main className="box-border flex h-[100dvh] min-h-0 w-full flex-col px-2 py-2 sm:px-3 sm:py-3">
      <div className="min-h-0 flex-1">
        <AppShell />
      </div>
    </main>
  );
}

