import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FocusStats } from "@/features/time/focus-stats";
import { TimeTracking } from "@/features/time/time-tracking";
import type { TimeView } from "@/features/time/time-view";

export default function TimeRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [shown, setShown] = useState<TimeView>(view === "focus" ? "focus" : "all");
  return shown === "focus" ? <FocusStats onView={setShown} /> : <TimeTracking onView={setShown} />;
}
