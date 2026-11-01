import { describe, expect, test } from "bun:test";
import { ASSISTANT_PROMPT } from "../src/modules/ai/prompts";

describe("assistant prompt: when to ask", () => {
  test("creates at once when the user gave every value, and never asks for defaults", () => {
    expect(ASSISTANT_PROMPT).toContain("When they gave every value it needs");
    expect(ASSISTANT_PROMPT).toContain("never ask just to confirm what they said");
    expect(ASSISTANT_PROMPT).toContain("an expense or income goes to the default account");
  });

  test("a bill's form asks how often too, prefilled monthly, and turns it into an rrule", () => {
    expect(ASSISTANT_PROMPT).toContain("bill or income: name, amount, how often, next due date");
    expect(ASSISTANT_PROMPT).toContain("Monthly picked");
    expect(ASSISTANT_PROMPT).toContain("FREQ=MONTHLY;BYMONTHDAY=");
  });

  test("undo with nothing changed in this chat says so, without a form", () => {
    expect(ASSISTANT_PROMPT).toContain("if nothing was changed in this chat, say so");
    expect(ASSISTANT_PROMPT).toContain("Don't ask with a form.");
  });
});
