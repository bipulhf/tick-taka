import { describe, expect, test } from "bun:test";
import { newId } from "../src/ids";
import { transactionCreateSchema } from "../src/schemas/money";
import { DEFAULT_SETTINGS, settingsPatchSchema, settingsSchema } from "../src/schemas/settings";
import { taskCreateSchema, taskListQuerySchema } from "../src/schemas/time";

describe("schemas", () => {
  test("ids are ULIDs and sortable", () => {
    const a = newId(1000);
    const b = newId(1000);
    expect(a).toHaveLength(26);
    expect(b > a).toBe(true);
  });

  test("settings defaults", () => {
    expect(DEFAULT_SETTINGS.timeZone).toBe("Asia/Dhaka");
    expect(DEFAULT_SETTINGS.focus).toEqual({ workMinutes: 25, breakMinutes: 5 });
    expect(DEFAULT_SETTINGS.quietHours).toEqual({ start: "23:00", end: "07:00" });
    expect(settingsSchema.parse({ dailyTaskGoal: 3 }).dailyTaskGoal).toBe(3);
  });

  test("settings patch only contains the keys sent", () => {
    expect(settingsPatchSchema.parse({ vacationMode: true })).toEqual({ vacationMode: true });
  });

  test("transfers need two different accounts", () => {
    const base = { type: "transfer", accountId: newId(), amountMinor: 100, occurredAt: 1 };
    expect(transactionCreateSchema.safeParse(base).success).toBe(false);
    expect(
      transactionCreateSchema.safeParse({ ...base, toAccountId: base.accountId }).success,
    ).toBe(false);
    expect(transactionCreateSchema.safeParse({ ...base, toAccountId: newId() }).success).toBe(true);
    expect(
      transactionCreateSchema.safeParse({ ...base, type: "expense", amountMinor: 0 }).success,
    ).toBe(false);
  });

  test("task defaults and query parsing", () => {
    expect(taskCreateSchema.parse({ title: "x" })).toMatchObject({
      status: "inbox",
      priority: "normal",
      whenSlot: "day",
    });
    expect(taskCreateSchema.safeParse({ title: "x", rrule: "FREQ=HOURLY" }).success).toBe(false);
    expect(taskListQuerySchema.parse({ status: "open,inbox" }).status).toEqual(["open", "inbox"]);
  });
});
