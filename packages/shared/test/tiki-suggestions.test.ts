import { describe, expect, test } from "bun:test";
import { suggestionsFor } from "../src/tiki-suggestions";

const base = {
  view: "/",
  hour: 10,
  overdue: 0,
  inbox: 0,
  topThreeLeft: 0,
  billsDueSoon: 0,
  hasAccounts: true,
  hasBudgets: true,
};

describe("suggestionsFor", () => {
  test("never more than four, never the same one twice", () => {
    const all = suggestionsFor({
      ...base,
      hour: 19,
      overdue: 3,
      inbox: 5,
      topThreeLeft: 2,
      billsDueSoon: 2,
      hasAccounts: false,
      hasBudgets: false,
    });
    expect(all.length).toBe(4);
    expect(new Set(all).size).toBe(all.length);
    expect(suggestionsFor(base)).toHaveLength(4);
  });

  test("money views ask about spending", () => {
    const money = suggestionsFor({ ...base, view: "/money/transactions" });
    expect(money).toContain("এই মাসে কোথায় সবচেয়ে বেশি খরচ হলো?");
    expect(money).toContain("How much can I spend today?");
    const noBudgets = suggestionsFor({ ...base, view: "/money", hasBudgets: false });
    expect(noBudgets).toContain("Help me set a budget for this month");
  });

  test("evenings offer to close the day, mornings what to do first", () => {
    expect(suggestionsFor({ ...base, hour: 20 })[0]).toBe("Close my day");
    expect(suggestionsFor({ ...base, hour: 10 })).not.toContain("Close my day");
    expect(suggestionsFor({ ...base, hour: 8, topThreeLeft: 2 })).toContain(
      "What should I do first?",
    );
  });

  test("overdue tasks offer to move them; an empty account offers setup first", () => {
    expect(suggestionsFor({ ...base, overdue: 2 })[0]).toBe("পুরোনো কাজগুলো আজকে সরিয়ে দাও");
    const empty = suggestionsFor({ ...base, overdue: 2, hasAccounts: false });
    expect(empty.slice(0, 2)).toEqual(["Help me set up my accounts", "পুরোনো কাজগুলো আজকে সরিয়ে দাও"]);
  });

  test("inbox and bills show up on Today; habit and review views get their own", () => {
    const today = suggestionsFor({ ...base, inbox: 4, billsDueSoon: 1 });
    expect(today).toContain("Help me sort my inbox");
    expect(today).toContain("Which bills are due this week?");
    expect(suggestionsFor({ ...base, view: "/plan/habits" })[0]).toBe(
      "Which habits are left today?",
    );
    expect(suggestionsFor({ ...base, view: "/review/weekly" })[0]).toBe("How did my week go?");
    // Phone routes carry groups in brackets and query strings.
    expect(suggestionsFor({ ...base, view: "/(tabs)/money?sheet=tx" })).toContain(
      "How much can I spend today?",
    );
  });
});
