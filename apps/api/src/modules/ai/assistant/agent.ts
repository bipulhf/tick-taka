import type { AssistantMessage } from "@tick-taka/shared/schemas/ai";
import type { AiChatMessage } from "../../../ai/client";
import { callAi, logUsage, requireAi } from "../../../ai/usage";
import type { Deps } from "../../../lib/deps";
import { userTime } from "../../../lib/user-time";
import { ASK_TOOLS, runAskTool } from "../ask";
import { describeVocabulary, vocabulary } from "../context";
import { ASSISTANT_PROMPT } from "../prompts";
import { createCaller, type Dispatch } from "./dispatch";
import { createToolRunner, WRITE_TOOLS } from "./tools";

const MAX_ROUNDS = 8;
const MAX_WRITES = 30;
const ASK_NAMES = new Set(ASK_TOOLS.map((tool) => tool.name));
const WRITE_NAMES = new Set(["create", "update", "delete", "act"]);

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

/** Chat assistant: reads with find and the report functions, writes through the app's own routes. */
export async function aiAssistant(
  deps: Deps,
  dispatch: Dispatch,
  authorization: string,
  history: AssistantMessage[],
) {
  const ai = requireAi(deps, "assistant");
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
  const notes: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await callAi(() => ai.chat({ model: "smart", messages, tools }));
    logUsage(deps, "assistant", "smart", result.model, result.usage);
    if (result.toolCalls.length === 0) {
      return {
        reply:
          result.content?.trim() ||
          (runner.actions.length ? "Done." : "I'm not sure how to help with that."),
        actions: runner.actions,
        memo: notes.join("; ").slice(0, 3900),
      };
    }
    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
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
      if (WRITE_NAMES.has(call.name)) {
        const id = (output as { id?: string } | null)?.id;
        notes.push(`${call.name} ${call.arguments.slice(0, 200)}${id ? ` -> id ${id}` : ""}`);
      }
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(output ?? { error: "Unknown function" }),
      });
    }
  }
  return {
    reply: runner.actions.length
      ? "I did part of that. Tell me what's left."
      : "That needed too many steps. Try a smaller request.",
    actions: runner.actions,
    memo: notes.join("; ").slice(0, 3900),
  };
}
