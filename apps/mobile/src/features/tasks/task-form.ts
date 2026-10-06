/** The task sheet's form: its fields and the blank state a new task starts from. */

export type Priority = "low" | "normal" | "high";
export type WhenChoice = "today" | "evening" | "tomorrow" | "pick" | "someday" | "none";
export const ESTIMATES = [15, 30, 60, 90, 120, 180];

export interface Form {
  title: string;
  notes: string;
  areaId: string | null;
  projectId: string | null;
  doAt: number | null;
  hasTime: boolean;
  whenSlot: "day" | "evening";
  status: "inbox" | "open" | "someday" | "done";
  deadlineAt: number | null;
  priority: Priority;
  energy: "high" | "low" | null;
  estimateMin: number | null;
  urgent: boolean;
  rrule: string | null;
  top3Date: string | null;
}

export const EMPTY: Form = {
  title: "",
  notes: "",
  areaId: null,
  projectId: null,
  doAt: null,
  hasTime: false,
  whenSlot: "day",
  status: "inbox",
  deadlineAt: null,
  priority: "normal",
  energy: null,
  estimateMin: null,
  urgent: false,
  rrule: null,
  top3Date: null,
};
