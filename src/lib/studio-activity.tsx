"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type StudioActivityValue = {
  chatBusy: boolean;
  setChatBusy: (v: boolean) => void;
  imagePipelineBusy: boolean;
  setImagePipelineBusy: (v: boolean) => void;
  zipBusy: boolean;
  setZipBusy: (v: boolean) => void;
};

const Ctx = createContext<StudioActivityValue | null>(null);

export function StudioActivityProvider({ children }: { children: React.ReactNode }) {
  const [chatBusy, setChatBusy] = useState(false);
  const [imagePipelineBusy, setImagePipelineBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const value = useMemo(
    () => ({
      chatBusy,
      setChatBusy,
      imagePipelineBusy,
      setImagePipelineBusy,
      zipBusy,
      setZipBusy
    }),
    [chatBusy, imagePipelineBusy, zipBusy]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioActivity() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudioActivity must be used within StudioActivityProvider");
  return v;
}
