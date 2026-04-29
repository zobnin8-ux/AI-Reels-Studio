"use client";

import type { GeneratedImage } from "@/lib/state";
import { useStudio } from "@/lib/studio-store";
import { regenerateOneImage } from "@/lib/actions";
import { useEffect, useState } from "react";

export function ImageSlideCard({
  index,
  image
}: {
  index: number;
  image: GeneratedImage;
}) {
  const { state, dispatch } = useStudio();
  const [localPrompt, setLocalPrompt] = useState(image.prompt);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalPrompt(image.prompt);
  }, [image.prompt]);

  async function onRegenerate() {
    setBusy(true);
    try {
      const nextImage = await regenerateOneImage(state, image.id, image.slideId, localPrompt);
      const next = state.images.map((x) => (x.id === image.id ? nextImage : x));
      dispatch({ type: "set", patch: { images: next } });
    } finally {
      setBusy(false);
    }
  }

  const status = image.status;
  const statusLabel =
    status === "waiting"
      ? "waiting"
      : status === "generating"
        ? "generating"
        : status === "done"
          ? "done"
          : "error";

  return (
    <div className="rounded-xl border border-border bg-panel/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">
          {String(index + 1).padStart(2, "0")}. Кадр
        </div>
        <span className="rounded-full border border-border bg-black/30 px-2 py-1 text-xs text-muted">
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[120px_1fr] gap-3">
        <div
          className={[
            "overflow-hidden rounded-lg border border-border bg-black/25",
            state.contentType === "reels" ? "aspect-[9/16]" : "aspect-square"
          ].join(" ")}
        >
          {image.imageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${image.mimeType ?? "image/png"};base64,${image.imageBase64}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">preview</div>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">Промпт</div>
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            className="min-h-20 w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent/30"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onRegenerate()}
              disabled={!localPrompt.trim() || busy}
              className="rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30 disabled:opacity-50"
            >
              {busy ? "…" : "Перегенерировать"}
            </button>
          </div>
          {image.error ? <div className="text-xs text-red-300">{image.error}</div> : null}
        </div>
      </div>
    </div>
  );
}
