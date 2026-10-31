import { describe, expect, test } from "bun:test";
import { friendlyError } from "../src/lib/error-copy";

const apiError = (status: number, code: string, message: string) =>
  Object.assign(new Error(message), { name: "ApiError", status, code, fromProxy: false });

describe("friendlyError", () => {
  test("a write to a deleted account asks for another one", () => {
    const error = apiError(400, "account_deleted", "That account was deleted. Pick another one.");
    expect(friendlyError(error, "save")).toBe("That account was deleted. Pick another one.");
  });
});
