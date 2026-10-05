/**
 * Out-of-the-box data so day one needs no setup beyond adding accounts.
 * The server seeds these on first start; the quick-add parser uses the keywords.
 */

export type BudgetType = "fixed" | "non_monthly" | "flexible";
export type CategoryKind = "expense" | "income";

export interface DefaultCategory {
  name: string;
  emoji: string;
  kind: CategoryKind;
  budgetType: BudgetType;
  keywords: string[];
  children?: Omit<DefaultCategory, "children" | "kind" | "budgetType">[];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Food",
    emoji: "🍛",
    kind: "expense",
    budgetType: "flexible",
    keywords: [
      "lunch",
      "dinner",
      "breakfast",
      "food",
      "snack",
      "snacks",
      "cha",
      "tea",
      "coffee",
      "biryani",
      "fuchka",
      "singara",
      "meal",
    ],
    children: [
      {
        name: "Eating out",
        emoji: "🍽️",
        keywords: ["restaurant", "foodpanda", "pizza", "burger", "kfc", "cafe"],
      },
      {
        name: "Groceries",
        emoji: "🛒",
        keywords: [
          "bazar",
          "grocery",
          "groceries",
          "vegetables",
          "fish",
          "meat",
          "rice",
          "egg",
          "eggs",
          "milk",
        ],
      },
    ],
  },
  {
    name: "Transport",
    emoji: "🛺",
    kind: "expense",
    budgetType: "flexible",
    keywords: [
      "rickshaw",
      "cng",
      "bus",
      "uber",
      "pathao",
      "taxi",
      "fuel",
      "petrol",
      "metro",
      "train",
      "launch",
      "fare",
      "bike",
    ],
  },
  {
    name: "Shopping",
    emoji: "🛍️",
    kind: "expense",
    budgetType: "flexible",
    keywords: ["shopping", "clothes", "shoes", "daraz", "gadget"],
  },
  {
    name: "Fun",
    emoji: "🎉",
    kind: "expense",
    budgetType: "flexible",
    keywords: ["movie", "cinema", "game", "games", "outing", "fun", "concert"],
  },
  {
    name: "Health",
    emoji: "💊",
    kind: "expense",
    budgetType: "flexible",
    keywords: ["medicine", "doctor", "pharmacy", "hospital", "clinic", "test"],
  },
  {
    name: "Rent",
    emoji: "🏠",
    kind: "expense",
    budgetType: "fixed",
    keywords: ["rent", "house rent"],
  },
  {
    name: "Bills",
    emoji: "🧾",
    kind: "expense",
    budgetType: "fixed",
    keywords: ["bill", "internet", "wifi", "electricity", "gas", "water", "recharge", "mobile"],
  },
  {
    name: "Family",
    emoji: "👪",
    kind: "expense",
    budgetType: "fixed",
    keywords: ["family", "parents", "ammu", "abbu"],
  },
  {
    name: "Education",
    emoji: "📚",
    kind: "expense",
    budgetType: "non_monthly",
    keywords: ["book", "books", "course", "tuition", "fees"],
  },
  {
    name: "Gifts",
    emoji: "🎁",
    kind: "expense",
    budgetType: "non_monthly",
    keywords: ["gift", "wedding", "eid", "salami", "donation", "zakat"],
  },
  {
    name: "Subscriptions",
    emoji: "🔁",
    kind: "expense",
    budgetType: "non_monthly",
    keywords: [
      "subscription",
      "netflix",
      "spotify",
      "domain",
      "hosting",
      "vps",
      "chatgpt",
      "youtube",
    ],
  },
  {
    name: "Fees & charges",
    emoji: "🏦",
    kind: "expense",
    budgetType: "flexible",
    keywords: ["fee", "charge", "cashout", "cash out"],
  },
  {
    name: "Other",
    emoji: "📦",
    kind: "expense",
    budgetType: "flexible",
    keywords: [],
  },
  {
    name: "Salary",
    emoji: "💼",
    kind: "income",
    budgetType: "flexible",
    keywords: ["salary", "payroll", "wage", "wages"],
  },
  {
    name: "Freelance",
    emoji: "💻",
    kind: "income",
    budgetType: "flexible",
    keywords: ["freelance", "client", "upwork", "fiverr", "invoice", "project"],
  },
  {
    name: "Teaching income",
    emoji: "🎓",
    kind: "income",
    budgetType: "flexible",
    keywords: ["tuition fee", "teaching", "honorarium"],
  },
  {
    name: "Other income",
    emoji: "✨",
    kind: "income",
    budgetType: "flexible",
    keywords: ["refund", "bonus", "cashback", "interest", "received"],
  },
];

export interface DefaultArea {
  name: string;
  emoji: string;
  color: string;
  keywords: string[];
}

export const DEFAULT_AREAS: DefaultArea[] = [
  {
    name: "Job 1",
    emoji: "💼",
    color: "#5B8CFF",
    keywords: ["job1", "standup", "sprint", "ticket", "pr", "deploy"],
  },
  { name: "Job 2", emoji: "🧑‍💻", color: "#7A6BFF", keywords: ["job2"] },
  {
    name: "Teaching",
    emoji: "🎓",
    color: "#FFB547",
    keywords: ["class", "lecture", "students", "exam", "grading", "quiz", "lab", "course"],
  },
  {
    name: "Research",
    emoji: "🔬",
    color: "#2EC4A0",
    keywords: ["thesis", "paper", "research", "experiment", "dataset", "literature", "revision"],
  },
  {
    name: "Home",
    emoji: "🏡",
    color: "#FF7A6B",
    keywords: ["home", "bazar", "cleaning", "laundry", "repair", "cook"],
  },
  {
    name: "Personal",
    emoji: "🌱",
    color: "#A57BFF",
    keywords: ["gym", "workout", "read", "reading", "doctor", "call"],
  },
];

export interface DefaultRoutine {
  name: string;
  emoji: string;
  steps: { title: string; minutes: number | null }[];
}

export const DEFAULT_ROUTINES: DefaultRoutine[] = [
  {
    name: "Morning",
    emoji: "🌅",
    steps: [
      { title: "Drink a glass of water", minutes: null },
      { title: "Stretch", minutes: 5 },
      { title: "Pick today's top three", minutes: 2 },
      { title: "Check bills due today", minutes: null },
    ],
  },
  {
    name: "Shutdown",
    emoji: "🌙",
    steps: [
      { title: "Log missed spending", minutes: 1 },
      { title: "Check off habits", minutes: null },
      { title: "Pick tomorrow's top three", minutes: 1 },
    ],
  },
];
