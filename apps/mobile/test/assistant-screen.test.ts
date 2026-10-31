import { describe, expect, test } from "bun:test";
import {
  assistantHref,
  recordHref,
  screenFromParams,
  screenFromRoute,
} from "../src/features/assistant/assistant-screen";

const ID = "01JB2Z8Q4M7N3P5R6S8T9V0W1X";

describe("screenFromRoute", () => {
  test("tabs name the view only, without the group", () => {
    expect(screenFromRoute("/")).toEqual({ view: "/" });
    expect(screenFromRoute("/money")).toEqual({ view: "/money" });
    expect(screenFromRoute("/(tabs)/plan")).toEqual({ view: "/plan" });
    expect(screenFromRoute("/money/transactions")).toEqual({ view: "/money/transactions" });
  });

  test("record sheets name the record by the kind Tiki uses", () => {
    expect(screenFromRoute(`/task/${ID}`).record).toEqual({ kind: "task", id: ID });
    expect(screenFromRoute(`/transaction/${ID}`).record).toEqual({ kind: "transaction", id: ID });
    expect(screenFromRoute(`/money/recurring/${ID}`).record).toEqual({ kind: "recurring", id: ID });
    expect(screenFromRoute(`/shopping-item/${ID}`).record).toEqual({
      kind: "shopping_item",
      id: ID,
    });
    expect(screenFromRoute(`/routine/${ID}`).record).toEqual({ kind: "routine", id: ID });
    expect(screenFromRoute("/time-entry", { id: ID }).record).toEqual({
      kind: "time_entry",
      id: ID,
    });
  });

  test("new sheets, other routes and odd ids name no record", () => {
    expect(screenFromRoute("/task/new").record).toBeUndefined();
    expect(screenFromRoute("/time-entry").record).toBeUndefined();
    expect(screenFromRoute(`/area/${ID}`).record).toBeUndefined();
    expect(screenFromRoute(`/plan/area/${ID}`).record).toBeUndefined();
    expect(screenFromRoute("/money/recurring").record).toBeUndefined();
  });

  test("a long view is cut to what the server takes", () => {
    expect(screenFromRoute(`/${"a".repeat(200)}`).view).toHaveLength(120);
  });
});

describe("the chat's params", () => {
  test("carry the screen there and back", () => {
    const screen = { view: `/task/${ID}`, record: { kind: "task" as const, id: ID } };
    const href = assistantHref(screen);
    expect(href).toEqual({
      pathname: "/assistant",
      params: { view: `/task/${ID}`, kind: "task", id: ID },
    });
    expect(screenFromParams(typeof href === "object" ? (href.params as never) : {})).toEqual(
      screen,
    );
  });

  test("opened from nowhere in particular, the chat is the view", () => {
    expect(screenFromParams({})).toEqual({ view: "/assistant" });
    expect(screenFromParams({ start: "talk" })).toEqual({ view: "/assistant" });
  });

  test("a bad record keeps the view", () => {
    expect(screenFromParams({ view: "/money", kind: "pet", id: ID })).toEqual({ view: "/money" });
    expect(screenFromParams({ view: "/money", kind: "task", id: "nope" })).toEqual({
      view: "/money",
    });
  });
});

test("record cards open the record's own sheet", () => {
  expect(recordHref("task", ID)).toBe(`/task/${ID}`);
  expect(recordHref("recurring", ID)).toBe(`/money/recurring/${ID}`);
  expect(recordHref("shopping_item", ID)).toBe(`/shopping-item/${ID}`);
  expect(recordHref("time_entry", ID)).toBe(`/time-entry?id=${ID}`);
});
