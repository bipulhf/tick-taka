import {
  endOfLocalDay,
  isLocalDate,
  MINUTE_MS,
  parseLocalDate,
  startOfLocalDay,
  weekdayOf,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { DEFAULT_CURRENCY, toMinor } from "@tick-taka/shared/money";
import type { AnyDraft } from "@tick-taka/shared/quick-add";
import { parseClock, parseRecurrence } from "@tick-taka/shared/recurrence";
import {
  type AiParseOutput,
  type AiReceiptOutput,
  aiCategorizeOutputSchema,
  aiParseOutputSchema,
  aiReceiptOutputSchema,
} from "@tick-taka/shared/schemas/ai";
import { maskSms } from "@tick-taka/shared/sms";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { toStrictJsonSchema } from "../../ai/json-schema";
import { callAi, logUsage, requireAi } from "../../ai/usage";
import { categoryRules, transactions } from "../../db/schema/money";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { ruleText } from "../category-rules/service";
import {
  describeVocabulary,
  findByName,
  recentCorrections,
  type Vocabulary,
  vocabulary,
} from "./context";
import { CATEGORIZE_PROMPT, PARSE_PROMPT, RECEIPT_PROMPT, SMS_PROMPT } from "./prompts";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function whenLine(deps: Deps): string {
  const { today, timeZone, now } = userTime(deps);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return `Today is ${today} (${DAY_NAMES[weekdayOf(today)]}), local time ${time}, time zone ${timeZone}.`;
}

/** Local date + optional HH:MM to an instant; noon when only a date is known. */
function instantFor(
  date: string | null,
  time: string | null,
  deps: Deps,
): { at: number; hasTime: boolean } | null {
  const { timeZone, today } = userTime(deps);
  const day = date && isLocalDate(date) ? date : time ? today : null;
  if (!day) return null;
  const clock = time ? parseClock(time) : null;
  if (!clock) return { at: startOfLocalDay(day, timeZone), hasTime: false };
  return {
    at: zonedTimeToUtc(
      { ...parseLocalDate(day), hour: clock.hour, minute: clock.minute },
      timeZone,
    ),
    hasTime: true,
  };
}

/** Maps model names back to ids and amounts to minor units. Returns a draft, never a record. */
export function toDraft(output: AiParseOutput, vocab: Vocabulary, deps: Deps): AnyDraft {
  const { now, settings, timeZone } = userTime(deps);
  const account =
    findByName(vocab.accounts, output.accountName) ??
    vocab.accounts.find((a) => a.id === settings.defaultAccountId);
  const currency = account?.currency ?? DEFAULT_CURRENCY;
  const area = findByName(vocab.areas, output.areaName);
  const when = instantFor(output.date, output.time, deps);
  const note = output.note ?? output.title ?? "";
  const occurredAt = when ? (when.hasTime ? when.at : when.at + 12 * 60 * MINUTE_MS) : now;
  const amountMinor = output.amount === null ? null : toMinor(Math.abs(output.amount), currency);

  switch (output.kind) {
    case "expense":
    case "income": {
      const category = findByName(
        vocab.categories.filter((c) => c.kind === output.kind),
        output.categoryName,
      );
      return {
        kind: output.kind,
        amountMinor,
        accountId: account?.id ?? null,
        categoryId: category?.id ?? null,
        areaId: area?.id ?? null,
        note,
        occurredAt,
        confidence: amountMinor !== null && account ? "high" : "low",
      };
    }
    case "transfer":
      return {
        kind: "transfer",
        amountMinor,
        feeMinor: output.fee ? toMinor(output.fee, currency) : 0,
        accountId: account?.id ?? null,
        toAccountId: findByName(vocab.accounts, output.toAccountName)?.id ?? null,
        note,
        occurredAt,
        confidence: amountMinor !== null ? "high" : "low",
      };
    case "time_entry": {
      const minutes = Math.max(0, Math.round(output.minutes ?? 0));
      return {
        kind: "time_entry",
        minutes,
        note,
        areaId: area?.id ?? null,
        startedAt: now - minutes * MINUTE_MS,
        endedAt: now,
        confidence: minutes > 0 ? "high" : "low",
      };
    }
    case "task": {
      const recurrence = output.recurrence ? parseRecurrence(output.recurrence) : null;
      const deadline =
        output.deadline && isLocalDate(output.deadline)
          ? endOfLocalDay(output.deadline, timeZone) - MINUTE_MS
          : null;
      return {
        kind: "task",
        title: output.title ?? note,
        doAt: when?.at ?? null,
        hasTime: when?.hasTime ?? false,
        reminderAt: when?.hasTime ? when.at : null,
        deadlineAt: deadline,
        rrule: recurrence?.rrule ?? null,
        whenSlot: output.whenSlot ?? "day",
        status: "inbox",
        priority: output.priority ?? "normal",
        areaId: area?.id ?? null,
        confidence: output.title ? "high" : "low",
      };
    }
  }
}

/** Smart quick-add and the SMS fallback. */
export async function aiParse(
  deps: Deps,
  input: { text: string; kind?: string | undefined; sms: boolean; sender?: string | undefined },
) {
  const ai = requireAi(deps, "parse");
  const vocab = vocabulary(deps);
  // Defence in depth: the phone masks SMS before sending, the server masks again.
  const text = input.sms ? maskSms(input.text) : input.text;
  const user = [
    whenLine(deps),
    describeVocabulary(vocab),
    input.sender ? `SMS sender: ${input.sender}` : "",
    input.kind ? `The user marked this as: ${input.kind}` : "",
    `Input: ${JSON.stringify(text)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const result = await callAi(() =>
    ai.json({
      model: "fast",
      system: input.sms ? SMS_PROMPT : PARSE_PROMPT,
      user,
      schemaName: "draft",
      jsonSchema: toStrictJsonSchema(aiParseOutputSchema),
    }),
  );
  logUsage(deps, "parse", "fast", result.model, result.usage);
  const output = aiParseOutputSchema.parse(result.data);
  const account = findByName(vocab.accounts, output.accountName);
  return {
    draft: toDraft(output, vocab, deps),
    sms: input.sms
      ? {
          balanceAfterMinor:
            output.balanceAfter === null ? null : toMinor(output.balanceAfter, account?.currency),
          transactionRef: output.transactionRef,
        }
      : null,
  };
}

/** Receipt photo → expense draft. */
export async function aiReceipt(deps: Deps, input: { imageBase64: string; mimeType: string }) {
  const ai = requireAi(deps, "receipt");
  const vocab = vocabulary(deps);
  const result = await callAi(() =>
    ai.json({
      model: "fast",
      system: RECEIPT_PROMPT,
      user: [
        { type: "text", text: `${whenLine(deps)}\n${describeVocabulary(vocab, ["expense"])}` },
        { type: "image", mimeType: input.mimeType, base64: input.imageBase64 },
      ],
      schemaName: "receipt",
      jsonSchema: toStrictJsonSchema(aiReceiptOutputSchema),
    }),
  );
  logUsage(deps, "receipt", "fast", result.model, result.usage);
  const output: AiReceiptOutput = aiReceiptOutputSchema.parse(result.data);
  const draft = toDraft(
    {
      kind: "expense",
      title: null,
      amount: output.total,
      fee: null,
      accountName: null,
      toAccountName: null,
      categoryName: output.categoryName,
      areaName: null,
      note: output.merchant,
      date: output.date,
      time: null,
      minutes: null,
      deadline: null,
      recurrence: null,
      priority: null,
      whenSlot: null,
      balanceAfter: null,
      transactionRef: null,
    },
    vocab,
    deps,
  );
  return { draft, items: output.items };
}

/**
 * Auto-categorise: learned rules first, then the last category used for the same
 * note, and only then an AI call.
 */
export async function aiCategorize(
  deps: Deps,
  input: { note: string; type: "expense" | "income" },
) {
  const text = ruleText(input.note);
  if (text) {
    const rule = deps.db
      .select()
      .from(categoryRules)
      .where(and(isNull(categoryRules.deletedAt), eq(categoryRules.matchText, text)))
      .get();
    if (rule) return { categoryId: rule.categoryId, areaId: rule.areaId, source: "rule" as const };
    const previous = deps.db
      .select({
        categoryId: transactions.categoryId,
        areaId: transactions.areaId,
        note: transactions.note,
      })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          eq(transactions.type, input.type),
          isNotNull(transactions.categoryId),
        ),
      )
      .orderBy(desc(transactions.occurredAt))
      .limit(500)
      .all()
      .find((row) => row.note && ruleText(row.note) === text);
    if (previous)
      return {
        categoryId: previous.categoryId,
        areaId: previous.areaId,
        source: "history" as const,
      };
  }
  const ai = requireAi(deps, "categorize");
  const vocab = vocabulary(deps);
  const corrections = recentCorrections(deps)
    .map((c) => `"${c.matchText}" → ${c.category ?? "none"}`)
    .join("; ");
  const result = await callAi(() =>
    ai.json({
      model: "fast",
      system: CATEGORIZE_PROMPT,
      user: `${describeVocabulary(vocab, [input.type])}\nPast corrections: ${corrections || "none"}\nType: ${input.type}\nNote: ${JSON.stringify(input.note)}`,
      schemaName: "category",
      jsonSchema: toStrictJsonSchema(aiCategorizeOutputSchema),
    }),
  );
  logUsage(deps, "categorize", "fast", result.model, result.usage);
  const output = aiCategorizeOutputSchema.parse(result.data);
  return {
    categoryId:
      findByName(
        vocab.categories.filter((c) => c.kind === input.type),
        output.categoryName,
      )?.id ?? null,
    areaId: findByName(vocab.areas, output.areaName)?.id ?? null,
    source: "ai" as const,
  };
}
