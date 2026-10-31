import { describe, expect, test } from "bun:test";
import { pageTitle } from "../src/lib/page-title";

describe("window titles", () => {
  test("name the page first, then where it sits", () => {
    expect(pageTitle("/")).toBe("Today · Tick & Taka");
    expect(pageTitle("/money")).toBe("Money · Tick & Taka");
    expect(pageTitle("/money/transactions")).toBe("Transactions · Money · Tick & Taka");
    expect(pageTitle("/plan")).toBe("Plan · Tick & Taka");
    expect(pageTitle("/plan/week")).toBe("Week · Plan · Tick & Taka");
    expect(pageTitle("/review/reports")).toBe("Reports · Review · Tick & Taka");
  });

  test("use a record's name or the chosen section when there is one", () => {
    expect(pageTitle("/plan/area/01J", { name: "Teaching" })).toBe("Teaching · Plan · Tick & Taka");
    expect(pageTitle("/plan/project/01J")).toBe("Project · Plan · Tick & Taka");
    expect(pageTitle("/settings", { part: "Your day" })).toBe("Settings › Your day · Tick & Taka");
    expect(pageTitle("/admin", { part: "Users" })).toBe("Admin › Users · Tick & Taka");
    expect(pageTitle("/login")).toBe("Sign in · Tick & Taka");
    expect(pageTitle("/focus")).toBe("Focus · Tick & Taka");
  });

  test("an unknown page still says the app's name", () => {
    expect(pageTitle("/nowhere")).toBe("Tick & Taka");
  });
});
