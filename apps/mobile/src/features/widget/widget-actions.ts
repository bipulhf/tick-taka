import { newId } from "@tick-taka/shared/ids";
import { rememberAccountRequest } from "@/features/money/pay-account";
import { unpayRequest } from "@/features/money/recurring-pay";
import { cancelFocusEnd, scheduleFocusEndQuietly } from "@/lib/notifications";
import type { OutboxRequest } from "@/lib/outbox-policy";
import { editTime, toServerTime } from "@/lib/server-clock";
import { readWidgetCache, type WidgetCache, writeWidgetCache } from "./widget-cache";
import { billTap } from "./widget-model";
import {
  afterUndo,
  canUndo,
  laterDoAt,
  restoreOf,
  withBillPaid,
  withHabitLogged,
  withQuickLog,
  withTaskDone,
  withTaskLater,
} from "./widget-optimistic";
import { widgetMoney } from "./widget-snapshot";
import { deliver, takeBack } from "./widget-writes";

/**
 * What a tap on a widget does without opening the app. Each change shows on the
 * widgets at once (from the cache), goes to the server or waits on the phone, and
 * can be undone from the widget for a few seconds.
 */

interface Change {
  next: WidgetCache;
  writes: OutboxRequest[];
  reverse: OutboxRequest[];
  text: string;
}

function stamp(write: OutboxRequest): OutboxRequest {
  const body = write.body as Record<string, unknown> | undefined;
  return body && "updatedAt" in body
    ? { ...write, body: { ...body, updatedAt: editTime() } }
    : write;
}

function taskDone(cache: WidgetCache, id: string, now: number): Change | null {
  const task = [...cache.tasks, ...cache.earlier].find((t) => t.id === id);
  if (!task || task.done) return null;
  return {
    next: withTaskDone(cache, id),
    writes: [
      {
        method: "PATCH",
        path: `/tasks/${id}`,
        body: { status: "done", doneAt: toServerTime(now), updatedAt: editTime() },
        label: "Couldn't update the task",
      },
    ],
    reverse: [
      {
        method: "PATCH",
        path: `/tasks/${id}`,
        body: { status: task.status, doneAt: null, updatedAt: 0 },
        label: "Couldn't undo",
      },
    ],
    text: `Done: ${task.title}`,
  };
}

function taskLater(cache: WidgetCache, id: string, now: number): Change | null {
  const task = [...cache.tasks, ...cache.earlier].find((t) => t.id === id);
  if (!task) return null;
  return {
    next: withTaskLater(cache, id),
    writes: [
      {
        method: "PATCH",
        path: `/tasks/${id}`,
        body: { doAt: laterDoAt(task.doAt, now), updatedAt: editTime() },
        label: "Couldn't snooze",
      },
    ],
    reverse: [
      {
        method: "PATCH",
        path: `/tasks/${id}`,
        body: { doAt: task.doAt, updatedAt: 0 },
        label: "Couldn't undo",
      },
    ],
    text: `${task.title} moved to tomorrow`,
  };
}

function habitLogged(cache: WidgetCache, id: string): Change | null {
  const habit = cache.habits.find((h) => h.id === id);
  const next = withHabitLogged(cache, id);
  const after = next.habits.find((h) => h.id === id);
  if (!habit || !after || next === cache) return null;
  const path = `/habits/${id}/logs/${cache.date}`;
  return {
    next,
    writes: [
      { method: "PUT", path, body: { count: after.count }, label: `Couldn't update ${habit.name}` },
    ],
    reverse: [{ method: "PUT", path, body: { count: habit.count }, label: "Couldn't undo" }],
    text: `${habit.emoji} ${habit.name} ${after.count}/${after.target}`,
  };
}

function billPaid(cache: WidgetCache, id: string): Change | null {
  const bill = cache.bills.find((b) => b.id === id);
  if (!bill) return null;
  const tap = billTap(bill, cache);
  if (tap.kind !== "pay") return null;
  const body = {
    transactionId: newId(),
    dueAt: bill.dueAt,
    ...(tap.accountId ? { accountId: tap.accountId } : {}),
  };
  const writes: OutboxRequest[] = [];
  if (tap.accountId && tap.remember)
    writes.push(rememberAccountRequest(bill, tap.accountId, editTime()));
  writes.push({
    method: "POST",
    path: `/recurring/${id}/pay`,
    body,
    label: `Couldn't log ${bill.name}`,
  });
  return {
    next: withBillPaid(cache, id),
    writes,
    reverse: [unpayRequest(bill, body)],
    text: `${bill.name} ${bill.income ? "received" : "paid"}`,
  };
}

