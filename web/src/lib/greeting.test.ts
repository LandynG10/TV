import { greetingFor, msUntilNextGreetingChange, personalGreeting } from "./greeting";

const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m, 0);

describe("greetingFor", () => {
  it.each([
    [0, 0, "Good evening."],
    [4, 59, "Good evening."],
    [5, 0, "Good morning."],
    [11, 59, "Good morning."],
    [12, 0, "Good afternoon."],
    [16, 59, "Good afternoon."],
    [17, 0, "Good evening."],
    [23, 59, "Good evening."],
  ])("%i:%i → %s", (h, m, expected) => {
    expect(greetingFor(at(h, m))).toBe(expected);
  });
});

describe("personalGreeting", () => {
  it("adds a name before the full stop", () => {
    expect(personalGreeting(at(9), "Grant")).toBe("Good morning, Grant.");
  });
  it("ignores an empty or blank name", () => {
    expect(personalGreeting(at(13), "  ")).toBe("Good afternoon.");
  });
});

describe("msUntilNextGreetingChange", () => {
  it("counts to the next boundary the same day", () => {
    expect(msUntilNextGreetingChange(at(11, 30))).toBe(30 * 60_000);
    expect(msUntilNextGreetingChange(at(16, 0))).toBe(60 * 60_000);
  });
  it("wraps to 05:00 the next day after 17:00", () => {
    expect(msUntilNextGreetingChange(at(23, 0))).toBe(6 * 60 * 60_000);
  });
});
