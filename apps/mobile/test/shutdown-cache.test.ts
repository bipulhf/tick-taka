import { describe, expect, test } from "bun:test";
import {
  withHabitTicked,
  withHabitUnticked,
  withTopPicked,
  withTopUnpicked,
} from "../src/features/review/shutdown-cache";

const task = (id: string) => ({ id, title: id, top3Date: null as string | null });
const data = {
  habitsUnchecked: [{ id: "water" }, { id: "walk" }],
  tomorrowTopThree: [task("a"), task("b")].map((t) => ({ ...t, top3Date: "2026-10-07" })),
  tomorrowCandidates: [task("c"), task("d")],
};

describe("shutdown ticks show at once", () => {
  test("a ticked habit leaves the unchecked list, and unticking brings it back once", () => {
    const ticked = withHabitTicked(data, "water");
    expect(ticked.habitsUnchecked.map((h) => h.id)).toEqual(["walk"]);
    const back = withHabitUnticked(ticked, { id: "water" });
    expect(back.habitsUnchecked.map((h) => h.id)).toEqual(["walk", "water"]);
    expect(withHabitUnticked(back, { id: "water" }).habitsUnchecked).toHaveLength(2);
  });

  test("picking moves a candidate into tomorrow's top three", () => {
    const picked = withTopPicked(data, "c", "2026-10-07");
    expect(picked.tomorrowTopThree.map((t) => [t.id, t.top3Date])).toContainEqual([
      "c",
      "2026-10-07",
    ]);
    expect(picked.tomorrowCandidates.map((t) => t.id)).toEqual(["d"]);
  });

  test("a fourth pick changes nothing", () => {
    const three = withTopPicked(data, "c", "2026-10-07");
    expect(withTopPicked(three, "d", "2026-10-07")).toBe(three);
  });

  test("unpicking returns the task to the top of the candidates", () => {
    const unpicked = withTopUnpicked(data, "a");
    expect(unpicked.tomorrowTopThree.map((t) => t.id)).toEqual(["b"]);
    expect(unpicked.tomorrowCandidates[0]).toEqual(task("a"));
  });
});
