import { describe, expect, test } from "bun:test";
import type { WidgetBill, WidgetUndo } from "../src/features/widget/widget-cache";
import {
  afterUndo,
  canUndo,
  laterDoAt,
  quickLogLink,
  restoreOf,
  UNDO_WINDOW_MS,
  undoText,
  withBillPaid,
  withHabitLogged,
  withQuickLog,
  withTaskDone,
  withTaskLater,
} from "../src/features/widget/widget-optimistic";
import { sampleCache, task } from "./helpers/widget-cache";

const cha = { label: "Cha", note: "cha", amountMinor: 2_000, categoryId: null };
const bill = (id: string, overrides: Partial<WidgetBill> = {}): WidgetBill => ({
  id,
  name: id,
  income: false,
  amountMinor: 100_000,
  currency: "BDT",
  accountId: null,
  dueDate: "2026-11-03",
  dueAt: 0,
  overdue: false,
  thisMonth: true,
  ...overrides,
});

describe("widget taps change the cache at once", () => {
  test("a tick shows the task done on every list it is on", () => {
    const cache = sampleCache({ tasks: [task("a"), task("b")], earlier: [task("old")] });
    const ticked = withTaskDone(withTaskDone(cache, "a"), "old");
    expect(ticked.tasks.map((t) => t.done)).toEqual([true, false]);
    expect(ticked.earlier[0]).toMatchObject({ done: true, status: "done" });
  });

  test("Later takes the task off today and counts it for tomorrow", () => {
    const cache = sampleCache({ tasks: [task("a"), task("b")], tomorrowCount: 2 });
    const later = withTaskLater(cache, "a");
    expect(later.tasks.map((t) => t.id)).toEqual(["b"]);
    expect(later.tomorrowCount).toBe(3);
    expect(withTaskLater(cache, "missing")).toBe(cache);
    expect(laterDoAt(1_000, 5)).toBe(1_000 + 86_400_000);
    expect(laterDoAt(null, 5)).toBe(5 + 86_400_000);
  });

  test("a habit ring counts one more, and never past its target", () => {
    const habit = { id: "h", name: "Water", emoji: "💧", count: 5, target: 8, streak: 3 };
    const cache = sampleCache({ habits: [habit] });
    expect(withHabitLogged(cache, "h").habits[0]?.count).toBe(6);
    const full = sampleCache({ habits: [{ ...habit, count: 8 }] });
    expect(withHabitLogged(full, "h")).toBe(full);
  });

  test("a paid bill leaves the list and what's still to pay", () => {
    const cache = sampleCache({
      bills: [bill("rent"), bill("net", { thisMonth: false })],
      billsLeftMinor: 100_000,
    });
    const paid = withBillPaid(cache, "rent");
    expect(paid.bills.map((b) => b.id)).toEqual(["net"]);
    expect(paid.billsLeftMinor).toBe(0);
    // Next month's bill wasn't counted, so paying it early changes nothing there.
    expect(withBillPaid(cache, "net").billsLeftMinor).toBe(100_000);
  });

  test("a quick-log moves today's and this month's spending; no budget stays no budget", () => {
    const month = {
      month: "2026-11",
      inMinor: 0,
      outMinor: 5_000,
      budgetLimitMinor: 0,
      budgetSpentMinor: 0,
      top: null,
    };
    const logged = withQuickLog(sampleCache({ month }), cha);
    expect(logged.leftTodayMinor).toBe(48_000);
    expect(logged.spentTodayMinor).toBe(12_000);
    expect(logged.month?.outMinor).toBe(7_000);
    expect(withQuickLog(sampleCache({ leftTodayMinor: null }), cha).leftTodayMinor).toBeNull();
  });
});

describe("Undo on the widget", () => {
  test("puts back exactly the fields the tap changed", () => {
    const before = sampleCache({ tasks: [task("a")] });
    const after = withTaskDone(before, "a");
    const restore = restoreOf(before, after);
    expect(Object.keys(restore)).toEqual(["tasks"]);
    const undo: WidgetUndo = {
      id: "u",
      widget: "Tasks",
      text: "Done: a",
      at: 0,
      queued: false,
      forward: [],
      reverse: [],
      restore,
    };
    const undone = afterUndo({ ...after, undo });
    expect(undone.tasks).toEqual(before.tasks);
    expect(undone.undo).toBeNull();
  });

  test("is offered for ten seconds", () => {
    const undo = { at: 1_000 } as WidgetUndo;
    expect(UNDO_WINDOW_MS).toBe(10_000);
    expect(canUndo(undo, 1_000 + UNDO_WINDOW_MS - 1)).toBe(true);
    expect(canUndo(undo, 1_000 + UNDO_WINDOW_MS)).toBe(false);
    expect(canUndo(null, 0)).toBe(false);
  });

  test("the strip says when a tap waits for a connection", () => {
    expect(undoText({ text: "Cha ৳20 logged", queued: false })).toBe("Cha ৳20 logged");
    expect(undoText({ text: "Cha ৳20 logged", queued: true })).toBe("Cha ৳20 logged, syncs later");
  });
});

describe("a quick-log with no account to log to", () => {
  test("logs in place while there is an account", () => {
    expect(quickLogLink(cha, "cash")).toBeNull();
  });

  test("opens quick-add with the entry typed in instead", () => {
    const link = quickLogLink(cha, null);
    expect(link).toBe("ticktaka://add?kind=expense&text=cha%2020");
    expect(decodeURIComponent(link?.split("text=")[1] ?? "")).toBe("cha 20");
  });
});
