import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef } from "react";
import { View, type ViewProps } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { haptic } from "@/lib/haptics";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragContextValue {
  register(id: string, view: View | null): void;
  measureAll(): void;
  drop(itemId: string, x: number, y: number): void;
}

const DragContext = createContext<DragContextValue | null>(null);

/**
 * Drag-and-drop between drop zones (days, quadrants, time slots). Long-press an item
 * to pick it up; letting go over a zone calls `onDrop(itemId, zoneId, point)`.
 */
export function DragProvider({
  children,
  onDrop,
}: {
  children: ReactNode;
  onDrop: (itemId: string, zoneId: string, point: { y: number; zone: Rect }) => void;
}) {
  const views = useRef(new Map<string, View>());
  const rects = useRef(new Map<string, Rect>());

  const measureAll = useCallback(() => {
    for (const [id, view] of views.current) {
      view.measureInWindow((x, y, width, height) => rects.current.set(id, { x, y, width, height }));
    }
  }, []);

  const value = useMemo<DragContextValue>(
    () => ({
      register(id, view) {
        if (view) views.current.set(id, view);
        else {
          views.current.delete(id);
          rects.current.delete(id);
        }
      },
      measureAll,
      drop(itemId, x, y) {
        for (const [zoneId, rect] of rects.current) {
          if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
            haptic.success();
            onDrop(itemId, zoneId, { y: y - rect.y, zone: rect });
            return;
          }
        }
      },
    }),
    [measureAll, onDrop],
  );
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function DropZone({
  id,
  children,
  ...props
}: ViewProps & { id: string; className?: string }) {
  const context = useContext(DragContext);
  return (
    <View ref={(view) => context?.register(id, view)} collapsable={false} {...props}>
      {children}
    </View>
  );
}

export function Draggable({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(DragContext);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const start = () => {
    haptic.tap();
    context?.measureAll();
  };
  const end = (absoluteX: number, absoluteY: number) => context?.drop(id, absoluteX, absoluteY);
  const pan = Gesture.Pan()
    .activateAfterLongPress(280)
    .onStart(() => {
      lifted.value = withSpring(1);
      runOnJS(start)();
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(end)(event.absoluteX, event.absoluteY);
    })
    .onFinalize(() => {
      x.value = withSpring(0);
      y.value = withSpring(0);
      lifted.value = withSpring(0);
    });
  const style = useAnimatedStyle(() => ({
    zIndex: lifted.value > 0 ? 100 : 0,
    elevation: lifted.value * 8,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: 1 + lifted.value * 0.04 },
    ],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
