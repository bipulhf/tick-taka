import type { AssistantMessage } from "@tick-taka/shared/schemas/ai";
import type { AiChatMessage, AiClient, AiToolCall } from "../../../ai/client";
import { callAi, logUsage } from "../../../ai/usage";
import type { Deps } from "../../../lib/deps";
import { userTime } from "../../../lib/user-time";
import { ASK_TOOLS, runAskTool } from "../ask";
import { describeVocabulary, vocabulary } from "../context";
import { ASSISTANT_PROMPT } from "../prompts";
import { createCaller, type Dispatch } from "./dispatch";
import { type Action, createToolRunner, type PendingDelete, WRITE_TOOLS } from "./tools";

/** Model calls per message: enough to look things up, act on several records and check. */
const MAX_ROUNDS = 12;
const MAX_WRITES = 40;
const ASK_NAMES = new Set(ASK_TOOLS.map((tool) => tool.name));
const WRITE_NAMES = new Set(["create", "update", "act"]);
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
      memo: string;
    };

function context(deps: Deps): string {
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
  return [
    `Today is ${today} (${clock}), time zone ${timeZone}.`,
    `Default account: ${defaultAccount}.`,
    describeVocabulary(vocab),
  ].join("\n");
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
      return `Looking up ${entity}s${matching ? ` matching ${matching}` : ""}`;
    }
    case "create":
      return `Adding ${entity} ${name ?? ""}`.trim();
    case "update":
      return fields.status === "done" ? `Completing a ${entity}` : `Updating a ${entity}`;
    case "delete": {
      const count = Array.isArray(args.ids) ? args.ids.length : 0;
      return `Listing ${count === 1 ? `a ${entity}` : `${count} ${entity}s`} for you to confirm`;
    }
    case "act":
      return typeof args.action === "string"
        ? `${args.action[0]!.toUpperCase()}${args.action.slice(1).replaceAll("_", " ")}`
        : "Working on it";
    default:
      return REPORTS[call.name] ?? "Checking your data";
  }
}

/**
 * Chat assistant as an agent: it plans, looks things up, acts through the app's
 * own routes (so writes get the same validation and stay in the signed-in user's
 * database), checks the results and reports back, streaming as it goes.
 * Deletions are only proposed; the user confirms them on the phone.
 */
export async function aiAssistant(
  deps: Deps,
  ai: AiClient,
  dispatch: Dispatch,
  authorization: string,
  history: AssistantMessage[],
  emit: (event: AssistantEvent) => void,
): Promise<void> {
  const { today, timeZone } = userTime(deps);
  const runner = createToolRunner(createCaller(dispatch, authorization), {
    timeZone,
    now: deps.now(),
    today,
  });
  const messages: AiChatMessage[] = [
    { role: "system", content: `${ASSISTANT_PROMPT}\n\n${context(deps)}` },
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
  const tools = [...WRITE_TOOLS, ...ASK_TOOLS];
  let writes = 0;
  let reported = 0;
  const notes: string[] = [];
  const onText = (text: string) => emit({ type: "delta", text });

  const finish = (content: string | null) => {
    const asked = runner.pending.length;
    if (asked) notes.push(`asked to delete ${runner.pending.map((p) => p.path).join(", ")}`);
    emit({
      type: "done",
      reply:
        content?.trim() ||
        (asked
          ? "Please confirm what to delete."
          : runner.actions.length
            ? "Done."
            : "I'm not sure how to help with that."),
      actions: runner.actions,
      deletions: runner.pending,
      memo: notes.join("; ").slice(0, 3900),
    });
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await callAi(() => ai.chat({ model: "smart", messages, tools, onText }));
    logUsage(deps, "assistant", "smart", result.model, result.usage);
    if (result.toolCalls.length === 0) return finish(result.content);
    if (result.content) emit({ type: "reset" });
    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      emit({ type: "status", text: describe(call) });
      let output: unknown;
      if (WRITE_NAMES.has(call.name) && ++writes > MAX_WRITES) {
        output = { error: "Too many changes in one message. Ask the user to continue." };
      } else if (ASK_NAMES.has(call.name)) {
        try {
          output = runAskTool(deps, call.name, call.arguments);
        } catch (error) {
          output = { error: (error as Error).message };
        }
      } else {
        output = await runner.run(call.name, call.arguments);
      }
      emit({
        type: "result",
        ok: !(output as { error?: unknown } | null)?.error && output != null,
      });
      if (WRITE_NAMES.has(call.name)) {
        const id = (output as { id?: string } | null)?.id;
        notes.push(`${call.name} ${call.arguments.slice(0, 200)}${id ? ` -> id ${id}` : ""}`);
      }
      for (; reported < runner.actions.length; reported++)
        emit({ type: "action", action: runner.actions[reported]! });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(output ?? { error: "Unknown function" }),
      });
    }
  }

  // Out of steps: one last call without tools, so the user hears what got done.
  messages.push({ role: "system", content: WRAP_UP });
  const last = await callAi(() => ai.chat({ model: "smart", messages, tools: [], onText }));
  logUsage(deps, "assistant", "smart", last.model, last.usage);
  finish(last.content);
}
