import { formatDate, formatTime, meridiem } from "./time";

const d = new Date(2026, 9, 26, 19, 5, 9); // Monday

describe("formatTime", () => {
  it("12-hour", () => {
    expect(formatTime(d, "12h", false)).toBe("7:05");
    expect(formatTime(new Date(2026, 0, 1, 0, 0), "12h", false)).toBe("12:00");
    expect(formatTime(new Date(2026, 0, 1, 12, 30), "12h", false)).toBe("12:30");
  });
  it("24-hour with seconds", () => {
    expect(formatTime(d, "24h", true)).toBe("19:05:09");
  });
  it("meridiem", () => {
    expect(meridiem(d)).toBe("PM");
    expect(meridiem(new Date(2026, 0, 1, 0, 1))).toBe("AM");
  });
});

describe("formatDate", () => {
  it("long, short and off", () => {
    expect(formatDate(d, "long")).toBe("Monday, October 26");
    expect(formatDate(d, "short")).toBe("Mon, Oct 26");
    expect(formatDate(d, "off")).toBe("");
  });
});
