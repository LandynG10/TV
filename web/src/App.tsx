import { useCallback, useEffect, useState } from "react";
import { Backdrop } from "./components/Backdrop";
import { useToast } from "./components/Toast";
import { useSettings } from "./lib/SettingsContext";
import { focusFirst } from "./lib/spatialNav";
import { useRemote } from "./lib/useRemote";
import { useStageScale } from "./lib/useStageScale";
import { detectPlatform } from "./platform";
import { PlatformContext } from "./platform/PlatformContext";
import type { Platform } from "./platform/types";
import { Assistant } from "./screens/Assistant";
import { Goodbye } from "./screens/Goodbye";
import { Home, type HomeAction } from "./screens/Home";
import { Ps5Overlay } from "./screens/Ps5Overlay";
import { SettingsScreen, type SectionId } from "./screens/Settings";
import { launchManagedApp } from "./services/apps";

type Screen = "home" | "assistant" | "settings";
type Overlay = null | "ps5" | "goodbye" | "goodbye-preview";

export function App({ platformOverride }: { platformOverride?: Platform }) {
  const { settings } = useSettings();
  const toast = useToast();
  const [platform, setPlatform] = useState<Platform | null>(platformOverride ?? null);
  const [screen, setScreen] = useState<Screen>(settings.startup.startScreen === "assistant" ? "assistant" : "home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [lastAction, setLastAction] = useState<HomeAction>("viu");
  const [settingsSection, setSettingsSection] = useState<SectionId>("appearance");
  const [intro, setIntro] = useState(settings.startup.animate);

  useStageScale(settings.display.scale);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (platformOverride) return;
    let alive = true;
    detectPlatform(settings.hardwareMode).then((p) => alive && setPlatform(p));
    return () => {
      alive = false;
    };
  }, [settings.hardwareMode, platformOverride]);

  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 1600);
    return () => clearTimeout(t);
  }, [intro]);

  // Focus something whenever the screen or overlay changes, so the remote always has a target.
  useEffect(() => {
    if (!platform) return;
    const id = requestAnimationFrame(() => focusFirst());
    return () => cancelAnimationFrame(id);
  }, [screen, overlay, platform]);

  const goHome = useCallback(() => {
    setOverlay(null);
    setScreen("home");
  }, []);

  useRemote({
    onBack: () => {
      if (overlay === "goodbye" || overlay === "goodbye-preview") return; // Goodbye handles its own keys.
      if (overlay) return setOverlay(null);
      if (screen !== "home") goHome();
    },
    onHome: goHome,
  });

  const onAction = async (a: HomeAction) => {
    if (!platform) return;
    setLastAction(a);
    switch (a) {
      case "viu":
      case "youtube": {
        const r = await launchManagedApp(platform, a, settings.apps[a]);
        if (!r.ok || r.simulated) toast(r.message, { kind: r.ok ? "info" : "error", simulated: r.simulated });
        if (!r.ok && !settings.apps[a].packageName) {
          setSettingsSection("apps");
          setScreen("settings");
        }
        return;
      }
      case "ps5":
        return setOverlay("ps5");
      case "ai":
        return setScreen("assistant");
      case "settings":
        setSettingsSection("appearance");
        return setScreen("settings");
      case "goodbye":
        return setOverlay("goodbye");
    }
  };

  if (!platform) return <Backdrop background={settings.background} />;

  const leaving = overlay === "goodbye" || overlay === "goodbye-preview";
  return (
    <PlatformContext.Provider value={platform}>
      <Backdrop background={settings.background} />
      <div className={`app${leaving ? " app--leaving" : ""}`} aria-hidden={leaving}>
        {screen === "home" && <Home onAction={onAction} focusId={lastAction} intro={intro} />}
        {screen === "assistant" && <Assistant />}
        {screen === "settings" && (
          <SettingsScreen
            initialSection={settingsSection}
            onPreviewGoodbye={() => {
              setSettingsSection("goodbye");
              setOverlay("goodbye-preview");
            }}
          />
        )}
      </div>
      {overlay === "ps5" && (
        <Ps5Overlay
          onClose={() => setOverlay(null)}
          onOpenSettings={() => {
            setOverlay(null);
            setSettingsSection("ps5");
            setScreen("settings");
          }}
        />
      )}
      {leaving && <Goodbye preview={overlay === "goodbye-preview"} onDone={() => setOverlay(null)} />}
    </PlatformContext.Provider>
  );
}
