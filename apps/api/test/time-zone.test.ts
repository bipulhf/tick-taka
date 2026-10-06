import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { readSettings } from "../src/modules/settings/service";
import { createTestContext } from "./helpers";

/** Writes a raw settings row, the way an older build (before validation) could have. */
function storeRaw(db: Parameters<typeof readSettings>[0], key: string, value: unknown) {
  db.run(
    sql`INSERT INTO settings (key, value, created_at, updated_at) VALUES (${key}, ${JSON.stringify(value)}, 0, 0)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

describe("time zone setting", () => {
  test("PATCH /settings refuses a zone the clock can't use", async () => {
    const { request } = await createTestContext();
    const bad = await request<{ error: { code: string } }>("PATCH", "/settings", {
      timeZone: "Not/AZone",
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_error");
    const city = await request("PATCH", "/settings", { timeZone: "Dhaka" });
    expect(city.status).toBe(400);
    const good = await request<{ timeZone: string }>("PATCH", "/settings", {
      timeZone: "Europe/London",
    });
    expect(good.status).toBe(200);
    expect(good.body.timeZone).toBe("Europe/London");
  });

  test("a bad zone already stored falls back to the default instead of breaking reads", async () => {
    const { deps, request } = await createTestContext();
    storeRaw(deps.db, "timeZone", "Not/AZone");
    expect(readSettings(deps.db).timeZone).toBe("Asia/Dhaka");
    const today = await request("GET", "/today");
    expect(today.status).toBe(200);
    const settings = await request<{ timeZone: string }>("GET", "/settings");
    expect(settings.body.timeZone).toBe("Asia/Dhaka");
  });
});
