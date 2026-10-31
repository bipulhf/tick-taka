import {
  Archive,
  ArrowUpDown,
  BarChart3,
  BookCheck,
  Bot,
  CalendarCheck,
  CalendarDays,
  CalendarFold,
  CalendarRange,
  CircleDashed,
  Clock,
  HandCoins,
  Inbox,
  Landmark,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Moon,
  PieChart,
  PiggyBank,
  Plane,
  Receipt,
  Repeat2,
  Sprout,
  Sun,
  Timer,
  Wallet,
} from "lucide-react";

export interface NavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Keyboard shortcut after G (G T for Today). */
  key?: string;
}

export interface NavSection extends NavLink {
  children: NavLink[];
}

/** The four places, as on the phone's tab bar, each with its views. */
export const NAV: NavSection[] = [
  { to: "/", label: "Today", icon: Sun, key: "t", children: [] },
  {
    to: "/plan",
    label: "Plan",
    icon: CalendarDays,
    key: "p",
    children: [
      { to: "/plan", label: "Inbox and upcoming", icon: Inbox, key: "i" },
      { to: "/plan/day", label: "Day", icon: Clock, key: "d" },
      { to: "/plan/week", label: "Week", icon: CalendarRange, key: "w" },
      { to: "/plan/calendar", label: "Calendar", icon: CalendarDays, key: "c" },
      { to: "/plan/someday", label: "Someday", icon: Archive },
      { to: "/plan/logbook", label: "Logbook", icon: BookCheck, key: "l" },
      { to: "/plan/habits", label: "Habits", icon: Repeat2, key: "h" },
      { to: "/plan/routines", label: "Routines", icon: ListChecks },
      { to: "/plan/time", label: "Time", icon: Timer },
      { to: "/plan/focus-stats", label: "Focus statistics", icon: Sprout },
    ],
  },
  {
    to: "/money",
    label: "Money",
    icon: Wallet,
    key: "m",
    children: [
      { to: "/money", label: "Overview", icon: Wallet },
      { to: "/money/transactions", label: "Transactions", icon: ArrowUpDown, key: "x" },
      { to: "/money/budgets", label: "Budgets", icon: PieChart, key: "b" },
      { to: "/money/bills", label: "Bills and income", icon: Receipt },
      { to: "/money/goals", label: "Goals", icon: PiggyBank },
      { to: "/money/debts", label: "Debts", icon: HandCoins },
      { to: "/money/events", label: "Events", icon: Plane },
      { to: "/money/calendar", label: "Spending calendar", icon: CalendarDays },
      { to: "/money/accounts", label: "Accounts", icon: Landmark, key: "a" },
    ],
  },
  {
    to: "/review",
    label: "Review",
    icon: CircleDashed,
    key: "r",
    children: [
      { to: "/review", label: "Overview", icon: CircleDashed },
      { to: "/review/shutdown", label: "Shutdown", icon: Moon, key: "s" },
      { to: "/review/weekly", label: "Weekly", icon: CalendarCheck },
      { to: "/review/monthly", label: "Monthly", icon: CalendarFold },
      { to: "/review/reports", label: "Reports", icon: BarChart3 },
      { to: "/review/areas", label: "Areas", icon: LayoutGrid },
      { to: "/review/ai-usage", label: "AI usage", icon: Bot },
    ],
  },
];

/** The section a path belongs to: "/money/budgets" is in Money. */
export function sectionOf(pathname: string): NavSection {
  const path = pathname.replace(/^\/app/, "") || "/";
  return (
    NAV.find((section) => section.to !== "/" && path.startsWith(section.to)) ??
    (NAV[0] as NavSection)
  );
}

/** The app tour's name for a place's link, the same in the sidebar and the tab bar. */
export const tourId = (to: string) => `nav-${to.replace(/^\//, "") || "today"}`;
