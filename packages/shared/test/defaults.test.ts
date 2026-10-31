import { describe, expect, test } from "bun:test";
import { NEUTRAL_DEFAULTS, OWNER_DEFAULTS } from "../src/defaults";
import type { QuickAddContext } from "../src/quick-add";
import { guessArea, guessCategory } from "../src/quick-add-guess";

/** A context built from one default set, as a freshly seeded database would have. */
function seeded(set: typeof OWNER_DEFAULTS): QuickAddContext {
  return {
    now: 0,
    timeZone: "Asia/Dhaka",
    accounts: [],
    defaultAccountId: null,
    categories: set.categories.map((c) => ({
      id: `cat_${c.name}`,
      name: c.name,
      kind: c.kind,
      parentId: null,
    })),
    areas: set.areas.map((a) => ({ id: `area_${a.name}`, name: a.name })),
    rules: [],
  };
}

describe("default sets", () => {
  test("the neutral set has no owner-specific names", () => {
    const names = [...NEUTRAL_DEFAULTS.areas, ...NEUTRAL_DEFAULTS.categories].map((x) => x.name);
    for (const name of ["Job 1", "Job 2", "Teaching", "Research", "Teaching income"])
      expect(names).not.toContain(name);
    expect(NEUTRAL_DEFAULTS.areas.map((a) => a.name)).toEqual([
      "Work",
      "Study",
      "Home",
      "Personal",
    ]);
  });

  test("keywords guess into whichever set was seeded", () => {
    const owner = seeded(OWNER_DEFAULTS);
    const neutral = seeded(NEUTRAL_DEFAULTS);
    expect(guessArea("grade the quiz", owner)).toBe("area_Teaching");
    expect(guessArea("grade the quiz", neutral)).toBe("area_Study");
    expect(guessArea("sprint planning", neutral)).toBe("area_Work");
    expect(guessCategory("honorarium", owner).categoryId).toBe("cat_Teaching income");
    expect(guessCategory("honorarium", neutral).categoryId).toBe("cat_Side income");
    expect(guessCategory("lunch", neutral).categoryId).toBe("cat_Food");
  });
});
