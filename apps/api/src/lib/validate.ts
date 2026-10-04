import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import { errorBody } from "./errors";

/** Zod validation for any request part, with failures in the standard error envelope. */
export const validate = <Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      const first = issues[0];
      const message = first
        ? `${first.path ? `${first.path}: ` : ""}${first.message}`
        : "Invalid request";
      return c.json(errorBody("validation_error", message, issues), 400);
    }
  });
