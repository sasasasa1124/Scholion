"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { UserSettings } from "./types";
import { DEFAULT_USER_SETTINGS } from "./types";
import { t as translate, type TranslationKey } from "./i18n";

const STORAGE_KEY = "user-settings";

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  t: (key: TranslationKey) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserSettings>;
        const merged = { ...DEFAULT_USER_SETTINGS, ...parsed };
        // Empty prompt strings mean "not yet customized" — use the default
        if (!parsed.aiPrompt) merged.aiPrompt = DEFAULT_USER_SETTINGS.aiPrompt;
        if (!parsed.aiRefinePrompt) merged.aiRefinePrompt = DEFAULT_USER_SETTINGS.aiRefinePrompt;
        setSettings(merged);
      }
    } catch {
      // ignore
    }
  }, []);

  function updateSettings(patch: Partial<UserSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        t: (key: TranslationKey) => translate(settings.language, key),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
