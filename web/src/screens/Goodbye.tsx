import { useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/SettingsContext";
import { usePlatform } from "../platform/PlatformContext";
import { requestTvStandby, type StandbyOutcome } from "../services/standby";

/**
 * Full-screen farewell: the dashboard fades out (App adds .app--leaving), the message fades in
 * while a ring draws, the scene fades to black, then GrantOS asks the TV to go to standby.
 * Any key afterwards brings the dashboard back (if the TV is still on).
 */
export function Goodbye({ onDone, preview = false }: { onDone: () => void; preview?: boolean }) {
  const { settings } = useSettings();
  const platform = usePlatform();
  const [ending, setEnding] = useState(false);
  const [outcome, setOutcome] = useState<StandbyOutcome | null>(null);
  const ready = useRef(false);
  const duration = settings.goodbye.durationMs;

  useEffect(() => {
    let alive = true;
    const fade = setTimeout(() => alive && setEnding(true), duration);
    const standby = setTimeout(async () => {
      ready.current = true;
      if (preview) {
        setOutcome({ attempted: false, ok: true, simulated: true, message: "Preview finished. Press any button to return." });
        return;
      }
      const r = await requestTvStandby(platform, settings);
      if (!alive) return;
      setOutcome(r);
      // The TV is off: quietly restore the dashboard so it's there when the TV comes back on.
      if (r.ok) setTimeout(() => alive && onDone(), 30000);
    }, duration + 1200);
    return () => {
      alive = false;
      clearTimeout(fade);
      clearTimeout(standby);
    };
    // Runs once per Goodbye.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (ready.current) onDone();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  return (
    <div
      className={`goodbye${ending ? " goodbye--ending" : ""}`}
      style={{ ["--gb-duration" as string]: `${duration}ms` }}
      data-nav-root
      data-testid="goodbye"
    >
      <div className="goodbye__inner">
        <svg className="goodbye__ring" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="gb-gradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
          <circle className="track" cx="50" cy="50" r="46" />
          <circle className="arc" cx="50" cy="50" r="46" />
        </svg>
        <h1 className="goodbye__message">{settings.goodbye.message}</h1>
        {settings.goodbye.subtitle && <div className="goodbye__sub">{settings.goodbye.subtitle}</div>}
      </div>
      {outcome && (
        <div className="goodbye__status" data-testid="goodbye-status">
          {outcome.simulated && !preview && <span className="badge badge--sim" style={{ marginRight: "1rem" }}>Simulated</span>}
          {outcome.message}
          {!preview && " Press any button to return to GrantOS."}
        </div>
      )}
    </div>
  );
}
