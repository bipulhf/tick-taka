import { describe, expect, test } from "bun:test";
import { call, chat, fields, setup } from "./assistant-helpers";
import type { TestContext } from "./helpers";
import { setupMoney } from "./money-helpers";

interface Draft {
  summary: string;
  method: string;
  path: string;
  body: Record<string, unknown>;
}
type Message = { role: "user" | "assistant"; content: string; memo?: string };

/** One message from the chat screen, which always asks for money drafts. */
async function turn(ctx: TestContext, messages: Message[]) {
  const { body } = await chat(ctx, messages, ctx.token, { draftMoney: true });
  return body as typeof body & { drafts: Draft[] };
}

/** The seeded "Cash" account, the default; setupMoney adds a second one of that name. */
const defaultAccountId = async (ctx: TestContext) =>
  (await ctx.request<{ defaultAccountId: string }>("GET", "/settings")).body.defaultAccountId;

const expense = (note: string, amount: number, more: Record<string, unknown> = {}) =>
  call("create", {
    entity: "transaction",
    fields: fields({ type: "expense", amount, note, ...more }),
    draftId: null,
  });

const firstTurn = [
  expense("Rickshaw vara", 100),
  expense("Kebab", 380),
  expense("Laptop Table", 500),
];

// "rickshaw vara 100, kebab 380, laptop table 500", then "cut from bKash": the
// three are drafts nobody saved yet, so find can't see them.
describe("assistant corrects drafts and keeps the chat's account", () => {
  test("the memo lists each draft's id, amount and account", async () => {
    const { ai, ctx } = await setup();
    await setupMoney(ctx);
    ai.queueChat({ toolCalls: firstTurn }, { content: "Three expenses wait for your tap." });
    const done = await turn(ctx, [{ role: "user", content: "rickshaw vara 100, kebab 380" }]);
    expect(done.drafts).toHaveLength(3);
    const [rickshaw] = done.drafts;
    expect(rickshaw!.body.accountId).toBe(await defaultAccountId(ctx));
    expect(done.memo).toContain("proposed for confirmation, not saved yet");
    expect(done.memo).toContain(
      `Add transaction “Rickshaw vara” [draftId ${rickshaw!.body.id}, expense, 100 taka, account “Cash”]`,
    );
    // The default account alone isn't the chat's account.
    expect(done.memo).not.toContain("in this chat go through");
  });

  test("a correction re-drafts under the same ids, and later money goes through that account", async () => {
    const { ai, ctx, system } = await setup();
    const { bkash } = await setupMoney(ctx);
    ai.queueChat({ toolCalls: firstTurn }, { content: "Three expenses wait for your tap." });
    const user = "rickshaw vara 100, Kebab 380, Laptop Table 500";
    const first = await turn(ctx, [{ role: "user", content: user }]);
    const ids = first.drafts.map((draft) => draft.body.id as string);

    ai.queueChat(
      {
        toolCalls: first.drafts.map((draft, i) =>
          call("create", {
            entity: "transaction",
            fields: fields({
              type: "expense",
              amount: (draft.body.amountMinor as number) / 100,
              note: draft.body.note,
              account: "bKash",
            }),
            draftId: ids[i],
          }),
        ),
      },
      { content: "Moved all three to bKash, waiting for your tap." },
    );
    const history: Message[] = [
      { role: "user", content: user },
      { role: "assistant", content: first.reply, memo: first.memo },
      { role: "user", content: "cut from bKash" },
    ];
    const before = ai.chatRequests.length;
    const second = await turn(ctx, history);
    // A follow-up to drafts starts on the smart model.
    expect(ai.chatRequests[before]!.model).toBe("smart");
    expect(second.drafts.map((draft) => draft.body.id)).toEqual(ids);
    expect(second.drafts.every((draft) => draft.body.accountId === bkash.id)).toBe(true);
    expect(second.memo.startsWith("expenses and income in this chat go through “bKash”")).toBe(
      true,
    );
    // Nothing was saved along the way.
    const saved = await ctx.request<{ items: unknown[] }>("GET", "/transactions");
    expect(saved.body.items).toHaveLength(0);

    ai.queueChat({ toolCalls: [expense("Tea", 20)] }, { content: "Tea is waiting." });
    const third = await turn(ctx, [
      ...history,
      { role: "assistant", content: second.reply, memo: second.memo },
      { role: "user", content: "tea 20" },
    ]);
    expect(system()).toContain("Account in this chat: bKash");
    expect(system()).toContain("not the default account Cash");
    expect(third.drafts[0]!.body.accountId).toBe(bkash.id);
    // It carries on to the message after.
    expect(third.memo).toContain("in this chat go through “bKash”");
  });

  test("naming another account moves the chat to it", async () => {
    const { ai, ctx } = await setup();
    const { bkash } = await setupMoney(ctx);
    ai.queueChat({ toolCalls: [expense("Lunch", 150, { account: "Cash" })] }, { content: "Ok." });
    const done = await turn(ctx, [
      { role: "user", content: "kebab 380" },
      {
        role: "assistant",
        content: "Ok.",
        memo: "expenses and income in this chat go through “bKash”",
      },
      { role: "user", content: "lunch 150 from cash" },
    ]);
    expect(done.drafts[0]!.body.accountId).not.toBe(bkash.id);
    expect(done.memo).toContain("in this chat go through “Cash”");
  });

  test("correcting the same draft twice in one message leaves one card", async () => {
    const { ai, ctx } = await setup();
    await setupMoney(ctx);
    ai.queueChat({ toolCalls: [expense("Kebab", 380)] }, { content: "Waiting." });
    const first = await turn(ctx, [{ role: "user", content: "kebab 380" }]);
    const id = first.drafts[0]!.body.id;
    const again = (amount: number) =>
      call("create", {
        entity: "transaction",
        fields: fields({ type: "expense", amount, note: "Kebab" }),
        draftId: id,
      });
    ai.queueChat({ toolCalls: [again(390), again(400)] }, { content: "Changed." });
    const second = await turn(ctx, [{ role: "user", content: "kebab was 400" }]);
    expect(second.drafts).toHaveLength(1);
    expect(second.drafts[0]!.body).toMatchObject({ id, amountMinor: 40_000 });
  });

  test("a draft the user already saved is changed with update, not re-drafted", async () => {
    const { ai, ctx, lastTool } = await setup();
    await setupMoney(ctx);
    ai.queueChat({ toolCalls: [expense("Kebab", 380)] }, { content: "Waiting." });
    const first = await turn(ctx, [{ role: "user", content: "kebab 380" }]);
    const draft = first.drafts[0]!;
    await ctx.request("POST", draft.path, draft.body);
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "transaction",
            fields: fields({ type: "expense", amount: 380, note: "Kebab", account: "bKash" }),
            draftId: draft.body.id,
          }),
        ],
      },
      { content: "It's saved already." },
    );
    const second = await turn(ctx, [{ role: "user", content: "cut from bKash" }]);
    expect(second.drafts).toHaveLength(0);
    expect(String(lastTool().error)).toContain(`with update and id ${draft.body.id}`);
  });

  test("update on an unsaved draft's id says to correct it with create and draftId", async () => {
    const { ai, ctx, lastTool } = await setup();
    await setupMoney(ctx);
    ai.queueChat({ toolCalls: [expense("Kebab", 380)] }, { content: "Waiting." });
    const first = await turn(ctx, [{ role: "user", content: "kebab 380" }]);
    ai.queueChat(
      {
        toolCalls: [
          call("update", {
            entity: "transaction",
            id: first.drafts[0]!.body.id,
            fields: fields({ account: "bKash" }),
          }),
        ],
      },
      { content: "Couldn't." },
    );
    await turn(ctx, [{ role: "user", content: "cut from bKash" }]);
    expect(String(lastTool().error)).toContain("draftId set to this id");
  });

  test("draftId outside drafts is refused", async () => {
    const { ai, ctx, lastTool } = await setup();
    await setupMoney(ctx);
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "task",
            fields: fields({ title: "Call bank" }),
            draftId: "01JABCDEFGHJKMNPQRSTVWXYZ0",
          }),
        ],
      },
      { content: "Couldn't." },
    );
    await turn(ctx, [{ role: "user", content: "add call bank" }]);
    expect(String(lastTool().error)).toContain("draftId is only for correcting a money draft");
  });
});
