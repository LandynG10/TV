export type Greeting = "Good morning." | "Good afternoon." | "Good evening.";

/**
 * 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–04:59 evening.
 * Uses the device's local clock (Date#getHours is local time).
 */
export function greetingFor(date: Date): Greeting {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning.";
  if (h >= 12 && h < 17) return "Good afternoon.";
  return "Good evening.";
}

/** "Good evening." or, with a name, "Good evening, Grant." */
export function personalGreeting(date: Date, name: string): string {
  const base = greetingFor(date);
  const trimmed = name.trim();
  return trimmed ? `${base.slice(0, -1)}, ${trimmed}.` : base;
}

/** Milliseconds until the next greeting boundary (05:00, 12:00 or 17:00 local time). */
export function msUntilNextGreetingChange(date: Date): number {
  const boundaries = [5, 12, 17];
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  const h = date.getHours();
  const nextHour = boundaries.find((b) => b > h);
  if (nextHour === undefined) {
    next.setDate(next.getDate() + 1);
    next.setHours(5);
  } else {
    next.setHours(nextHour);
  }
  return next.getTime() - date.getTime();
}
