"use client";

import { createContext, useContext, useEffect, useState } from "react";

type DevModeContextValue = {
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  toggle: () => void;
};

const DevModeContext = createContext<DevModeContextValue | null>(null);

const STORAGE_KEY = "targeting:devMode";

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setDevMode(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, devMode ? "1" : "0");
    } catch { /* ignore */ }
  }, [devMode]);

  return (
    <DevModeContext.Provider
      value={{ devMode, setDevMode, toggle: () => setDevMode((v) => !v) }}
    >
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode usado fora do DevModeProvider");
  return ctx;
}
