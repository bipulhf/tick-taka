import { describe, expect, test } from "bun:test";
import { isFormAnswer, languageOf, replyLanguage } from "../src/modules/ai/assistant/language";
import { chat, setup } from "./assistant-helpers";

const user = (content: string) => ({ role: "user" as const, content });
const tiki = (content: string, memo?: string) => ({
  role: "assistant" as const,
  content,
  ...(memo ? { memo } : {}),
});

describe("reply language", () => {
  test("Bengali script is Bangla, English is English, Banglish is Bangla", () => {
    expect(languageOf("আজকে কত খরচ হলো?")).toBe("Bangla");
    expect(languageOf("add expense 500")).toBe("English");
    expect(languageOf("add my Nagad wallet with 2500 taka")).toBe("English");
    expect(languageOf("ajke koto khoroch holo")).toBe("Bangla");
    expect(languageOf("kal 500 taka khoroch")).toBe("Bangla");
    expect(languageOf("add a task: বাজার করা and call the bank")).toBe("English");
    expect(languageOf("500")).toBeNull();
  });

  test("form answers are recognised by their Label: value lines", () => {
    expect(
      isFormAnswer("Bill name: Water bill\nAmount (৳): 1200 BDT\nNext due date: 2026-11-10"),
    ).toBe(true);
    expect(isFormAnswer("বিলের নাম: Water bill")).toBe(true);
    expect(isFormAnswer("add a bill")).toBe(false);
    expect(isFormAnswer("Remind me: call mum at 5, and also add milk to the list")).toBe(true);
  });

  test("a form's answer carries no language: the user's own message before it decides", () => {
    // The live case: an English chat whose form came back with Bangla labels.
    expect(
      replyLanguage([
        user("add a bill"),
        tiki("বিলের তথ্য দিন", "asked the user with a form: “…” fields …"),
        user("বিলের নাম: Water bill\nপরিমাণ (৳): 1200 BDT"),
      ]),
    ).toBe("English");
    // A quick reply is one word; the memo marks it as an answer too.
    expect(
      replyLanguage([
        user("ajke koto khoroch holo"),
        tiki("Which account?", "asked the user with a form: “Which account?”"),
        user("Cash"),
      ]),
    ).toBe("Bangla");
    // The latest own message wins over earlier ones.
    expect(replyLanguage([user("আজকে কত খরচ?"), tiki("৳500"), user("thanks, and add milk")])).toBe(
      "English",
    );
    expect(replyLanguage([user("500")])).toBeNull();
  });

  test("the context tells the model which language to use", async () => {
    const { ai, ctx, system } = await setup();
    ai.queueChat({ content: "Added." });
    await chat(ctx, [
      { role: "user", content: "add a bill" },
      {
        role: "assistant",
        content: "বিলের তথ্য দিন",
        memo: "asked the user with a form: “বিলের তথ্য দিন” fields …",
      },
      { role: "user", content: "বিলের নাম: Water bill\nপরিমাণ (৳): 1200 BDT" },
    ]);
    expect(system()).toContain("Reply in English.");
  });
});

describe("what the server says itself", () => {
  test("follows the reply language when the model gives no words", async () => {
    const { ai, say } = await setup();
    ai.queueChat({ content: "" });
    expect((await say("আজকে কী আছে")).body.reply).toBe("এটায় কীভাবে সাহায্য করব বুঝতে পারছি না।");
    ai.queueChat({ content: "  " });
    expect((await say("what's up")).body.reply).toBe("I'm not sure how to help with that.");
  });
});
