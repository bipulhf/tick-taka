import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import type { AssistantQuestion } from "@tick-taka/shared/schemas/ai";
import type { ChatMessage } from "../src/features/assistant/chat-store";
import {
  fromServer,
  mergeThread,
  type ServerMessage,
} from "../src/features/assistant/chat-threads";
import { parseQuestion } from "../src/features/assistant/question-form";

const cash = newId();

const newAccount: AssistantQuestion = {
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
      ],
    },
    { key: "opening", label: "Opening balance", type: "amount", default: 0 },
    { key: "from", label: "Moved from", type: "account" },
  ],
  submitLabel: "Add account",
};

const server = (
  id: string,
  role: "user" | "assistant",
  content: string,
  at: number,
  question?: AssistantQuestion | null,
) =>
  ({
    id,
    role,
    content,
    memo: null,
    cards: [],
    actions: [],
    rating: null,
    ...(question === undefined ? {} : { question }),
    createdAt: at,
  }) satisfies ServerMessage;

const local = (fields: Partial<ChatMessage> & Pick<ChatMessage, "role" | "content" | "at">) =>
  ({ id: `l-${fields.at}`, ...fields }) as ChatMessage;

describe("parseQuestion", () => {
  test("keeps a form the app can show", () => {
    expect(parseQuestion(newAccount)).toEqual(newAccount);
  });

  test("no question, or one this app can't show, is left out", () => {
    expect(parseQuestion(undefined)).toBeUndefined();
    expect(parseQuestion(null)).toBeUndefined();
    expect(parseQuestion({ question: "Which?", fields: [] })).toBeUndefined();
    expect(
      parseQuestion({ question: "Which?", fields: [{ key: "x", label: "X", type: "slider" }] }),
    ).toBeUndefined();
  });
});

describe("questions in stored chats", () => {
  test("a stored reply keeps its question; replies without one are unchanged", () => {
    const [ask, plain, old] = fromServer([
      server("s1", "assistant", newAccount.question, 1, newAccount),
      server("s2", "assistant", "Done", 2, null),
      server("s3", "assistant", "Hello", 3),
    ]);
    expect(ask?.question).toEqual(newAccount);
    expect(plain && "question" in plain).toBe(false);
    expect(old && "question" in old).toBe(false);
  });

  test("the phone's copy keeps its question when the server adds nothing", () => {
    const phone = [
      local({ role: "user", content: "Add bKash", at: 10, serverId: "s1" }),
      local({
        role: "assistant",
        content: newAccount.question,
        at: 11,
        serverId: "s2",
        question: newAccount,
      }),
    ];
    const merged = mergeThread(phone, [
      server("s1", "user", "Add bKash", 10),
      server("s2", "assistant", newAccount.question, 11, newAccount),
    ]);
    expect(merged.at(-1)?.question).toEqual(newAccount);
  });

  test("a question written on another device arrives with the new messages", () => {
    const phone = [
      local({ role: "user", content: "Hi", at: 10, serverId: "s1" }),
      local({ role: "assistant", content: "Hello", at: 11, serverId: "s2" }),
    ];
    const merged = mergeThread(phone, [
      server("s1", "user", "Hi", 10),
      server("s2", "assistant", "Hello", 11),
      server("s3", "user", "Add an account", 20),
      server("s4", "assistant", newAccount.question, 21, newAccount),
    ]);
    expect(merged.at(-1)?.question).toEqual(newAccount);
  });

  test("a chat kept from before questions existed still reads the same", () => {
    const saved = JSON.parse(
      JSON.stringify([
        { id: "a", role: "user", content: "Hi", at: 1 },
        { id: "b", role: "assistant", content: "Hello", at: 2, memo: "m", serverId: cash },
      ]),
    ) as ChatMessage[];
    expect(mergeThread(saved, [server(cash, "assistant", "Hello", 2)])).toEqual(saved);
    expect(saved.every((message) => message.question === undefined)).toBe(true);
  });
});
