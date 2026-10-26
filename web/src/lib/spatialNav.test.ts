import { pickNext, type Box } from "./spatialNav";

const box = (left: number, top: number, width = 100, height = 100): Box => ({ left, top, width, height });

// Dashboard layout: 4 tiles in a row, Settings + Goodbye pills underneath on the left.
const tiles = [box(0, 0), box(140, 0), box(280, 0), box(420, 0)];
const settings = box(0, 140, 60, 30);
const goodbye = box(80, 140, 60, 30);
const all = [...tiles, settings, goodbye];

describe("pickNext", () => {
  it("moves along the tile row", () => {
    expect(pickNext(tiles[0], all, "right")).toBe(1);
    expect(pickNext(tiles[2], all, "left")).toBe(1);
  });
  it("stops at the edges", () => {
    expect(pickNext(tiles[3], all, "right")).toBe(-1);
    expect(pickNext(tiles[0], all, "up")).toBe(-1);
  });
  it("goes down to the nearest item below", () => {
    expect(pickNext(tiles[0], all, "down")).toBe(4);
  });
  it("goes up from a pill to the tile above it", () => {
    expect(pickNext(goodbye, all, "up")).toBe(0);
    expect(pickNext(settings, all, "up")).toBe(0);
  });
  it("prefers a straight line over a closer diagonal", () => {
    const from = box(0, 0);
    const candidates = [box(150, 300), box(400, 0)];
    expect(pickNext(from, candidates, "right")).toBe(1);
  });
});
