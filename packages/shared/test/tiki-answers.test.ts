import { describe, expect, test } from "bun:test";
import { newId } from "../src/ids";
import { type AssistantQuestion, assistantQuestionSchema } from "../src/schemas/ai";
import { answerText, answerValue, isQuickReply, missingRequired } from "../src/tiki-answers";

const cash = newId();
const newAccount: AssistantQuestion = assistantQuestionSchema.parse({
  question: "What should the new account be?",
  fields: [
    { key: "name", label: "Name", type: "text", required: true },
    {
      key: "type",
      label: "Type",
      type: "choice",
      required: true,
      default: "cash",
      options: [
        { value: "cash", label: "Cash" },
        { value: "bank", label: "Bank" },
        { value: "mobile", label: "Mobile wallet" },
      ],
    },
    { key: "opening", label: "Opening balance", type: "amount", default: 0 },
    { key: "from", label: "Moved from", type: "account" },
    { key: "on", label: "Opened on", type: "date" },
    { key: "at", label: "At", type: "time" },
  ],
  submitLabel: "Add account",
});

const goAhead: AssistantQuestion = {
  question: "Move these 7 tasks to Friday?",
  fields: [
    {
      key: "go",
      label: "Go ahead",
      type: "choice",
      required: true,
      options: [
        { value: "yes", label: "Yes, move them" },
        { value: "no", label: "No" },
      ],
    },
  ],
};

describe("the question schema", () => {
  test("keeps the contract's limits", () => {
    const one = (field: Record<string, unknown>) =>
      assistantQuestionSchema.safeParse({ question: "Which?", fields: [field] }).success;
    expect(one({ key: "n", label: "Name", type: "text" })).toBe(true);
    expect(
      assistantQuestionSchema.safeParse({ question: "x".repeat(161), fields: newAccount.fields })
        .success,
    ).toBe(false);
    expect(assistantQuestionSchema.safeParse({ question: "Which?", fields: [] }).success).toBe(
      false,
    );
    const seven = Array.from({ length: 7 }, (_, i) => ({ key: `f${i}`, label: "L", type: "text" }));
    expect(assistantQuestionSchema.safeParse({ question: "Which?", fields: seven }).success).toBe(
      false,
    );
    expect(one({ key: "n", label: "x".repeat(41), type: "text" })).toBe(false);
    expect(one({ key: "n", label: "Name", type: "text", default: "x".repeat(81) })).toBe(false);
    expect(
      one({ key: "n", label: "Pick", type: "choice", options: [{ value: "a", label: "A" }] }),
    ).toBe(false);
    const nine = Array.from({ length: 9 }, (_, i) => ({ value: `v${i}`, label: `V${i}` }));
    expect(one({ key: "n", label: "Pick", type: "choice", options: nine })).toBe(false);
    expect(
      one({
        key: "n",
        label: "Pick",
        type: "choice",
        default: "c",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      }),
    ).toBe(false);
    expect(one({ key: "n", label: "Amount", type: "amount", default: 12.5 })).toBe(false);
    expect(one({ key: "n", label: "Due", type: "date", default: "5 Nov" })).toBe(false);
    expect(one({ key: "n", label: "At", type: "time", default: "25:00" })).toBe(false);
    expect(one({ key: "n", label: "Account", type: "account", default: "Cash" })).toBe(false);
    expect(one({ key: "n", label: "Account", type: "account", default: cash })).toBe(true);
    expect(
      one({
        key: "n",
        label: "Category",
        type: "category",
        options: [{ value: "expense", label: "Expense" }],
      }),
    ).toBe(true);
    expect(
      one({ key: "n", label: "Category", type: "category", options: [{ value: "x", label: "X" }] }),
    ).toBe(false);
    expect(one({ key: "n", label: "Mood", type: "colour" })).toBe(false);
    const twice = [
      { key: "n", label: "A", type: "text" },
      { key: "n", label: "B", type: "text" },
    ];
    expect(assistantQuestionSchema.safeParse({ question: "Which?", fields: twice }).success).toBe(
      false,
    );
  });
});

describe("answers as the reply text", () => {
  test("one Label: value line per answered field; skipped optional fields are left out", () => {
    const text = answerText(
      newAccount,
      { name: "  bKash\npersonal ", type: "mobile", opening: 500000, from: cash, on: "", at: null },
      {
        currency: "BDT",
        nameOf: (type, id) => (type === "account" && id === cash ? "Cash" : undefined),
      },
    );
    expect(text).toBe(
      [
        "Name: bKash personal",
        "Type: Mobile wallet",
        "Opening balance: 5000 BDT",
        `Moved from: Cash [id ${cash}]`,
      ].join("\n"),
    );
  });

  test("amounts are major units with the currency code, Latin digits only", () => {
    const opening = newAccount.fields[2]!;
    expect(answerValue(opening, 61667)).toBe("616.67 BDT");
    expect(answerValue(opening, 61660, { currency: "usd" })).toBe("616.60 USD");
    expect(answerValue(opening, -2050)).toBe("-20.50 BDT");
    expect(answerValue(opening, 0)).toBe("0 BDT");
    expect(answerValue(opening, 1500, { currency: "JPY" })).toBe("1500 JPY");
    const text = answerText(newAccount, {
      name: "নগদ",
      type: "cash",
      opening: 12345600,
      on: "২০২৬-১১-০৫",
      at: "০৯:৩০",
    });
    expect(text).toContain("Opening balance: 123456 BDT");
    expect(text).toContain("Opened on: 2026-11-05");
    expect(text).toContain("At: 09:30");
    // Only the user's own words may hold Bangla script; no Bangla digits anywhere.
    expect(text).not.toMatch(/[০-৯]/);
    expect(text).toContain("Name: নগদ");
  });

  test("a picked record without a known name still carries its id", () => {
    expect(answerValue(newAccount.fields[3]!, cash)).toBe(`[id ${cash}]`);
  });

  test("a quick reply sends the option's label", () => {
    expect(isQuickReply(goAhead)).toBe(true);
    expect(isQuickReply(newAccount)).toBe(false);
    expect(answerText(goAhead, { go: "yes" })).toBe("Yes, move them");
    expect(answerText(goAhead, {})).toBe("");
  });

  test("required fields gate Send", () => {
    expect(missingRequired(newAccount, {})).toEqual(["name", "type"]);
    expect(missingRequired(newAccount, { name: "   ", type: "cash" })).toEqual(["name"]);
    expect(missingRequired(newAccount, { name: "bKash", type: "bank" })).toEqual([]);
    expect(missingRequired(goAhead, { go: "no" })).toEqual([]);
  });
});
