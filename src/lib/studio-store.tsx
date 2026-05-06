"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState
} from "react";
import { alignImagesToSlides } from "@/lib/image-prompt-sync";
import { createInitialState, type StudioState } from "@/lib/state";

type Action =
  | { type: "set"; patch: Partial<StudioState> }
  | { type: "replace"; state: StudioState; resetSessionUndo?: boolean }
  | { type: "resetAll" };

const STORAGE_KEY = "ai-reels-studio:v2026:session";

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "set": {
      const patch = action.patch;
      const next: StudioState = { ...state, ...patch };
      next.images = alignImagesToSlides(next.slides, next.images, next.imagePrompts);
      return next;
    }
    case "replace": {
      const next = { ...action.state };
      next.images = alignImagesToSlides(next.slides, next.images, next.imagePrompts);
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
  const [state, _dispatch] = useReducer(reducer, undefined, createInitialState);
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

  // Каждое открытие приложения = новый, чистый сеанс.
  // Сессионный persist можно вернуть позже как явную настройку/фичу (например, "Restore last session").
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio(): StudioStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio must be used within StudioProvider");
  return v;
}
