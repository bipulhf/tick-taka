import { expect, test } from "bun:test";
import type { AssistantQuestion } from "@tick-taka/shared/schemas/ai";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import {
  blockingFields,
  formMessage,
  initialFormState,
  openQuestionId,
  parseQuestion,
  quickReplyMessage,
  unreadableAmounts,
} from "../src/features/assistant/question-form";
import { fromStored } from "../src/features/assistant/stored-chat";

const ACCOUNT = "01HZX3K4M5N6P7Q8R9S0T1V2W3";

const newAccount: AssistantQuestion = {
  question: "What should the new account look like?",
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
    { key: "balance", label: "Opening balance", type: "amount", default: 0 },
  ],
  submitLabel: "Add account",
};

test("defaults prefill the form, amounts in major units and the user's digits", () => {
  expect(initialFormState(newAccount, { currency: "BDT" })).toEqual({
    name: "",
    type: "cash",
    balance: "0",
  });
  const bill: AssistantQuestion = {
    question: "How much?",
    fields: [
      { key: "amount", label: "Amount", type: "amount", default: 125050 },
      { key: "due", label: "Due", type: "date", default: "2026-11-05" },
    ],
  };
  expect(initialFormState(bill, { currency: "BDT", numerals: "beng" })).toEqual({
    amount: "১২৫০.৫",
    due: "2026-11-05",
  });
});

test("required fields keep Send waiting until they are filled", () => {
  const state = initialFormState(newAccount, { currency: "BDT" });
  expect(blockingFields(newAccount, state, "BDT")).toEqual(["name"]);
  expect(blockingFields(newAccount, { ...state, name: "  " }, "BDT")).toEqual(["name"]);
  expect(blockingFields(newAccount, { ...state, name: "bKash" }, "BDT")).toEqual([]);
});

test("an amount that doesn't read as one blocks Send, even when optional", () => {
  const state = { name: "bKash", type: "mobile", balance: "12abc" };
  expect(unreadableAmounts(newAccount, state, "BDT")).toEqual(["balance"]);
  expect(blockingFields(newAccount, state, "BDT")).toEqual(["balance"]);
});

test("the filled form becomes one Label: value line per answered field", () => {
  const state = { name: "bKash", type: "mobile", balance: "৫০০০" };
  expect(formMessage(newAccount, state, { currency: "BDT" })).toBe(
    "Name: bKash\nType: Mobile wallet\nOpening balance: 5000 BDT",
  );
  // Sums work, as in the money forms; a skipped optional field is left out.
  expect(formMessage(newAccount, { ...state, balance: "1850/2" }, { currency: "BDT" })).toBe(
    "Name: bKash\nType: Mobile wallet\nOpening balance: 925 BDT",
  );
  expect(formMessage(newAccount, { ...state, balance: "" }, { currency: "BDT" })).toBe(
    "Name: bKash\nType: Mobile wallet",
  );
});

test("record picks are sent with their name and id", () => {
  const pick: AssistantQuestion = {
    question: "Which account?",
    fields: [{ key: "account", label: "Account", type: "account", required: true }],
  };
  const nameOf = (type: string, id: string) =>
    type === "account" && id === ACCOUNT ? "City Bank" : undefined;
  expect(formMessage(pick, { account: ACCOUNT }, { currency: "BDT", nameOf })).toBe(
    `Account: City Bank [id ${ACCOUNT}]`,
  );
});

test("a quick reply sends the clicked option's label", () => {
  const goAhead: AssistantQuestion = {
    question: "That changes 7 tasks. Go ahead?",
    fields: [
      {
        key: "go",
        label: "Go ahead",
        type: "choice",
        required: true,
        options: [
          { value: "yes", label: "Yes, go ahead" },
          { value: "no", label: "No, leave them" },
        ],
      },
    ],
  };
  expect(quickReplyMessage(goAhead, "no")).toBe("No, leave them");
});

const message = (id: string, role: "user" | "assistant", extra: Partial<ChatMessage> = {}) =>
  ({ id, role, content: id, at: 1, ...extra }) satisfies ChatMessage;

test("only the newest reply's question can be answered", () => {
  const asks = message("a2", "assistant", { question: newAccount });
  expect(openQuestionId([message("u1", "user"), asks])).toBe("a2");
  // Answered (or typed over): a later message exists.
  expect(openQuestionId([asks, message("u2", "user")])).toBeNull();
  expect(openQuestionId([asks, message("u2", "user"), message("a3", "assistant", {})])).toBeNull();
  expect(openQuestionId([message("a1", "assistant")])).toBeNull();
  expect(openQuestionId([])).toBeNull();
});

test("a question that doesn't read as one is dropped", () => {
  expect(parseQuestion(newAccount)).toEqual(newAccount);
  expect(parseQuestion(null)).toBeUndefined();
  expect(parseQuestion({ question: "Hm?", fields: [] })).toBeUndefined();
});

test("a stored reply keeps its question; old ones stay as they were", () => {
  const stored = {
    id: "R1",
    role: "assistant" as const,
    content: "What should the new account look like?",
    memo: null,
    cards: [],
    actions: [],
    rating: null,
    createdAt: 1,
  };
  expect(fromStored({ ...stored, question: newAccount }).question).toEqual(newAccount);
  expect("question" in fromStored({ ...stored, question: null })).toBe(false);
  expect("question" in fromStored(stored)).toBe(false);
});
