"use client";

import React, { createContext, useContext, useMemo, useReducer } from "react";
import { createInitialState, type StudioState } from "@/lib/state";

type Action =
  | { type: "set"; patch: Partial<StudioState> }
  | { type: "resetAll" };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
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

