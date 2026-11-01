import {
  accountCreateSchema,
  accountUpdateSchema,
  balanceCheckSchema,
  budgetLinePutSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  debtCreateSchema,
  debtRepaySchema,
  debtUpdateSchema,
  eventCreateSchema,
  eventUpdateSchema,
  goalContributeSchema,
  goalCreateSchema,
  goalUpdateSchema,
  recurringCreateSchema,
  recurringPaySchema,
  recurringUpdateSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import {
  areaCreateSchema,
  areaUpdateSchema,
  habitCreateSchema,
  habitUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  routineCreateSchema,
  routineUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  timeEntryCreateSchema,
  timeEntryUpdateSchema,
} from "@tick-taka/shared/schemas/time";
import type { z } from "zod";
import type { ActionName } from "./actions";
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

/** The body each PATCH route validates. Keys outside it are dropped there without a word. */
const UPDATE_SCHEMAS: Record<EntityName, z.ZodObject> = {
  task: taskUpdateSchema,
  project: projectUpdateSchema,
  area: areaUpdateSchema,
  habit: habitUpdateSchema,
  transaction: transactionUpdateSchema,
  account: accountUpdateSchema,
  category: categoryUpdateSchema,
  bill: recurringUpdateSchema,
  goal: goalUpdateSchema,
  debt: debtUpdateSchema,
  event: eventUpdateSchema,
  routine: routineUpdateSchema,
  time_entry: timeEntryUpdateSchema,
};

/** The body each money action's route validates. */
const ACTION_SCHEMAS: Partial<Record<ActionName, z.ZodType>> = {
  pay_bill: recurringPaySchema,
  contribute_goal: goalContributeSchema,
  repay_debt: debtRepaySchema,
  check_balance: balanceCheckSchema,
  set_budget: budgetLinePutSchema,
};

/** The model's name for an API field: amountMinor is amount, accountId is account. */
const friendly = (key: string) => key.replace(/(Minor|Id)$/, "");

const issuesOf = (error: z.ZodError) => [
  ...new Set(
    error.issues.map((issue) => `${friendly(issue.path.join(".")) || "fields"} (${issue.message})`),
  ),
];

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

/**
 * Why an update would change nothing or be refused, or null when it is fine. Only the
 * fields sent are checked, against the PATCH route's own schema: a field the route
 * can't change (a debt's principal) is named instead of being dropped quietly, and a
 * drafted change is valid before the user taps Save.
 */
export function updateProblem(entity: EntityName, fields: Record<string, unknown>): string | null {
  const schema = UPDATE_SCHEMAS[entity];
  const keys = Object.keys(fields);
  if (keys.length === 0) return "fields must name at least one field to change";
  const fixed = keys.filter((key) => !(key in schema.shape));
  if (fixed.length) {
    const editable = Object.keys(schema.shape)
      .filter((key) => !["updatedAt", "sort", "hasTime"].includes(key))
      .map(friendly);
    return `A ${entity.replace("_", " ")}'s ${fixed.map(friendly).join(", ")} can't be changed here. Fields you can change: ${editable.join(", ")}.`;
  }
  const result = schema.safeParse(fields);
  return result.success ? null : `Not changed: invalid ${issuesOf(result.error).join(", ")}.`;
}

/** Why a drafted money action would be refused on Save, or null when it would work. */
export function actionDraftProblem(
  action: ActionName,
  body: Record<string, unknown>,
): string | null {
  const result = ACTION_SCHEMAS[action]?.safeParse(body);
  if (!result || result.success) return null;
  return `Not drafted: missing or invalid ${issuesOf(result.error).join(", ")}.`;
}
