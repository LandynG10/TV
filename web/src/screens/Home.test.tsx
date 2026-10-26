import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsProvider } from "../lib/SettingsContext";
import { sanitizeSettings } from "../lib/settings";
import { PlatformContext } from "../platform/PlatformContext";
import { fakePlatform } from "../test/fakePlatform";
import { Home } from "./Home";

const renderHome = (onAction = vi.fn(), settings = sanitizeSettings({})) =>
  render(
    <SettingsProvider initial={settings}>
      <PlatformContext.Provider value={fakePlatform().platform}>
        <Home onAction={onAction} focusId="viu" intro={false} />
      </PlatformContext.Provider>
    </SettingsProvider>,
  );

describe("Home", () => {
  afterEach(() => vi.useRealTimers());

  it("shows exactly four tiles in order, then Settings", () => {
    renderHome();
    const tiles = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") || b.textContent?.trim());
    expect(tiles.slice(0, 4)).toEqual(["VIU", "PS5", "YouTube", "AI Assistant"]);
    expect(tiles[4]).toMatch(/Settings/);
  });

  it("greets by the local clock and updates without a restart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 11, 59, 58));
    renderHome();
    expect(screen.getByTestId("greeting")).toHaveTextContent("Good morning.");
    act(() => vi.advanceTimersByTime(65_000));
    expect(screen.getByTestId("greeting")).toHaveTextContent("Good afternoon.");
  });

  it("reports which tile was chosen", () => {
    const onAction = vi.fn();
    renderHome(onAction);
    fireEvent.click(screen.getByLabelText("PS5"));
    fireEvent.click(screen.getByText("Goodbye"));
    expect(onAction.mock.calls).toEqual([["ps5"], ["goodbye"]]);
  });

  it("flags VIU as needing setup until a package is chosen", () => {
    renderHome();
    expect(screen.getByLabelText("VIU")).toHaveTextContent("Set up");
  });
});

import { act } from "@testing-library/react";
