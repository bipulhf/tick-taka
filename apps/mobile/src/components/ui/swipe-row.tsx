import { type ReactNode, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { haptic } from "@/lib/haptics";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

const THRESHOLD = 80;
const ACTION_WIDTH = 76;
const SPRING = { damping: 20, stiffness: 220 };

export interface SwipeAction {
  icon: IconName;
  /** Background class, e.g. "bg-mint" */
  className: string;
  onTrigger: () => void;
}

/** A button in the tray that a left swipe reveals. */
export interface RowAction {
  label: string;
  icon: IconName;
  tone: "coral" | "sky" | "grape" | "mango" | "muted";
  onPress: () => void;
}

/** Tray fills with their text colour: dark on semantic fills, inverted ink for neutral. */
const TONES: Record<RowAction["tone"], { box: string; text: "onAccent" | "background" }> = {
  coral: { box: "bg-coral", text: "onAccent" },
  sky: { box: "bg-sky", text: "onAccent" },
  grape: { box: "bg-grape", text: "onAccent" },
  mango: { box: "bg-mango", text: "onAccent" },
  muted: { box: "bg-ink", text: "background" },
};

/** Only one row's tray is open at a time; opening another closes this one. */
let closeOpenRow: (() => void) | null = null;

/**
 * Swipe right to complete or check off; swipe left to reveal the row's actions
 * (edit, delete, ...), which stay open until one is tapped or the row is tapped.
 * Screen readers get the same actions from the accessibility actions menu.
 */
export function SwipeRow({
  children,
  right,
  actions = [],
  rounded = true,
}: {
  children: ReactNode;
  right?: SwipeAction;
  actions?: RowAction[];
  /** Off inside a Group, which provides the rounding. */
  rounded?: boolean;
}) {
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const tray = actions.length * ACTION_WIDTH;

  const close = useCallback(() => {
    x.value = withSpring(0, SPRING);
    setOpen(false);
    if (closeOpenRow === close) closeOpenRow = null;
  }, [x]);
  const opened = () => {
    if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
    closeOpenRow = close;
    setOpen(true);
    haptic.select();
  };
  const trigger = (action: SwipeAction | undefined) => {
    if (!action) return;
    haptic.tap();
    action.onTrigger();
  };
  const run = (action: RowAction) => {
    close();
    action.onPress();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onStart(() => {
      start.value = x.value;
    })
    .onUpdate((event) => {
      const next = start.value + event.translationX;
      const max = right && start.value === 0 ? 140 : 0;
      // A little give past the tray, so the end of the swipe feels soft.
      x.value = Math.min(max, Math.max(next, -tray - 24));
    })
    .onEnd(() => {
      if (x.value > THRESHOLD) {
        runOnJS(trigger)(right);
        x.value = withSpring(0, SPRING);
      } else if (tray > 0 && x.value < -Math.min(THRESHOLD, tray / 2)) {
        x.value = withSpring(-tray, SPRING);
        runOnJS(opened)();
      } else {
        x.value = withSpring(0, SPRING);
        runOnJS(close)();
      }
    });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const rightHint = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, THRESHOLD], [0, 1]),
  }));
  const trayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-24, 0], [1, 0]),
  }));

  return (
    <View className={`overflow-hidden ${rounded ? "rounded-2xl" : ""}`}>
      {right ? (
        <Animated.View
          style={rightHint}
          className={`absolute inset-0 justify-center pl-5 ${right.className}`}
        >
          <Icon name={right.icon} color="onAccent" />
        </Animated.View>
      ) : null}
      {actions.length ? (
        <Animated.View
          style={[trayStyle, { width: tray }]}
          className="absolute inset-y-0 right-0 flex-row"
        >
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => run(action)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              className={`items-center justify-center gap-1 active:opacity-80 ${TONES[action.tone].box}`}
              style={{ width: ACTION_WIDTH }}
            >
              <Icon name={action.icon} color={TONES[action.tone].text} size={22} />
              <Text variant="caption" tone={TONES[action.tone].text}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={rowStyle}
          accessibilityActions={actions.map((action) => ({
            name: action.label,
            label: action.label,
          }))}
          onAccessibilityAction={(event) =>
            actions.find((action) => action.label === event.nativeEvent.actionName)?.onPress()
          }
        >
          {children}
          {/* While the tray is open, a tap on the row closes it instead of opening the row. */}
          {open ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityLabel="Close actions"
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Swipe-left actions for a record, in the usual order: edit first, delete last. */
export function editDelete(onEdit: (() => void) | null, onDelete: () => void): RowAction[] {
  return [
    ...(onEdit
      ? [{ label: "Edit", icon: "pencil-outline", tone: "sky", onPress: onEdit } as const]
      : []),
    { label: "Delete", icon: "trash-can-outline", tone: "coral", onPress: onDelete },
  ];
}
