import { defined } from "@tick-taka/shared/defined";
import type {
  AssistantCard,
  AssistantMessage,
  AssistantScreen,
} from "@tick-taka/shared/schemas/ai";
import type { AiChatMessage, AiClient, AiToolCall } from "../../../ai/client";
import { callAi, logUsage } from "../../../ai/usage";
import type { Deps } from "../../../lib/deps";
import { AppError } from "../../../lib/errors";
import { userTime } from "../../../lib/user-time";
import { describeVocabulary, vocabulary } from "../context";
import { ASSISTANT_DRAFT_MONEY_NOTE, ASSISTANT_PROMPT } from "../prompts";
import { createCaller, type Dispatch } from "./dispatch";
import { NOTE_TOOLS } from "./notes";
import { ASK_TOOLS, runAskTool } from "./read-tools";
import type { Action, Draft, PendingDelete } from "./records";
import { describeScreen } from "./screen";
import { createToolRunner, WRITE_TOOLS } from "./tools";

/** Model calls per message: enough to look things up, act on several records and check. */
const MAX_ROUNDS = 12;
const MAX_WRITES = 40;
const ASK_NAMES = new Set(ASK_TOOLS.map((tool) => tool.name));
const WRITE_NAMES = new Set(["create", "update", "act", "remember", "forget"]);
/** Longest message that may start on the fast model: a short command, not a question. */
const FAST_MAX_LENGTH = 80;
/** Calls the fast model may make before a turn moves to the smart one. */
const FAST_ROUNDS = 2;
/** Left in the memo when a step failed, so the next message starts on the smart model. */
const STEP_FAILED = "a step failed";
const CAP_REACHED_PART_WAY =
  "This month's AI budget ran out part way through. Here is what I did before it stopped; ask again next month or use the app's forms for the rest.";
const WRAP_UP =
  "You have used every step for this message. Do not call tools. Tell the user, briefly, what you finished and what is still left for them to ask again.";

