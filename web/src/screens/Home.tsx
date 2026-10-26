import type { ReactNode } from "react";
import { GamepadIcon, GearIcon, PlayIcon, PowerIcon, SparkleIcon } from "../components/Icons";
import { TopBar } from "../components/TopBar";
import { personalGreeting } from "../lib/greeting";
import { useSettings } from "../lib/SettingsContext";
import { formatDate, formatTime, meridiem } from "../lib/time";
import { useClock } from "../lib/useClock";

export type TileId = "viu" | "ps5" | "youtube" | "ai";
export type HomeAction = TileId | "settings" | "goodbye";

interface TileDef {
  id: TileId;
  title: string;
  subtitle: string;
  icon: ReactNode;
  status?: string;
}

export function Home({
  onAction,
  focusId,
  intro,
}: {
  onAction: (a: HomeAction) => void;
  /** The element to focus when the screen appears (the last one used). */
  focusId: HomeAction;
  intro: boolean;
}) {
  const { settings } = useSettings();
  const now = useClock(settings.clock.seconds);

  const tiles: TileDef[] = [
    {
      id: "viu",
      title: "VIU",
      subtitle: "Dramas, variety & more",
      icon: <span className="tile__wordmark">viu</span>,
      status: settings.apps.viu.packageName ? undefined : "Set up",
    },
    { id: "ps5", title: "PS5", subtitle: `PlayStation 5 · HDMI ${settings.ps5.hdmiInput}`, icon: <GamepadIcon /> },
    {
      id: "youtube",
      title: "YouTube",
      subtitle: "Videos & live",
      icon: <PlayIcon />,
      status: settings.apps.youtube.packageName ? undefined : "Set up",
    },
    {
      id: "ai",
      title: "AI Assistant",
      subtitle: settings.ai.provider === "demo" ? "Ask anything · demo mode" : "Ask anything",
      icon: <SparkleIcon />,
    },
  ];

  const time = formatTime(now, settings.clock.format, settings.clock.seconds);
  const date = formatDate(now, settings.clock.dateStyle);

  return (
    <main className={`screen${intro ? " intro" : ""}`} data-nav-root data-testid="home">
      <TopBar />
      <section className="hero" aria-live="polite">
        {date && <div className="hero__date" data-testid="date">{date}</div>}
        {settings.greeting.enabled && (
          <h1 className="hero__greeting" data-testid="greeting">
            {personalGreeting(now, settings.greeting.name)}
          </h1>
        )}
        <div className="hero__time" data-testid="time">
          {time}
          {settings.clock.format === "12h" && <span className="hero__ampm">{meridiem(now)}</span>}
        </div>
      </section>

      <nav className="tiles" aria-label="Apps">
        {tiles.map((t) => (
          <button
            key={t.id}
            id={`tile-${t.id}`}
            className={`tile tile--${t.id}`}
            data-nav
            data-autofocus={focusId === t.id ? "" : undefined}
            data-nav-down="#action-settings"
            onClick={() => onAction(t.id)}
            aria-label={t.title}
          >
            <div className="tile__icon">{t.icon}</div>
            {t.status && <span className="badge badge--warn tile__status">{t.status}</span>}
            <div className="tile__text">
              <div className="tile__title">{t.title}</div>
              <div className="tile__subtitle">{t.subtitle}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className="home-actions">
        <button
          id="action-settings"
          className="pill"
          data-nav
          data-nav-up="#tile-viu"
          data-autofocus={focusId === "settings" ? "" : undefined}
          onClick={() => onAction("settings")}
        >
          <GearIcon /> Settings
        </button>
        <button
          id="action-goodbye"
          className="pill pill--quiet"
          data-nav
          data-nav-up="#tile-ps5"
          data-autofocus={focusId === "goodbye" ? "" : undefined}
          onClick={() => onAction("goodbye")}
        >
          <PowerIcon /> Goodbye
        </button>
        <div className="home-hint" aria-hidden="true">
          <span>
            <span className="kbd">◀ ▶</span>Move
          </span>
          <span>
            <span className="kbd">OK</span>Open
          </span>
        </div>
      </div>
    </main>
  );
}
