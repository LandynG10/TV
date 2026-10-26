import { useEffect } from "react";

/** Design canvas: 1920×1080 with 1rem = 16px. */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export function stageFontSize(width: number, height: number, userScale: number): number {
  const fit = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  return Math.max(6, 16 * fit * userScale);
}

/**
 * Scales the whole interface with the screen by setting the root font-size (every size is in rem).
 * A Fire TV WebView may report 960×540 or 1920×1080 CSS pixels; both get the same layout.
 * `userScale` (Settings → Appearance → Interface size) compensates for TV overscan.
 */
export function useStageScale(userScale: number) {
  useEffect(() => {
    const apply = () => {
      document.documentElement.style.fontSize = `${stageFontSize(window.innerWidth, window.innerHeight, userScale)}px`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [userScale]);
}
