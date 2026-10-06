import { describe, expect, test } from "bun:test";
import { createTestContext, DEFAULT_NOW } from "./helpers";

type Task = Record<string, unknown> & { id: string; status: string; rrule: string | null };

describe("undo on tasks is lossless", () => {
  test("undoing completion of a repeating task removes the copy and keeps the series", async () => {
    const ctx = await createTestContext();
    const created = await ctx.request<Task & { subtasks: Task[] }>("POST", "/tasks", {
      title: "Water plants",
      status: "open",
      rrule: "FREQ=DAILY",
      doAt: DEFAULT_NOW,
      subtasks: ["Balcony", "Kitchen"],
    });
    const done = await ctx.request<Task & { next: Task }>("PATCH", `/tasks/${created.body.id}`, {
      status: "done",
    });
    expect(done.body.next.rrule).toBe("FREQ=DAILY");
    const undo = await ctx.request<Task & { next: Task | null }>(
      "PATCH",
      `/tasks/${created.body.id}`,
      { status: "open" },
    );
    expect(undo.body).toMatchObject({ status: "open", rrule: "FREQ=DAILY", doneAt: null });
    const open = await ctx.request<Task[]>("GET", "/tasks?status=open&includeSubtasks=true");
    expect(open.body.filter((t) => t.title === "Water plants").map((t) => t.id)).toEqual([
      created.body.id,
    ]);
    // The copy's subtasks went with it; the original's are untouched.
    expect(open.body.filter((t) => t.parentId).map((t) => t.parentId)).toEqual([
      created.body.id,
      created.body.id,
    ]);
    // Completing again still moves the series on.
    const again = await ctx.request<Task & { next: Task | null }>(
      "PATCH",
      `/tasks/${created.body.id}`,
      { status: "done" },
    );
    expect(again.body.next?.rrule).toBe("FREQ=DAILY");
  });

  test("reopening after the next copy was already worked on leaves the copy alone", async () => {
    const ctx = await createTestContext();
    const created = await ctx.request<Task>("POST", "/tasks", {
      title: "Weekly report",
      status: "open",
      rrule: "FREQ=WEEKLY",
      doAt: DEFAULT_NOW,
    });
    const done = await ctx.request<Task & { next: Task }>("PATCH", `/tasks/${created.body.id}`, {
      status: "done",
    });
    ctx.clock.advance(60_000);
    await ctx.request("PATCH", `/tasks/${done.body.next.id}`, { title: "Weekly report (draft)" });
    const reopened = await ctx.request<Task>("PATCH", `/tasks/${created.body.id}`, {
      status: "open",
    });
    expect(reopened.body.rrule).toBeNull();
    const next = await ctx.request<Task>("GET", `/tasks/${done.body.next.id}`);
    expect(next.status).toBe(200);
    expect(next.body.rrule).toBe("FREQ=WEEKLY");
  });

  test("undoing a delete brings the subtasks back too", async () => {
    const ctx = await createTestContext();
    const created = await ctx.request<Task & { subtasks: Task[] }>("POST", "/tasks", {
      title: "Move flat",
      status: "open",
      subtasks: ["Pack", "Van"],
    });
    // A subtask deleted on its own earlier stays deleted.
    const [pack] = created.body.subtasks;
    ctx.clock.advance(1_000);
    await ctx.request("DELETE", `/tasks/${pack!.id}`);
    ctx.clock.advance(1_000);
    await ctx.request("DELETE", `/tasks/${created.body.id}`);
    const restored = await ctx.request<Task>("POST", `/tasks/${created.body.id}/restore`);
    expect(restored.status).toBe(200);
    const task = await ctx.request<Task & { subtasks: Task[] }>("GET", `/tasks/${created.body.id}`);
    expect(task.body.subtasks.map((t) => t.title)).toEqual(["Van"]);
  });
});
