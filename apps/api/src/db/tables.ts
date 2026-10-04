import {
  accounts,
  budgets,
  categories,
  categoryRules,
  debts,
  events,
  goals,
  recurring,
  shoppingItems,
  smsImports,
  transactions,
} from "./schema/money";
import { aiUsage, settings } from "./schema/system";
import {
  areas,
  habitLogs,
  habits,
  projects,
  routineSteps,
  routines,
  tasks,
  timeEntries,
} from "./schema/time";

/** Tables the phone mirrors in its offline cache, keyed by their SQL name. */
export const SYNC_TABLES = {
  settings,
  areas,
  projects,
  tasks,
  time_entries: timeEntries,
  habits,
  habit_logs: habitLogs,
  routines,
  routine_steps: routineSteps,
  accounts,
  categories,
  transactions,
  budgets,
  recurring,
  goals,
  debts,
  events,
  shopping_items: shoppingItems,
  category_rules: categoryRules,
  sms_imports: smsImports,
} as const;

/** Every table, for the full JSON export. */
export const ALL_TABLES = { ...SYNC_TABLES, ai_usage: aiUsage } as const;

export type SyncTableName = keyof typeof SYNC_TABLES;