function quickLogged(cache: WidgetCache, index: number, now: number): Change | null {
  const entry = cache.quick[index];
  if (!entry || !cache.accountId) return null;
  const id = newId();
  return {
    next: withQuickLog(cache, entry),
    writes: [
      {
        method: "POST",
        path: "/transactions",
        body: {
          id,
          type: "expense",
          note: entry.note,
          amountMinor: entry.amountMinor,
          categoryId: entry.categoryId,
          accountId: cache.accountId,
          occurredAt: toServerTime(now),
        },
        label: `Couldn't log ${entry.label}`,
      },
    ],
    reverse: [{ method: "DELETE", path: `/transactions/${id}`, label: "Couldn't undo" }],
    text: `${entry.label} ${widgetMoney(cache)(entry.amountMinor)} logged`,
  };
}

async function apply(widget: string, cache: WidgetCache, change: Change | null, now: number) {
  if (!change) return cache;
  const sent = await deliver(change.writes);
  if (sent.refused) {
    const next = { ...cache, status: "Couldn't do that here. Try it in the app." };
    await writeWidgetCache(next);
    return next;
  }
  const next: WidgetCache = {
    ...change.next,
    status: null,
    undo: {
      id: newId(),
      widget,
      text: change.text,
      at: now,
      queued: sent.queued,
      forward: sent.ids,
      reverse: change.reverse,
      restore: restoreOf(cache, change.next),
    },
  };
  await writeWidgetCache(next);
  return next;
}

async function undo(cache: WidgetCache, now: number): Promise<WidgetCache> {
  if (!canUndo(cache.undo, now)) {
    const next = { ...cache, undo: null, status: "Too late to undo here. Change it in the app." };
    await writeWidgetCache(next);
    return next;
  }
  await takeBack(cache.undo.forward, cache.undo.reverse.map(stamp));
  const next = afterUndo(cache);
  await writeWidgetCache(next);
  return next;
}

async function focusStart(cache: WidgetCache, now: number): Promise<WidgetCache> {
  if (cache.focus) return cache;
  const entryId = newId();
  const task = cache.tasks.find((t) => !t.done && t.top) ?? cache.tasks.find((t) => !t.done);
  const endsAt = now + cache.focusMinutes * 60_000;
  const sent = await deliver([
    {
      method: "POST",
      path: "/timer/start",
      body: {
        id: entryId,
        taskId: task?.id ?? null,
        source: "focus",
        startedAt: toServerTime(now),
      },
      label: "Couldn't start the timer",
    },
  ]);
  if (sent.refused) return { ...cache, status: "Couldn't start focus here. Try it in the app." };
  await scheduleFocusEndQuietly(endsAt, "Focus done 🌱", "Time for a short break.").catch(() => {});
  const next: WidgetCache = {
    ...cache,
    status: null,
    focus: {
      entryId,
      startedAt: now,
      endsAt,
      taskId: task?.id ?? null,
      title: task?.title ?? null,
    },
  };
  await writeWidgetCache(next);
  return next;
}

/** Stops the session now, or at its end when it ran out while no one was looking. */
export async function focusStop(cache: WidgetCache, endedAt: number): Promise<WidgetCache> {
  if (!cache.focus) return cache;
  await deliver([
    {
      method: "POST",
      path: "/timer/stop",
      body: { id: cache.focus.entryId, endedAt: toServerTime(endedAt) },
      label: "Couldn't stop the timer",
    },
  ]);
  // Stopped early: the "Focus done" notification mustn't ring later.
  if (endedAt < cache.focus.endsAt) await cancelFocusEnd().catch(() => {});
  const next: WidgetCache = { ...cache, focus: null, status: null };
  await writeWidgetCache(next);
  return next;
}

/** Runs a tap on `widget` and returns the cache the widgets redraw from. */
export async function runAction(
  widget: string,
  action: string,
  data: Record<string, unknown> | undefined,
  now: number,
): Promise<WidgetCache> {
  const cache = await readWidgetCache();
  if (!cache.signedIn) return cache;
  const id = String(data?.id ?? "");
  switch (action) {
    case "TASK_DONE":
      return apply(widget, cache, taskDone(cache, id, now), now);
    case "TASK_LATER":
      return apply(widget, cache, taskLater(cache, id, now), now);
    case "HABIT":
      return apply(widget, cache, habitLogged(cache, id), now);
    case "PAY":
      return apply(widget, cache, billPaid(cache, id), now);
    case "LOG":
      return apply(widget, cache, quickLogged(cache, Number(data?.index ?? -1), now), now);
    case "UNDO":
      return undo(cache, now);
    case "FOCUS_START":
      return focusStart(cache, now);
    case "FOCUS_STOP":
      return focusStop(cache, now);
    default:
      return cache;
  }
}
