"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import { syncImagesWithImagePrompts } from "@/lib/image-prompt-sync";
import { createInitialState, type StudioState } from "@/lib/state";

type Action =
  | { type: "set"; patch: Partial<StudioState> }
  | { type: "replace"; state: StudioState; resetSessionUndo?: boolean }
  | { type: "resetAll" };

const STORAGE_KEY = "ai-reels-studio:v2026:session";
const STORAGE_VERSION = 2;

function stripHeavyFieldsForStorage(state: StudioState): StudioState {
  return {
    ...state,
    images: state.images.map((img) => ({ ...img, imageBase64: undefined }))
  };
}

function isProbablyStudioState(x: unknown): x is StudioState {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    (s.provider === "openai" || s.provider === "anthropic") &&
    typeof s.project === "string" &&
    typeof s.contentType === "string" &&
    typeof s.slideCount === "number" &&
    Array.isArray(s.messages) &&
    Array.isArray(s.slides) &&
    Array.isArray(s.angles) &&
    Array.isArray(s.imagePrompts) &&
    Array.isArray(s.images) &&
    typeof s.caption === "string" &&
    typeof s.music === "object" &&
    s.music !== null
  );
}

function loadInitialState(): StudioState {
  const base = createInitialState();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as { v?: number; state?: unknown };
    if (parsed?.v !== STORAGE_VERSION) return base;
    if (!isProbablyStudioState(parsed.state)) return base;
    const merged: StudioState = { ...base, ...(parsed.state as StudioState) };
    if (typeof merged.autoGenerateImages !== "boolean") merged.autoGenerateImages = false;
    if (!Array.isArray(merged.messages)) merged.messages = [];
    if (!Array.isArray(merged.slides)) merged.slides = [];
    if (!Array.isArray(merged.angles)) merged.angles = [];
    if (!Array.isArray(merged.imagePrompts)) merged.imagePrompts = [];
    if (!Array.isArray(merged.images)) merged.images = [];
    if (!merged.music || typeof merged.music !== "object") {
      merged.music = base.music;
    }
    const sc = merged.slideCount;
    if (sc !== 5 && sc !== 7 && sc !== 9) merged.slideCount = 7;
    return merged;
  } catch {
    return base;
  }
}

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "set": {
      const patch = action.patch;
      const next: StudioState = { ...state, ...patch };
      if (patch.imagePrompts !== undefined) {
        next.images = syncImagesWithImagePrompts(next.images, next.imagePrompts);
      }
      return next;
    }
    case "replace": {
      const next = action.state;
      next.images = syncImagesWithImagePrompts(next.images, next.imagePrompts);
      return next;
    }
    case "resetAll":
      return createInitialState();
    default:
      return state;
  }
}

type StudioStore = {
  state: StudioState;
  dispatch: React.Dispatch<Action>;
  sessionUndoResetEpoch: number;
};

const Ctx = createContext<StudioStore | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, _dispatch] = useReducer(reducer, undefined, loadInitialState);
  const [sessionUndoResetEpoch, setSessionUndoResetEpoch] = useState(0);

  const dispatch = useCallback((action: Action) => {
    if (
      (action.type === "replace" && action.resetSessionUndo) ||
      action.type === "resetAll"
    ) {
      setSessionUndoResetEpoch((n) => n + 1);
    }
    _dispatch(action);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, sessionUndoResetEpoch }),
    [state, dispatch, sessionUndoResetEpoch]
  );

  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        const payload = { v: STORAGE_VERSION, state: stripHeavyFieldsForStorage(state) };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore (quota / private mode)
      }
    }, 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio(): StudioStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio must be used within StudioProvider");
  return v;
}
