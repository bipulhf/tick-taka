import { describe, expect, test } from "bun:test";
import { CALENDAR_GRID } from "../src/components/ui/calendar-grid";

/** DESIGN.md: screen padding is 20 dp; the smallest phone we design for is 360 dp wide. */
const PHONE = 360;
const SCREEN_PADDING = 20;

describe("calendar grid", () => {
  test("each of the seven days is at least 48 dp wide on a 360 dp phone", () => {
    const bleed = -Number(CALENDAR_GRID.marginHorizontal ?? 0);
    const sides = Number(CALENDAR_GRID.paddingLeft ?? 0) + Number(CALENDAR_GRID.paddingRight ?? 0);
    const width = PHONE - 2 * SCREEN_PADDING + 2 * bleed - sides;
    expect(width / 7).toBeGreaterThanOrEqual(48);
  });

  test("the grid stays clear of the screen edge", () => {
    expect(-Number(CALENDAR_GRID.marginHorizontal ?? 0)).toBeLessThan(SCREEN_PADDING);
  });
});
