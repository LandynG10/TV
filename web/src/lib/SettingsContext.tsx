import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings, type Settings } from "./settings";

interface SettingsApi {
  settings: Settings;
  /** Shallow-merges `patch` into one section (or sets a top-level value) and saves immediately. */
  update: <K extends keyof Settings>(key: K, patch: Settings[K] extends object ? Partial<Settings[K]> : Settings[K]) => void;
  reset: () => void;
}

const Ctx = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Settings }) {
  const [settings, setSettings] = useState<Settings>(() => initial ?? loadSettings());

  const update = useCallback<SettingsApi["update"]>((key, patch) => {
    setSettings((prev) => {
      const current = prev[key];
      const value =
        current && typeof current === "object" && patch && typeof patch === "object"
          ? { ...(current as object), ...(patch as object) }
          : patch;
      const next = sanitizeSettings({ ...prev, [key]: value });
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const api = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useSettings outside SettingsProvider");
  return api;
}
