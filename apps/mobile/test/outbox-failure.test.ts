import { afterEach, describe, expect, test } from "bun:test";
import { ApiError, send } from "../src/lib/api";
import { ServerUnreachableError } from "../src/lib/http";
import { describeFailure } from "../src/lib/outbox-failure";
import { classifyFailure, type OutboxEntry } from "../src/lib/outbox-policy";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** What `send` throws for a reply, as the outbox gets it. */
async function failureFor(reply: () => Response | Promise<Response>) {
  globalThis.fetch = (async () => reply()) as unknown as typeof fetch;
  try {
    await send("POST", "/tasks", { id: "x" });
  } catch (error) {
    return describeFailure(error);
  }
  throw new Error("send didn't throw");
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const entry: OutboxEntry = {
  id: "e",
  request: { method: "POST", path: "/tasks" },
  queuedAt: 0,
  attempts: 0,
  maybeDelivered: false,
};

describe("how the outbox reads a failed send (QA-309)", () => {
  test("a proxy's 502 page is 'not reached', so the write waits instead of going stuck", async () => {
    const failure = await failureFor(
      () => new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    );
    expect(failure).toEqual({ unreachable: true });
    expect(classifyFailure(entry, failure)).toBe("retry");
  });

  test("a captive portal's 200 login page is 'not reached', never a reply", async () => {
    const failure = await failureFor(() => new Response("<html>Log in to Wi-Fi</html>"));
    expect(failure).toEqual({ unreachable: true });
  });

  test("our API's refusal keeps its status, and is final", async () => {
    const failure = await failureFor(() =>
      json(400, { error: { code: "validation_error", message: "title: Required" } }),
    );
    expect(failure).toEqual({ status: 400 });
    expect(classifyFailure(entry, failure)).toBe("reject");
  });

  // CQ-045: the code an API sends doesn't make it a proxy; only a reply that isn't our envelope does.
  test("our API's envelope is a refusal whatever its code, even http_error", async () => {
    for (const code of ["http_error", "invalid_request"]) {
      const failure = await failureFor(() =>
        json(400, { error: { code, message: "Malformed JSON in request body" } }),
      );
      expect(failure).toEqual({ status: 400 });
      expect(classifyFailure(entry, failure)).toBe("reject");
    }
  });

  test("a body too large for the proxy is final, not retried forever", async () => {
    const failure = await failureFor(
      () => new Response("<html>413 Request Entity Too Large</html>", { status: 413 }),
    );
    expect(failure).toEqual({ status: 413 });
    expect(classifyFailure(entry, failure)).toBe("reject");
  });

  test("a 401 is a session problem even from something in front of the server", () => {
    expect(describeFailure(new ApiError(401, "http_error", "Request failed (401)", true))).toEqual({
      status: 401,
    });
    expect(classifyFailure(entry, { status: 401 })).toBe("session");
  });

  test("no answer at all is 'not reached'; anything unknown is final", () => {
    expect(describeFailure(new ServerUnreachableError())).toEqual({ unreachable: true });
    expect(describeFailure(new TypeError("boom"))).toEqual({});
    expect(classifyFailure(entry, {})).toBe("reject");
  });
});
