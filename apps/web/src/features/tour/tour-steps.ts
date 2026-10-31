import type { TikiMood } from "@tick-taka/shared/tiki";

/**
 * The first-visit tour: Tiki points at one part of the screen at a time. `target`
 * names a `data-tour` attribute; a step whose target isn't on screen (no AI chat) is
 * skipped. Settings is the sidebar's, or Today's header button at phone width. Pure,
 * so it can be tested.
 */
export interface TourStep {
  id: string;
  target: string | null;
  /** Today's sections may still be loading: wait a moment for them before skipping. */
  waits?: boolean;
  title: string;
  body: string;
  mood: TikiMood;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Hi, I'm Tiki!",
    body: "Tick & Taka keeps your day and your money in one place. Let me show you around. It takes about a minute.",
    mood: "cheering",
  },
  {
    id: "quick-add",
    target: "quick-add",
    title: "Add anything, fast",
    body: "Type the way you talk: “cha 20”, “2h thesis”, “call bank tomorrow 5pm”. I work out whether it's a task, an expense or time worked. Press N from anywhere to jump here.",
    mood: "happy",
  },
  {
    id: "top-three",
    target: "top-three",
    waits: true,
    title: "Your top three",
    body: "Pick the three things that matter most today. Tick them off as you go, and finishing all three gets a little celebration.",
    mood: "focused",
  },
  {
    id: "safe-to-spend",
    target: "safe-to-spend",
    waits: true,
    title: "Safe to spend today",
    body: "One number for the shop counter: how much you can spend today and still stay on budget. It moves the moment you log an expense.",
    mood: "proud",
  },
  {
    id: "plan",
    target: "nav-plan",
    title: "Plan",
    body: "Your inbox, day, week and calendar. Drag tasks onto days and hours. Habits, routines and time tracking live here too.",
    mood: "focused",
  },
  {
    id: "money",
    target: "nav-money",
    title: "Money",
    body: "Accounts, transactions, budgets, bills, savings goals and who owes whom. Every taka in one place.",
    mood: "happy",
  },
  {
    id: "review",
    target: "nav-review",
    title: "Review",
    body: "A two-minute shutdown each evening, weekly and monthly reviews, and reports on where your time and money went.",
    mood: "relaxed",
  },
  {
    id: "tiki",
    target: "tiki",
    title: "Ask me anything",
    body: "Chat with me in Bangla or English: “how much did I spend on food?” or “move today's leftovers to tomorrow”. Ctrl J opens me too.",
    mood: "curious",
  },
  {
    id: "tools",
    target: "top-tools",
    title: "Handy switches",
    body: "Hide amounts when someone's looking over your shoulder, switch between light and dark, and search everything with Ctrl K.",
    mood: "happy",
  },
  {
    id: "settings",
    target: "nav-settings",
    title: "Make it yours",
    body: "Your daily goal, workdays, accounts, reminders and more. You can replay this tour from Settings › General.",
    mood: "relaxed",
  },
  {
    id: "done",
    target: null,
    title: "You're all set",
    body: "Start small: add one thing in the box at the top. Press ? any time to see every keyboard shortcut.",
    mood: "proud",
  },
];

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGIN = 12;
const GAP = 14;

/**
 * Where the step's card goes: under the highlighted part when it fits, else above,
 * else beside it; kept inside the window. With nothing highlighted, centred.
 */
export function placeCard(
  target: Box | null,
  card: { width: number; height: number },
  view: { width: number; height: number },
): { top: number; left: number } {
  const clampLeft = (left: number) =>
    Math.min(Math.max(MARGIN, left), Math.max(MARGIN, view.width - card.width - MARGIN));
  const clampTop = (top: number) =>
    Math.min(Math.max(MARGIN, top), Math.max(MARGIN, view.height - card.height - MARGIN));
  if (!target)
    return {
      top: clampTop((view.height - card.height) / 2),
      left: clampLeft((view.width - card.width) / 2),
    };
  const centredLeft = clampLeft(target.left + target.width / 2 - card.width / 2);
  const below = target.top + target.height + GAP;
  if (below + card.height <= view.height - MARGIN) return { top: below, left: centredLeft };
  const above = target.top - GAP - card.height;
  if (above >= MARGIN) return { top: above, left: centredLeft };
  const right = target.left + target.width + GAP;
  const middleTop = clampTop(target.top + target.height / 2 - card.height / 2);
  if (right + card.width <= view.width - MARGIN) return { top: middleTop, left: right };
  return { top: middleTop, left: clampLeft(target.left - GAP - card.width) };
}
