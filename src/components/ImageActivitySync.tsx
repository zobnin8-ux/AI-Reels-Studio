"use client";

import { useEffect } from "react";
import { useStudio } from "@/lib/studio-store";
import { useStudioActivity } from "@/lib/studio-activity";

/** Единый источник: пайплайн картинок активен, пока есть waiting/generating. */
export function ImageActivitySync() {
  const { state } = useStudio();
  const { setImagePipelineBusy } = useStudioActivity();

  const busy =
    state.images.length > 0 &&
    state.images.some((x) => x.status === "waiting" || x.status === "generating");

  useEffect(() => {
    setImagePipelineBusy(busy);
    return () => setImagePipelineBusy(false);
  }, [busy, setImagePipelineBusy]);

  return null;
}
