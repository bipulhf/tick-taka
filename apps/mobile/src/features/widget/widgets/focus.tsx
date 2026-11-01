// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget } from "react-native-android-widget";
import { focusShare, focusTask, focusUntil } from "../widget-model";
import { Pill, Ring, Shell, Words } from "./parts";
import type { WidgetProps } from "./types";

/**
 * Focus (2×2): what's being focused on, a ring, and Start (Settings › Focus length)
 * or Stop. While running it shows when it ends ("until 3:45 pm"): a widget can't tick
 * every second without draining the battery.
 */
export function FocusWidget({ cache, c, now }: WidgetProps) {
  const running = cache.focus && cache.focus.endsAt > now ? cache.focus : null;
  const title = running ? running.title : (focusTask(cache.tasks)?.title ?? null);
  return (
    <Shell c={c} uri="ticktaka://focus" label="Focus" padding={14}>
      <Words
        text={cache.status ?? (title ? `Focus · ${title}` : "Focus")}
        color={c.muted}
        bold
        align="center"
      />
      <FlexWidget
        style={{
          flex: 1,
          width: "match_parent",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGap: 4,
        }}
      >
        <Ring
          size={54}
          share={running ? focusShare(running, now) : 0}
          track={c.track}
          arc={c.check}
          emoji="🌱"
        />
        <Words
          text={running ? focusUntil(running.endsAt, cache.timeZone) : `${cache.focusMinutes} min`}
          color={c.timeText}
          bold
          align="center"
        />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
        {running ? (
          <Pill
            label="■ Stop"
            c={c}
            flex={1}
            clickAction="FOCUS_STOP"
            accessibilityLabel="Stop focusing"
          />
        ) : (
          <Pill
            label="▶ Start"
            c={c}
            tone="primary"
            flex={1}
            clickAction="FOCUS_START"
            accessibilityLabel={`Start ${cache.focusMinutes} minutes of focus${title ? ` on ${title}` : ""}`}
          />
        )}
      </FlexWidget>
    </Shell>
  );
}
