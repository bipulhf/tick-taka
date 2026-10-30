import { describe, expect, test } from "bun:test";
import { startOfLocalDay } from "@tick-taka/shared/dates";
import type { AnyDraft } from "@tick-taka/shared/quick-add";
import { habitTap, takeOneBack } from "../src/features/habits/habit-tap";
import { draftPanel } from "../src/features/quick-add/quick-add-presets";
import {
  applyOverrides,
  draftRequests,
  undoRequest,
} from "../src/features/quick-add/quick-add-requests";
import { EMPTY, formFromPreset, taskBody, whenOf, withWhen } from "../src/features/tasks/task-form";
import { movedBefore, movedMessage, undoMoves } from "../src/features/today/bulk-move";

const TZ = "Asia/Dhaka";
const TODAY = "2026-10-30";

const expense: AnyDraft = {
  kind: "expense",
  amountMinor: 2000,
  accountId: "cash",
  categoryId: "food",
  areaId: null,
  note: "cha",
  occurredAt: 1_793_300_000_000,
  confidence: "high",
};

describe("task form", () => {
  test("a preset fills a new task and a dated one is planned", () => {
    const form = formFromPreset(
      new URLSearchParams("title=Call+bank&doAt=1793444400000&hasTime=true&priority=high"),
      TZ,
    );
    expect(form.title).toBe("Call bank");
    expect(form.doAt).toBe(1_793_444_400_000);
    expect(form.hasTime).toBe(true);
    expect(form.priority).toBe("high");
    expect(form.status).toBe("open");
  });

  test("doDate means the start of that local day; junk is ignored", () => {
    const form = formFromPreset(new URLSearchParams("doDate=2026-11-02&priority=urgent"), TZ);
    expect(form.doAt).toBe(startOfLocalDay("2026-11-02", TZ));
    expect(form.priority).toBe("normal");
    expect(formFromPreset(new URLSearchParams(""), TZ)).toEqual(EMPTY);
  });

  test("When choices move the task and its status", () => {
    const evening = withWhen(EMPTY, "evening", TODAY, TZ);
    expect(evening.status).toBe("open");
    expect(whenOf(evening, TODAY, TZ)).toBe("evening");
    expect(whenOf(withWhen(EMPTY, "tomorrow", TODAY, TZ), TODAY, TZ)).toBe("tomorrow");
    const none = withWhen(evening, "none", TODAY, TZ);
    expect(none.doAt).toBeNull();
    expect(none.status).toBe("inbox");
    expect(whenOf(withWhen(EMPTY, "someday", TODAY, TZ), TODAY, TZ)).toBe("someday");
  });

  test("the reminder rings at the task's time only when it has one", () => {
    const timed = { ...EMPTY, title: " Call ", doAt: 5, hasTime: true, notes: "  " };
    expect(taskBody(timed, null)).toMatchObject({ title: "Call", notes: null, reminderAt: 5 });
    expect(taskBody({ ...timed, hasTime: false }, "FREQ=DAILY")).toMatchObject({
      reminderAt: null,
      rrule: "FREQ=DAILY",
    });
  });
});

describe("quick-add", () => {
  test("Shift+Enter opens the right panel with the transaction panel's preset keys", () => {
    expect(draftPanel(null)).toEqual({ panel: "task:new" });
    expect(draftPanel(expense)).toEqual({
      panel: "transaction:new",
      preset: {
        type: "expense",
        amountMinor: 2000,
        note: "cha",
        categoryId: "food",
        accountId: "cash",
        occurredAt: 1_793_300_000_000,
      },
    });
    const transfer = draftPanel({
      kind: "transfer",
      amountMinor: 500,
      feeMinor: 0,
      accountId: "a",
      toAccountId: "b",
      note: "",
      occurredAt: 1,
      confidence: "high",
    });
    expect(transfer.preset).toMatchObject({ type: "transfer", toAccountId: "b" });
    const time = draftPanel({
      kind: "time_entry",
      minutes: 120,
      note: "thesis",
      areaId: null,
      startedAt: 10,
      endedAt: 20,
      confidence: "high",
    });
    expect(time).toEqual({
      panel: "time-entry:new",
      preset: { note: "thesis", minutes: 120, startedAt: 10, areaId: null },
    });
  });

  test("a corrected category is saved and learnt; Undo deletes what was made", () => {
    const fixed = applyOverrides(expense, { categoryId: "snacks" }, TZ);
    const requests = draftRequests(fixed, { categoryId: "snacks" }, "food", "01ID");
    expect(requests?.map((r) => r.path)).toEqual(["/transactions", "/category-rules"]);
    expect(undoRequest(requests ?? [])).toEqual({
      method: "DELETE",
      path: "/transactions/01ID",
      label: "Couldn't undo",
    });
    expect(draftRequests({ ...expense, amountMinor: null }, {}, null, "x")).toBeNull();
  });
});

describe("bulk moves", () => {
  const before = [
    {
      id: "1",
      title: "Call bank",
      status: "open",
      doAt: 1,
      hasTime: false,
      reminderAt: null,
      top3Date: null,
    },
    {
      id: "2",
      title: "Read",
      status: "inbox",
      doAt: null,
      hasTime: false,
      reminderAt: null,
      top3Date: null,
    },
    {
      id: "3",
      title: "Walk",
      status: "open",
      doAt: 2,
      hasTime: true,
      reminderAt: 2,
      top3Date: null,
    },
  ];

  test("names what moved and puts it back without a client clock", () => {
    expect(movedBefore({ before })).toHaveLength(3);
    expect(movedBefore({ nope: true })).toEqual([]);
    expect(movedMessage(before, "today")).toBe("Moved “Call bank”, “Read” and 1 more to today");
    expect(movedMessage([], "today")).toBe("Nothing needed moving");
    const [undo] = undoMoves(before);
    expect(undo?.path).toBe("/tasks/1");
    expect(undo?.body).not.toHaveProperty("updatedAt");
  });
});

describe("habit taps", () => {
  test("count up to the target, then change nothing", () => {
    expect(habitTap(2, 8)).toEqual({ kind: "count", next: 3 });
    expect(habitTap(8, 8)).toEqual({ kind: "atTarget" });
    expect(takeOneBack(0)).toBe(0);
  });
});
