import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type LogSink, setLogSink, userTag } from "../src/lib/log";
import { onError } from "../src/middleware/error-handler";
import { createTestContext, JWT_SECRET } from "./helpers";

let restore: LogSink | null = null;
function capture() {
  const lines: Record<string, unknown>[] = [];
  restore = setLogSink((_level, line) => lines.push(JSON.parse(line)));
  return lines;
}
afterEach(() => {
  if (restore) setLogSink(restore);
  restore = null;
});

describe("request logging", () => {
  test("one line per request with id, method, path, status, time and a user tag", async () => {
    const ctx = await createTestContext();
    const lines = capture();
    const res = await ctx.app.request("/tasks?q=secret-search", {
      headers: { authorization: `Bearer ${ctx.token}` },
    });
    expect(res.status).toBe(200);
    const id = res.headers.get("x-request-id");
    expect(id).toBeTruthy();
    const line = lines.find((l) => l.msg === "request")!;
    expect(line).toMatchObject({ reqId: id, method: "GET", path: "/tasks", status: 200 });
    expect(typeof line.ms).toBe("number");
    const user = ctx.deps.users.list()[0]!;
    expect(line.user).toBe(userTag(user.id, JWT_SECRET));
    const text = JSON.stringify(lines);
    expect(text).not.toContain(user.id);
    expect(text).not.toContain(ctx.token);
    expect(text).not.toContain("secret-search");
  });

  test("keeps a well-formed caller request id and replaces a bad one", async () => {
    const ctx = await createTestContext();
    const good = await ctx.app.request("/health", {
      headers: { "x-request-id": "phone-1234abcd" },
    });
    expect(good.headers.get("x-request-id")).toBe("phone-1234abcd");
    const bad = await ctx.app.request("/health", {
      headers: { "x-request-id": '"},{"msg":"forged' },
    });
    expect(bad.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("unexpected errors are logged with the request id, and the client sees no detail", async () => {
    const lines = capture();
    const app = new Hono().onError(onError).get("/boom", () => {
      throw new Error("disk on fire");
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("disk on fire");
    expect(lines[0]).toMatchObject({ level: "error", method: "GET", path: "/boom" });
    expect(String(lines[0]!.error)).toContain("disk on fire");
  });
});

describe("error mapping", () => {
  const appThrowing = (error: unknown) =>
    new Hono().onError(onError).get("/", () => {
      throw error;
    });
  const sqliteError = (code: string) => Object.assign(new Error(code), { code });

  test("a broken link is 400 invalid_reference", async () => {
    const res = await appThrowing(
      new Error("wrapped", { cause: sqliteError("SQLITE_CONSTRAINT_FOREIGNKEY") }),
    ).request("/");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_reference" } });
  });

  test("a duplicate key is 409 conflict", async () => {
    for (const code of ["SQLITE_CONSTRAINT_UNIQUE", "SQLITE_CONSTRAINT_PRIMARYKEY"]) {
      const res = await appThrowing(sqliteError(code)).request("/");
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: { code: "conflict" } });
    }
  });

  test("a row the database's rules refuse is 400 invalid_data, not a 500", async () => {
    for (const code of ["SQLITE_CONSTRAINT_CHECK", "SQLITE_CONSTRAINT_NOTNULL"]) {
      const res = await appThrowing(sqliteError(code)).request("/");
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: { code: "invalid_data" } });
    }
  });

  test("an HTTPException keeps its status", async () => {
    const res = await appThrowing(new HTTPException(413, { message: "Too big" })).request("/");
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: { code: "payload_too_large", message: "Too big" } });
  });

  // CQ-045: the phone reads http_error as "a proxy answered, not the API".
  test("an HTTPException's code comes from its status and is never http_error", async () => {
    const codes: [number, string][] = [
      [400, "invalid_request"],
      [401, "unauthorized"],
      [404, "not_found"],
      [405, "method_not_allowed"],
      [415, "unsupported_media_type"],
      [418, "request_refused"],
      [429, "rate_limited"],
      [500, "internal_error"],
      [502, "internal_error"],
    ];
    for (const [status, code] of codes) {
      const res = await appThrowing(new HTTPException(status as 400, { message: "Nope" })).request(
        "/",
      );
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ error: { code } });
    }
  });

  test("malformed JSON on a real route is an API refusal, not http_error", async () => {
    const ctx = await createTestContext();
    const res = await ctx.app.request("/tasks", {
      method: "POST",
      headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_request" } });
  });
});
