import { describe, expect, test } from "bun:test";
import { createTestContext } from "./helpers";

describe("public pages", () => {
  test("home, privacy and terms are plain HTML that needs no sign-in", async () => {
    const ctx = await createTestContext({
      env: { SITE_OPERATOR: "Mehedi's <Academy>", CONTACT_EMAIL: "help@example.com" },
    });
    for (const path of ["/", "/privacy", "/terms"]) {
      const res = await ctx.app.request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain('href="/privacy"');
      expect(html).toContain("Mehedi&#39;s &lt;Academy&gt;");
    }
    const privacy = await (await ctx.app.request("/privacy")).text();
    expect(privacy).toContain("Limited Use");
    expect(privacy).toContain("mailto:help@example.com");
    // The signed-in API still asks for a token.
    expect((await ctx.app.request("/tasks")).status).toBe(401);
  });

  test("an empty CONTACT_EMAIL counts as unset", async () => {
    const ctx = await createTestContext({ env: { CONTACT_EMAIL: "" } });
    expect((await ctx.app.request("/privacy")).status).toBe(200);
  });
});
