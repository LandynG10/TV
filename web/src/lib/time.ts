export type ClockFormat = "12h" | "24h";
export type DateStyle = "long" | "short" | "off";

export function formatTime(date: Date, format: ClockFormat, seconds: boolean): string {
  const h24 = date.getHours();
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  if (format === "24h") {
    return `${String(h24).padStart(2, "0")}:${mm}${seconds ? `:${ss}` : ""}`;
  }
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm}${seconds ? `:${ss}` : ""}`;
}

export const meridiem = (date: Date) => (date.getHours() < 12 ? "AM" : "PM");

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Locale-independent so the TV and the tests agree: "Monday, October 26" or "Mon, Oct 26". */
export function formatDate(date: Date, style: DateStyle): string {
  if (style === "off") return "";
  const day = DAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  if (style === "short") return `${day.slice(0, 3)}, ${month.slice(0, 3)} ${date.getDate()}`;
  return `${day}, ${month} ${date.getDate()}`;
}
