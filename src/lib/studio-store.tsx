"use client";

import React, { createContext, useContext, useMemo, useReducer } from "react";
import { syncImagesWithSlidePrompts } from "@/lib/prompt-sync";
import { createInitialState, type StudioState } from "@/lib/state";

type Action =
  | { type: "set"; patch: Partial<StudioState> }
  | { type: "resetAll" };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "set": {
      const patch = action.patch;
      const next: StudioState = { ...state, ...patch };
      if (patch.prompts !== undefined && patch.images === undefined) {
        next.images = syncImagesWithSlidePrompts(next.images, next.prompts);
      }
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
};

const Ctx = createContext<StudioStore | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio must be used within StudioProvider");
  return v;
}

