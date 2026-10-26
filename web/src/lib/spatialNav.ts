/**
 * Remote-control focus movement.
 *
 * The Fire TV WebView turns D-pad presses into ArrowUp/Down/Left/Right keydown events but does
 * not move focus by itself. Each arrow picks the nearest focusable element in that direction,
 * preferring ones in a straight line. Overlays add their own [data-nav-root], and only the last
 * root in the document is navigable, so focus can't escape a dialog.
 *
 * Elements can override a direction with data-nav-left / -right / -up / -down = "#element-id".
 */
export type Direction = "left" | "right" | "up" | "down";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const VECTORS: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** Index of the best candidate in `dir` from `from`, or -1. Pure, so it is unit-tested. */
export function pickNext(from: Box, candidates: Box[], dir: Direction): number {
  const [dx, dy] = VECTORS[dir];
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((c, i) => {
    // Edge-based "is it in that direction" test, so wide and narrow elements behave.
    const ahead =
      dir === "right" ? c.left >= from.left + from.width - 2
      : dir === "left" ? c.left + c.width <= from.left + 2
      : dir === "down" ? c.top >= from.top + from.height - 2
      : c.top + c.height <= from.top + 2;
    if (!ahead) return;
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    const along = (cx - fx) * dx + (cy - fy) * dy;
    // Distance sideways, measured to the nearest edge so an overlapping column/row costs nothing.
    const across =
      dx !== 0
        ? Math.max(0, c.top - (from.top + from.height), from.top - (c.top + c.height))
        : Math.max(0, c.left - (from.left + from.width), from.left - (c.left + c.width));
    const centerOffset = dx !== 0 ? Math.abs(cy - fy) : Math.abs(cx - fx);
    const score = along + across * 4 + centerOffset * 0.3;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export const FOCUSABLE = "[data-nav]:not([disabled])";

export function activeRoot(doc: Document = document): HTMLElement {
  const roots = doc.querySelectorAll<HTMLElement>("[data-nav-root]");
  return roots.length ? roots[roots.length - 1] : doc.body;
}

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export function focusFirst(root: HTMLElement = activeRoot()): boolean {
  const preferred = root.querySelector<HTMLElement>("[data-autofocus]:not([disabled])");
  const el = preferred ?? focusables(root)[0];
  if (!el) return false;
  el.focus({ preventScroll: false });
  return true;
}

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

export function moveFocus(dir: Direction, doc: Document = document): boolean {
  const root = activeRoot(doc);
  const current = doc.activeElement as HTMLElement | null;
  const items = focusables(root);
  if (!current || !items.includes(current)) return focusFirst(root);

  const override = current.getAttribute(`data-nav-${dir}`);
  if (override) {
    const target = root.querySelector<HTMLElement>(override);
    if (target && items.includes(target)) {
      target.focus();
      return true;
    }
  }
  const others = items.filter((el) => el !== current);
  const i = pickNext(toBox(current.getBoundingClientRect()), others.map((el) => toBox(el.getBoundingClientRect())), dir);
  if (i < 0) return false;
  others[i].focus();
  others[i].scrollIntoView?.({ block: "nearest", inline: "nearest" });
  return true;
}

/** In a text field, Left/Right move the caret until it reaches an edge. */
export function textFieldKeepsKey(el: Element | null, dir: Direction): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement && !["text", "search", "url", "password", "number", ""].includes(el.type)) return false;
  if (dir === "up" || dir === "down") return el instanceof HTMLTextAreaElement && el.value.includes("\n");
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start !== end) return true;
  return dir === "left" ? start > 0 : end < el.value.length;
}

export const isBackKey = (e: KeyboardEvent) =>
  e.key === "Escape" ||
  e.key === "GoBack" ||
  e.key === "BrowserBack" ||
  (e.key === "Backspace" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement));
