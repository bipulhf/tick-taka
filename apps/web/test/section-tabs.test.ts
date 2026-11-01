import { describe, expect, test } from "bun:test";
import { activeTab, NAV, type NavSection, sectionOf } from "../src/components/shell/nav";

const section = (to: string) => NAV.find((s) => s.to === to) as NavSection;

describe("section page tabs", () => {
  test("the section's own page is its first tab, open only on itself", () => {
    expect(activeTab("/plan", section("/plan"))?.label).toBe("Inbox and upcoming");
    expect(activeTab("/app/money", section("/money"))?.label).toBe("Overview");
    expect(activeTab("/money/budgets", section("/money"))?.to).toBe("/money/budgets");
  });

  test("a routine opens Routines; an area or a project opens no tab", () => {
    expect(activeTab("/plan/routine/r1", section("/plan"))?.to).toBe("/plan/routines");
    expect(activeTab("/plan/area/a1", section("/plan"))).toBeUndefined();
    expect(activeTab("/plan/project/p1", section("/plan"))).toBeUndefined();
  });

  test("every tab path belongs to its own section", () => {
    for (const s of NAV) for (const link of s.children) expect(sectionOf(link.to).to).toBe(s.to);
  });
});
