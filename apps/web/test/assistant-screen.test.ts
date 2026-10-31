import { describe, expect, test } from "bun:test";
import {
  pageRecord,
  panelRecord,
  recordTarget,
  screenFor,
  viewOf,
} from "../src/features/assistant/screen";

const ID = "01JBCDEFGHJKMNPQRSTVWXYZ01";

describe("viewOf", () => {
  test("drops the /app base and a trailing slash", () => {
    expect(viewOf("/app/money/transactions/")).toBe("/money/transactions");
    expect(viewOf("/app")).toBe("/");
    expect(viewOf("/app/")).toBe("/");
    expect(viewOf("/plan/week")).toBe("/plan/week");
    expect(viewOf("/apple")).toBe("/apple");
  });

  test("keeps at most 120 characters", () => {
    expect(viewOf(`/${"a".repeat(200)}`)).toHaveLength(120);
  });
});

describe("panelRecord", () => {
  test("maps panel kinds to the assistant's record kinds", () => {
    expect(panelRecord({ kind: "task", id: ID })).toEqual({ kind: "task", id: ID });
    expect(panelRecord({ kind: "time-entry", id: ID })).toEqual({ kind: "time_entry", id: ID });
    expect(panelRecord({ kind: "recurring", id: ID })).toEqual({ kind: "recurring", id: ID });
  });

  test("ignores new records and panels that aren't records", () => {
    expect(panelRecord({ kind: "task", id: "new" })).toBeNull();
    expect(panelRecord({ kind: "top-three", id: "2026-10-31" })).toBeNull();
    expect(panelRecord({ kind: "budget", id: ID })).toBeNull();
    expect(panelRecord(null)).toBeNull();
  });
});

test("pageRecord reads a project's or a routine's own page", () => {
  expect(pageRecord(`/plan/project/${ID}`)).toEqual({ kind: "project", id: ID });
  expect(pageRecord(`/plan/routine/${ID}`)).toEqual({ kind: "routine", id: ID });
  expect(pageRecord("/plan/routines")).toBeNull();
  expect(pageRecord(`/plan/area/${ID}`)).toBeNull();
});

describe("screenFor", () => {
  test("the record asked about wins over the panel, which wins over the page", () => {
    const about = { kind: "transaction" as const, id: "01JBCDEFGHJKMNPQRSTVWXYZ02" };
    const panel = { kind: "task", id: ID };
    expect(screenFor(`/app/plan/project/${ID}`, panel, about)).toEqual({
      view: `/plan/project/${ID}`,
      record: about,
    });
    expect(screenFor("/app/plan/week", panel)).toEqual({
      view: "/plan/week",
      record: { kind: "task", id: ID },
    });
    expect(screenFor(`/app/plan/project/${ID}`, null)).toEqual({
      view: `/plan/project/${ID}`,
      record: { kind: "project", id: ID },
    });
  });

  test("with nothing open it is just the view", () => {
    expect(screenFor("/app/", null)).toEqual({ view: "/" });
  });
});

test("recordTarget opens panels by their web kind, and routines on their page", () => {
  expect(recordTarget("time_entry", ID)).toEqual({ panel: `time-entry:${ID}` });
  expect(recordTarget("recurring", ID)).toEqual({ panel: `recurring:${ID}` });
  expect(recordTarget("routine", ID)).toEqual({ routineId: ID });
});
