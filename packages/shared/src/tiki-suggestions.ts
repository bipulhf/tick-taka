/**
 * Prompts to offer in Tiki's chat, picked for the screen and the moment: what is
 * overdue, the time of day, what the user is looking at. Short enough for a chip,
 * in Bangla and English like the user writes.
 */

export interface SuggestionInput {
  /** The route the chat was opened from, e.g. "/money/transactions" or "/" for Today. */
  view: string;
  /** Local hour 0–23 */
  hour: number;
  /** Open tasks whose day has passed. */
  overdue: number;
  /** Tasks waiting in the inbox. */
  inbox: number;
  /** Today's top three not done yet. */
  topThreeLeft: number;
  /** Bills due today or in the next few days. */
  billsDueSoon: number;
  hasAccounts: boolean;
  hasBudgets: boolean;
}

/** Most chips shown at once. */
const MAX = 4;

/** Always good to offer, used to fill the row. */
const GENERAL = [
  "আজ কী কী কাজ আছে?",
  "Spent 120 on rickshaw from cash",
  "How much did I spend on food this month?",
  "Add a habit: 8 glasses of water a day",
];

type Area = "today" | "plan" | "habits" | "money" | "budgets" | "review" | "other";

function areaOf(view: string): Area {
  const path = view.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  const parts = path.split("/").filter((part) => part && !part.startsWith("("));
  const [first, second] = parts;
  if (!first || first === "today" || first === "index") return "today";
  if (first === "money") return second === "budgets" ? "budgets" : "money";
  if (first === "plan") return second === "habits" ? "habits" : "plan";
  if (first === "habits") return "habits";
  if (first === "review") return "review";
  return "other";
}

const isEvening = (hour: number) => hour >= 18 && hour < 23;
const isMorning = (hour: number) => hour >= 5 && hour < 12;

/** Up to four short prompts for the chat's empty state and under the briefing. */
export function suggestionsFor(input: SuggestionInput): string[] {
  const area = areaOf(input.view);
  const picked: string[] = [];
  const add = (text: string | false) => {
    if (text && !picked.includes(text) && picked.length < MAX) picked.push(text);
  };

  // An empty account first: nothing else works well until there is somewhere to put money.
  add(!input.hasAccounts && "Help me set up my accounts");
  add(input.overdue > 0 && "পুরোনো কাজগুলো আজকে সরিয়ে দাও");

  if (area === "money" || area === "budgets") {
    add("এই মাসে কোথায় সবচেয়ে বেশি খরচ হলো?");
    add(input.hasBudgets ? "How much can I spend today?" : "Help me set a budget for this month");
    add(input.billsDueSoon > 0 && "Which bills are due this week?");
    add("Spent 120 on rickshaw from cash");
  } else if (area === "habits") {
    add("Which habits are left today?");
    add("Add a habit: 8 glasses of water a day");
  } else if (area === "review") {
    add("How did my week go?");
    add("How much did I spend this week?");
  } else {
    add(isEvening(input.hour) && "Close my day");
    add(isMorning(input.hour) && input.topThreeLeft > 0 && "What should I do first?");
    add(input.inbox > 0 && "Help me sort my inbox");
    add(input.billsDueSoon > 0 && "Which bills are due this week?");
  }

  add(isEvening(input.hour) && "Close my day");
  add(
    input.hasAccounts &&
      !input.hasBudgets &&
      area !== "plan" &&
      "Help me set a budget for this month",
  );
  for (const text of GENERAL) add(text);
  return picked;
}
