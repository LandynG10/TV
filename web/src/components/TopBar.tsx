import type { ReactNode } from "react";
import { usePlatform } from "../platform/PlatformContext";
import { useSettings } from "../lib/SettingsContext";
import { formatTime, meridiem } from "../lib/time";
import { useClock } from "../lib/useClock";
import { LogoMark } from "./Icons";

export function PlatformBadge() {
  const platform = usePlatform();
  if (platform.kind === "android") return null;
  return (
    <span className={`badge ${platform.kind === "simulated" ? "badge--sim" : "badge--warn"}`} data-testid="platform-badge">
      <span className="badge__dot" />
      {platform.kind === "simulated" ? "Simulated hardware" : "Desktop preview"}
    </span>
  );
}

/** GrantOS wordmark on the left; mode badge (and a small clock off the home screen) on the right. */
export function TopBar({ title, right, showClock = false }: { title?: string; right?: ReactNode; showClock?: boolean }) {
  const { settings } = useSettings();
  const now = useClock(false);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark">
          <LogoMark />
        </span>
        <span>
          Grant<span className="brand__os">OS</span>
        </span>
        {title && <span className="brand__os" style={{ marginLeft: "0.75rem", fontWeight: 500 }}>/ {title}</span>}
      </div>
      <div className="topbar__right">
        {right}
        <PlatformBadge />
        {showClock && (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatTime(now, settings.clock.format, false)}
            {settings.clock.format === "12h" ? ` ${meridiem(now)}` : ""}
          </span>
        )}
      </div>
    </header>
  );
}
