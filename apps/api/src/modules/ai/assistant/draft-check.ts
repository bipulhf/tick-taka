import {
  accountCreateSchema,
  categoryCreateSchema,
  debtCreateSchema,
  eventCreateSchema,
  goalCreateSchema,
  recurringCreateSchema,
  transactionCreateSchema,
} from "@tick-taka/shared/schemas/money";
import {
  areaCreateSchema,
  habitCreateSchema,
  projectCreateSchema,
  routineCreateSchema,
  taskCreateSchema,
  timeEntryCreateSchema,
} from "@tick-taka/shared/schemas/time";
import type { z } from "zod";
import type { EntityName } from "./entities";

/** The body each create route validates, so a draft can be checked before the user sees it. */
const CREATE_SCHEMAS: Record<EntityName, z.ZodType> = {
  task: taskCreateSchema,
  project: projectCreateSchema,
  area: areaCreateSchema,
  habit: habitCreateSchema,
  transaction: transactionCreateSchema,
  account: accountCreateSchema,
  category: categoryCreateSchema,
  bill: recurringCreateSchema,
  goal: goalCreateSchema,
  debt: debtCreateSchema,
  event: eventCreateSchema,
  routine: routineCreateSchema,
  time_entry: timeEntryCreateSchema,
};

/**
 * Why a drafted create would be refused once the user taps Save, or null when it is
 * complete. A draft is only shown when saving it can work: a missing name or type goes
 * back to the model, which then asks the user for it.
 */
export function draftProblem(entity: EntityName, body: Record<string, unknown>): string | null {
  const result = CREATE_SCHEMAS[entity].safeParse(body);
  if (result.success) return null;
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "fields"))];
  return `Not drafted: missing or invalid ${fields.join(", ")}. Ask the user for what only they can give with the ask tool (prefill what they said), then create it.`;
}
