import { useEffect, useState } from "react";

/**
 * The current time, re-rendered on each second (or minute) boundary.
 * Ticks are re-aligned every time, so the clock never drifts and the greeting
 * changes at 05:00 / 12:00 / 17:00 without a restart.
 */
export function useClock(everySecond: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      const ms = everySecond ? 1000 - d.getMilliseconds() : 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      timer = setTimeout(tick, ms + 5);
    };
    tick();
    // A TV can sleep for hours. Catch up as soon as the page is visible again.
    const onVisible = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [everySecond]);
  return now;
}
