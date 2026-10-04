import { useEffect } from "react";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Ellipse, G, Path, Rect } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);
const LEAF = "#2EC4A0";
const LEAF_DARK = "#1E9E80";
const LEAF_SLOTS = [0, 1, 2, 3, 4];

/**
 * Tiki's plant grows while I focus. Leaving the app makes it droop; it never dies.
 * `growth` is 0–1, `drooping` tilts the leaves down.
 */
export function Plant({
  growth,
  drooping,
  size = 220,
}: {
  growth: number;
  drooping: boolean;
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  const droop = useSharedValue(drooping ? 1 : 0);
  useEffect(() => {
    droop.value = reduceMotion ? (drooping ? 1 : 0) : withSpring(drooping ? 1 : 0, { damping: 12 });
  }, [drooping, droop, reduceMotion]);
  const stem = 20 + growth * 90;
  const top = 170 - stem;
  const leaves = Math.min(5, Math.floor(growth * 6));
  const leftLeaf = useAnimatedProps(() => ({ rotation: -droop.value * 55 }));
  const rightLeaf = useAnimatedProps(() => ({ rotation: droop.value * 55 }));
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 200 220"
      accessibilityLabel={
        drooping ? "The plant is drooping" : `The plant is ${Math.round(growth * 100)}% grown`
      }
    >
      <Path
        d={`M100 172 Q${drooping ? 112 : 100} ${172 - stem / 2} 100 ${top}`}
        stroke={LEAF_DARK}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      {LEAF_SLOTS.slice(0, leaves).map((i) => {
        const y = 165 - (i + 1) * (stem / (leaves + 1));
        const left = i % 2 === 0;
        return (
          <AnimatedG key={i} animatedProps={left ? leftLeaf : rightLeaf} originX={100} originY={y}>
            <Ellipse
              cx={left ? 82 : 118}
              cy={y}
              rx={18}
              ry={8}
              fill={i === leaves - 1 ? LEAF : LEAF_DARK}
            />
          </AnimatedG>
        );
      })}
      {growth >= 0.99 ? <Ellipse cx={100} cy={top - 6} rx={10} ry={10} fill="#FF9385" /> : null}
      <Path d="M62 172 L138 172 L128 214 L72 214 Z" fill="#E8962A" />
      <Rect x={56} y={164} width={88} height={14} rx={6} fill="#FFB547" />
    </Svg>
  );
}
