/**
 * Each home-screen widget's name, as registered in app.json's react-native-android-widget
 * plugin (test/widget-registry.test.ts keeps the two in step). "SafeToSpend" is the
 * name of the one widget older builds had, a 4×2 "today at a glance": it now draws the
 * Today widget, so a widget already on someone's home screen keeps working.
 */
export const WIDGET_NAMES = {
  today: "SafeToSpend",
  quickLog: "QuickLog",
  spend: "SafeSpend",
  habits: "Habits",
  bills: "Bills",
  focus: "Focus",
  month: "ThisMonth",
  tasks: "Tasks",
} as const;

export type WidgetName = (typeof WIDGET_NAMES)[keyof typeof WIDGET_NAMES];
