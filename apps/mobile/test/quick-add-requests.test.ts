import { describe, expect, test } from "bun:test";
import { startOfLocalDay, zonedTimeToUtc } from "@tick-taka/shared/dates";
import type { AnyDraft } from "@tick-taka/shared/quick-add";
import {
  applyOverrides,
  draftRequests,
  undoRequest,
} from "../src/features/quick-add/quick-add-requests";

const TZ = "Asia/Dhaka";

const expense: AnyDraft = {
  kind: "expense",
  amountMinor: 2000,
  accountId: "cash",
  categoryId: "food",
  areaId: null,
  note: "cha",
  occurredAt: zonedTimeToUtc({ year: 2026, month: 10, day: 6, hour: 9 }, TZ),
  confidence: "high",
};

const task: AnyDraft = {
  kind: "task",
  title: "call bank",
  doAt: null,
  hasTime: false,
  reminderAt: null,
  deadlineAt: null,
  rrule: null,
  whenSlot: "day",
  status: "inbox",
  priority: "normal",
  areaId: null,
  confidence: "high",
};

describe("quick-add picks on top of the parsed draft", () => {
  test("picking Someday clears the day and the reminder", () => {
    const draft = applyOverrides(
      { ...task, doAt: Date.now(), reminderAt: Date.now(), status: "open" },
      { day: "someday" },
      TZ,
    );
    expect(draft).toMatchObject({ status: "someday", doAt: null, reminderAt: null });
  });

  test("picking Tomorrow plans it for the start of tomorrow", () => {
    const draft = applyOverrides(task, { day: "tomorrow" }, TZ);
    expect(draft.kind === "task" && draft.status).toBe("open");
    expect(draft.kind === "task" && draft.doAt).toBeGreaterThan(Date.now());
  });

  test("an account pick replaces the parsed one; an unset pick keeps it", () => {
    expect(applyOverrides(expense, { accountId: "bkash" }, TZ)).toMatchObject({
      accountId: "bkash",
      categoryId: "food",
    });
  });
});

describe("quick-add writes", () => {
  test("an expense is one POST with the client-made id", () => {
    const requests = draftRequests(expense, {}, "food", "tx-1");
    expect(requests).toHaveLength(1);
    expect(requests?.[0]).toMatchObject({
      method: "POST",
      path: "/transactions",
      body: { id: "tx-1", type: "expense", amountMinor: 2000 },
    });
  });

  test("a corrected category is remembered for the note", () => {
    const draft = applyOverrides(expense, { categoryId: "snacks" }, TZ);
    const requests = draftRequests(draft, { categoryId: "snacks" }, "food", "tx-1");
    expect(requests?.[1]).toMatchObject({
      path: "/category-rules",
      body: { matchText: "cha", categoryId: "snacks" },
    });
  });

  test("nothing to save without an amount", () => {
    expect(draftRequests({ ...expense, amountMinor: null }, {}, null, "tx-1")).toBeNull();
  });

  test("Undo deletes the record the save created, by its phone-made id", () => {
    const requests = draftRequests(expense, {}, "food", "tx-1") ?? [];
    expect(undoRequest(requests)).toEqual({
      method: "DELETE",
      path: "/transactions/tx-1",
      label: "Couldn't undo",
    });
    const timeEntry = draftRequests(
      {
        kind: "time_entry",
        minutes: 90,
        note: "",
        areaId: null,
        startedAt: 0,
        endedAt: 1,
        confidence: "high",
      },
      {},
      null,
      "te-1",
    );
    expect(undoRequest(timeEntry ?? [])?.path).toBe("/time-entries/te-1");
    expect(undoRequest([])).toBeNull();
  });

  test("a task dated today is sent as open, not inbox", () => {
    const doAt = startOfLocalDay("2026-10-06", TZ);
    const requests = draftRequests({ ...task, doAt }, {}, null, "t-1");
    expect(requests?.[0]?.body).toMatchObject({ id: "t-1", status: "open", doAt });
  });
});
