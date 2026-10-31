/**
 * Out-of-the-box data so day one needs no setup. The server seeds one of two sets on
 * first start: the owner's (his jobs, teaching and research) or a neutral one for
 * everyone else. The quick-add parser uses the keywords of both.
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

/** Every expense category, and the income everyone has. */
const SHARED_CATEGORIES: DefaultCategory[] = [
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
      "চা",
      "কফি",
      "নাস্তা",
      "খাবার",
      "দুপুরের খাবার",
      "রাতের খাবার",
      "বিরিয়ানি",
      "ফুচকা",
      "সিঙ্গারা",
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
          "বাজার",
          "মাছ",
          "মাংস",
          "চাল",
          "ডিম",
          "দুধ",
          "সবজি",
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
      "রিকশা",
      "রিক্সা",
      "বাস",
      "সিএনজি",
      "উবার",
      "পাঠাও",
      "মেট্রো",
      "ট্রেন",
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
    keywords: ["medicine", "doctor", "pharmacy", "hospital", "clinic", "test", "ওষুধ", "ডাক্তার"],
  },
  {
    name: "Rent",
    emoji: "🏠",
    kind: "expense",
    budgetType: "fixed",
    keywords: ["rent", "house rent", "বাসা ভাড়া", "বাড়ি ভাড়া"],
  },
  {
    name: "Bills",
    emoji: "🧾",
    kind: "expense",
    budgetType: "fixed",
    keywords: [
      "bill",
      "internet",
      "wifi",
      "electricity",
      "gas",
      "water",
      "recharge",
      "mobile",
      "বিল",
      "বিদ্যুৎ",
      "রিচার্জ",
    ],
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
    keywords: ["gift", "wedding", "eid", "salami", "donation", "zakat", "উপহার", "সালামি"],
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
    keywords: ["salary", "payroll", "wage", "wages", "বেতন"],
  },
  {
    name: "Freelance",
    emoji: "💻",
    kind: "income",
    budgetType: "flexible",
    keywords: ["freelance", "client", "upwork", "fiverr", "invoice", "project"],
  },
];

const OTHER_INCOME: DefaultCategory = {
  name: "Other income",
  emoji: "✨",
  kind: "income",
  budgetType: "flexible",
  keywords: ["refund", "bonus", "cashback", "interest", "received"],
};

const OWNER_CATEGORIES: DefaultCategory[] = [
  ...SHARED_CATEGORIES,
  {
    name: "Teaching income",
    emoji: "🎓",
    kind: "income",
    budgetType: "flexible",
    keywords: ["tuition fee", "teaching", "honorarium"],
  },
  OTHER_INCOME,
];

const NEUTRAL_CATEGORIES: DefaultCategory[] = [
  ...SHARED_CATEGORIES,
  {
    name: "Side income",
    emoji: "🪙",
    kind: "income",
    budgetType: "flexible",
    keywords: ["side income", "tuition fee", "honorarium", "commission"],
  },
  OTHER_INCOME,
];

export interface DefaultArea {
  name: string;
  emoji: string;
  color: string;
  keywords: string[];
}

const HOME: DefaultArea = {
  name: "Home",
  emoji: "🏡",
  color: "#FF7A6B",
  keywords: ["home", "bazar", "cleaning", "laundry", "repair", "cook"],
};

const PERSONAL: DefaultArea = {
  name: "Personal",
  emoji: "🌱",
  color: "#A57BFF",
  keywords: ["gym", "workout", "read", "reading", "doctor", "call"],
};

const OWNER_AREAS: DefaultArea[] = [
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
  HOME,
  PERSONAL,
];

const NEUTRAL_AREAS: DefaultArea[] = [
  {
    name: "Work",
    emoji: "💼",
    color: "#5B8CFF",
    keywords: ["work", "office", "meeting", "standup", "sprint", "deadline"],
  },
  {
    name: "Study",
    emoji: "📚",
    color: "#FFB547",
    keywords: ["study", "class", "lecture", "exam", "assignment", "homework", "course", "quiz"],
  },
  HOME,
  PERSONAL,
];

export interface DefaultRoutine {
  name: string;
  emoji: string;
  steps: { title: string; minutes: number | null }[];
}

/**
 * One routine to start from. Today already asks for the top three, and Review's
 * daily shutdown covers the evening, so neither is repeated here.
 */
export const DEFAULT_ROUTINES: DefaultRoutine[] = [
  {
    name: "Morning",
    emoji: "🌅",
    steps: [
      { title: "Drink a glass of water", minutes: null },
      { title: "Stretch", minutes: 5 },
      { title: "Check bills due today", minutes: null },
    ],
  },
];

/** What a new database is seeded with. */
export interface DefaultSet {
  areas: DefaultArea[];
  categories: DefaultCategory[];
}

/** The owner's (OWNER_EMAIL) seed: his two jobs, teaching and research. */
export const OWNER_DEFAULTS: DefaultSet = { areas: OWNER_AREAS, categories: OWNER_CATEGORIES };

/** Everyone else's: Work, Study, Home, Personal, and side income instead of teaching. */
export const NEUTRAL_DEFAULTS: DefaultSet = {
  areas: NEUTRAL_AREAS,
  categories: NEUTRAL_CATEGORIES,
};

/** The lists joined, keeping the first of each name. */
const byName = <T extends { name: string }>(...lists: T[][]): T[] => {
  const all = lists.flat();
  return all.filter((item, i) => all.findIndex((other) => other.name === item.name) === i);
};

/**
 * Every default category and area, the owner's first, for keyword guessing: a guess
 * only counts when the user has a category or area of that name.
 */
export const KEYWORD_CATEGORIES: DefaultCategory[] = byName(OWNER_CATEGORIES, NEUTRAL_CATEGORIES);
export const KEYWORD_AREAS: DefaultArea[] = byName(OWNER_AREAS, NEUTRAL_AREAS);