/** What the phone sees while Tiki works, in order. `done` is the whole answer. */
export type AssistantEvent =
  | { type: "status"; text: string }
  /** How the step just announced by status went. */
  | { type: "result"; ok: boolean }
  | { type: "delta"; text: string }
  /** The text so far was a note before using tools, not the answer: clear it. */
  | { type: "reset" }
  | { type: "action"; action: Action }
  | {
      type: "done";
      reply: string;
      actions: Action[];
      deletions: PendingDelete[];
      /** Money changes waiting for the user's tap (only when the phone asked for drafts). */
      drafts: Draft[];
      memo: string;
      /** Records to open and totals to show under the reply. */
      cards: AssistantCard[];
      /** With a threadId in the request: the chat, and the stored reply's id (for feedback). */
      threadId?: string;
      messageId?: string;
    };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function context(deps: Deps, screen: string | null): string {
  const { today, timeZone, settings, now } = userTime(deps);
  const vocab = vocabulary(deps);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const defaultAccount =
    vocab.accounts.find((a) => a.id === settings.defaultAccountId)?.name ??
    vocab.accounts[0]?.name ??
    "none";
  const notes = settings.tikiNotes.length
    ? `What the user asked you to remember:\n${settings.tikiNotes.map((note) => `- ${note}`).join("\n")}`
    : null;
  return [
    `Today is ${today} (${clock}), time zone ${timeZone}.`,
    `Default account: ${defaultAccount}.`,
    // "This week" means the user's week, not Monday to Sunday.
    `Weeks start on ${WEEKDAYS[settings.weekStartsOn] ?? "Saturday"}.`,
    describeVocabulary(vocab),
    notes,
    screen,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Short commands without a question start on the fast model ("spent 120 on
 * rickshaw"); questions, long requests and chats where a step failed before use
 * the smart one.
 */
function startsFast(history: AssistantMessage[]): boolean {
  const last = history.at(-1);
  return (
    last?.role === "user" &&
    last.content.trim().length <= FAST_MAX_LENGTH &&
    !/[?？]/.test(last.content) &&
    !history.some((message) => message.memo?.includes(STEP_FAILED))
  );
}

const REPORTS: Record<string, string> = {
  spendByCategory: "Adding up spending by category",
  spendByArea: "Adding up spending by area",
  incomeByCategory: "Adding up income",
  hoursByArea: "Adding up tracked hours",
  tasksCompleted: "Counting finished tasks",
  accountBalances: "Checking account balances",
  budgetStatus: "Checking budgets",
  habitStreaks: "Checking habit streaks",
  debtsSummary: "Checking debts",
};

const quote = (value: unknown) =>
  typeof value === "string" && value.trim() ? `“${value.trim().slice(0, 40)}”` : null;

/** A short line for the phone about the step being taken. */
/** "categories", "time entries", "bills": status lines name more than one record. */
export function plural(entity: string): string {
  if (entity === "recurring") return "bills and income";
  if (/[^aeiou]y$/.test(entity)) return `${entity.slice(0, -1)}ies`;
  return entity.endsWith("s") ? entity : `${entity}s`;
}

function describe(call: AiToolCall): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
  } catch {}
  let fields: Record<string, unknown> = {};
  try {
    fields = JSON.parse(String(args.fields ?? "{}")) as Record<string, unknown>;
  } catch {}
  const entity = typeof args.entity === "string" ? args.entity.replace("_", " ") : "record";
  const name = quote(fields.title ?? fields.name ?? fields.note ?? fields.person);
  switch (call.name) {
    case "find": {
      const matching = quote(args.query);
      return `Looking up ${plural(entity)}${matching ? ` matching ${matching}` : ""}`;
    }
    case "create":
      return `Adding ${entity} ${name ?? ""}`.trim();
    case "update":
      return fields.status === "done" ? `Completing a ${entity}` : `Updating a ${entity}`;
    case "delete": {
      const count = Array.isArray(args.ids) ? args.ids.length : 0;
      return `Listing ${count === 1 ? `a ${entity}` : `${count} ${plural(entity)}`} for you to confirm`;
    }
    case "remember":
      return "Remembering that";
    case "forget":
      return "Forgetting a note";
    case "act":
      return typeof args.action === "string"
        ? `${args.action.charAt(0).toUpperCase()}${args.action.slice(1).replaceAll("_", " ")}`
        : "Working on it";
    default:
      return REPORTS[call.name] ?? "Checking your data";
  }
}

/**
 * Chat assistant as an agent: it plans, looks things up, acts through the app's
 * own routes (so writes get the same validation and stay in the signed-in user's
 * database), checks the results and reports back, streaming as it goes.
 * Deletions are only proposed; the user confirms them on the phone. With
 * `draftMoney`, money changes are only proposed too (`done.drafts`).
 * When `signal` aborts (the phone went away), it stops before the next model
 * call or change, so nothing more is spent or written that nobody will see.
 * `screen` is what the user is looking at; "this" and "it" mean its record.
 */
export async function aiAssistant(
  deps: Deps,
  ai: AiClient,
  dispatch: Dispatch,
  authorization: string,
  history: AssistantMessage[],
  emit: (event: AssistantEvent) => void,
  options: { signal?: AbortSignal; draftMoney?: boolean; screen?: AssistantScreen } = {},
): Promise<void> {
  const { signal, draftMoney = false } = options;
  const stopped = () => signal?.aborted === true;
  const { today, timeZone } = userTime(deps);
  const caller = createCaller(dispatch, authorization);
  const screen = await describeScreen(caller, options.screen);
  const runner = createToolRunner(caller, {
    timeZone,
    now: deps.now(),
    today,
    draftMoney,
  });
  const prompt = draftMoney
    ? `${ASSISTANT_PROMPT}\n${ASSISTANT_DRAFT_MONEY_NOTE}`
    : ASSISTANT_PROMPT;
  const messages: AiChatMessage[] = [
    { role: "system", content: `${prompt}\n\n${context(deps, screen)}` },
    ...history.map(
      (message): AiChatMessage =>
        message.role === "user"
          ? { role: "user", content: message.content }
          : {
              role: "assistant",
              content: message.memo
                ? `${message.content}\n(Done earlier: ${message.memo})`
                : message.content,
            },
    ),
  ];
  const tools = [...WRITE_TOOLS, ...NOTE_TOOLS, ...ASK_TOOLS];
  let writes = 0;
  let reported = 0;
  let failed = 0;
  const notes: string[] = [];
  const onText = (text: string) => emit({ type: "delta", text });
  // Moves to smart for the rest of the turn after a failed step or the fast rounds.
  let tier: "fast" | "smart" = startsFast(history) ? "fast" : "smart";
  const chat = async (withTools: typeof tools) => {
    const model = tier;
    const result = await callAi(
      () => ai.chat({ model, messages, tools: withTools, onText, signal }),
      signal,
    );
    logUsage(deps, "assistant", model, result.model, result.usage);
    return result;
  };

  const finish = (content: string | null) => {
    const asked = runner.pending.length;
    if (asked) notes.push(`asked to delete ${runner.pending.map((p) => p.path).join(", ")}`);
    if (runner.drafts.length)
      notes.push(`proposed for confirmation: ${runner.drafts.map((d) => d.summary).join(", ")}`);
    // The failure note goes last and survives a long memo being cut.
    const done = notes.join("; ").slice(0, failed ? 3900 - STEP_FAILED.length - 2 : 3900);
    const reply =
      content?.trim() ||
      (asked || runner.drafts.length
        ? "Please confirm on screen."
        : runner.actions.length
          ? "Done."
          : "I'm not sure how to help with that.");
    emit({
      type: "done",
      reply,
      actions: runner.actions,
      deletions: runner.pending,
      drafts: runner.drafts,
      memo: failed ? [done, STEP_FAILED].filter(Boolean).join("; ") : done,
      cards: runner.cards.list(reply),
    });
  };
  const didSomething = () =>
    runner.actions.length > 0 || runner.pending.length > 0 || runner.drafts.length > 0;
  /** The cap is checked before every call; hitting it part way still reports what was done. */
  const chatOrStop = async (withTools: typeof tools) => {
    try {
      return await chat(withTools);
    } catch (error) {
      if (error instanceof AppError && error.code === "ai_cap_reached" && didSomething()) {
        finish(CAP_REACHED_PART_WAY);
        return null;
      }
      throw error;
    }
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (stopped()) return;
    const result = await chatOrStop(tools);
    if (!result || stopped()) return;
    if (result.toolCalls.length === 0) return finish(result.content);
    if (result.content) emit({ type: "reset" });
    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      if (stopped()) return;
      emit({ type: "status", text: describe(call) });
      let output: unknown;
      if (WRITE_NAMES.has(call.name) && ++writes > MAX_WRITES) {
        output = { error: "Too many changes in one message. Ask the user to continue." };
      } else if (ASK_NAMES.has(call.name)) {
        try {
          output = runAskTool(deps, call.name, call.arguments);
          runner.cards.report(call.name, call.arguments, output);
        } catch (error) {
          output = { error: (error as Error).message };
        }
      } else {
        output = await runner.run(call.name, call.arguments);
      }
      const ok = !(output as { error?: unknown } | null)?.error && output != null;
      if (!ok) failed++;
      emit({ type: "result", ok });
      if (WRITE_NAMES.has(call.name)) {
        const id = (output as { id?: string } | null)?.id;
        notes.push(`${call.name} ${call.arguments.slice(0, 200)}${id ? ` -> id ${id}` : ""}`);
      }
      for (; reported < runner.actions.length; reported++)
        emit({ type: "action", action: defined(runner.actions[reported], "the action") });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(output ?? { error: "Unknown function" }),
      });
    }
    if (failed || round + 1 >= FAST_ROUNDS) tier = "smart";
  }

  // Out of steps: one last call without tools, so the user hears what got done.
  if (stopped()) return;
  messages.push({ role: "system", content: WRAP_UP });
  const last = await chatOrStop([]);
  if (last && !stopped()) finish(last.content);
}
