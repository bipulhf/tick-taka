import { describe, expect, test } from "bun:test";
import { placeCard, TOUR_STEPS } from "../src/features/tour/tour-steps";

const view = { width: 1440, height: 900 };
const card = { width: 360, height: 240 };

describe("app tour", () => {
  test("starts with a welcome and ends with a send-off, neither pointing at anything", () => {
    expect(TOUR_STEPS[0]?.target).toBeNull();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1]?.target).toBeNull();
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });

  test("copy stays short and has no em dashes", () => {
    for (const step of TOUR_STEPS) {
      expect(step.body.length).toBeLessThan(200);
      expect(`${step.title}${step.body}`).not.toContain("—");
    }
  });

  test("the card sits under its target when it fits, else above, else beside", () => {
    const top = placeCard({ top: 20, left: 500, width: 400, height: 40 }, card, view);
    expect(top.top).toBe(74);
    const bottom = placeCard({ top: 780, left: 500, width: 400, height: 60 }, card, view);
    expect(bottom.top).toBe(780 - 14 - 240);
    const tall = placeCard({ top: 20, left: 10, width: 200, height: 860 }, card, view);
    expect(tall.left).toBe(10 + 200 + 14);
  });

  test("the card always stays inside the window, and centres with no target", () => {
    const edge = placeCard({ top: 100, left: 1400, width: 40, height: 40 }, card, view);
    expect(edge.left + card.width).toBeLessThanOrEqual(view.width - 12);
    expect(placeCard(null, card, view)).toEqual({ top: 330, left: 540 });
    const phone = placeCard(null, { width: 366, height: 300 }, { width: 390, height: 844 });
    expect(phone.left).toBe(12);
  });
});
