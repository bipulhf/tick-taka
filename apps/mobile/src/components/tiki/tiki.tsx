import type { TikiMood } from "@tick-taka/shared/tiki";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

export type TikiOutfit = "cap" | "scarf" | "crown" | null;

const COIN = "#FFB547";
const RIM = "#E8962A";
const FACE = "#FFD48F";
const INK = "#3A2A1A";
const BLUSH = "#FF9385";

function Eyes({ mood }: { mood: TikiMood }) {
  switch (mood) {
    case "proud":
    case "cheering":
      return (
        <G stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none">
          <Path d="M42 58 Q48 51 54 58" />
          <Path d="M66 58 Q72 51 78 58" />
        </G>
      );
    case "relaxed":
      return (
        <G stroke={INK} strokeWidth={3.5} strokeLinecap="round">
          <Line x1={42} y1={57} x2={54} y2={57} />
          <Line x1={66} y1={57} x2={78} y2={57} />
        </G>
      );
    case "sleepy":
      return (
        <G stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
          <Path d="M42 56 Q48 61 54 56" />
          <Path d="M66 56 Q72 61 78 56" />
        </G>
      );
    case "focused":
      return (
        <G>
          <G stroke={INK} strokeWidth={2.5} strokeLinecap="round" fill="none">
            <Path d="M42 48 Q48 45 54 48" />
            <Path d="M66 48 Q72 45 78 48" />
          </G>
          <Circle cx={48} cy={58} r={4.5} fill={INK} />
          <Circle cx={72} cy={58} r={4.5} fill={INK} />
        </G>
      );
    case "curious":
      return (
        <G>
          <Path
            d="M64 47 Q71 42 78 46"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={48} cy={58} r={4.5} fill={INK} />
          <Circle cx={72} cy={57} r={5.5} fill={INK} />
        </G>
      );
    default:
      return (
        <G>
          <Circle cx={48} cy={57} r={5} fill={INK} />
          <Circle cx={72} cy={57} r={5} fill={INK} />
          <Circle cx={49.5} cy={55.5} r={1.6} fill="#fff" />
          <Circle cx={73.5} cy={55.5} r={1.6} fill="#fff" />
        </G>
      );
  }
}

function Mouth({ mood }: { mood: TikiMood }) {
  const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinecap: "round" as const, fill: "none" };
  switch (mood) {
    case "proud":
      return <Path d="M47 70 Q60 84 73 70" {...stroke} />;
    case "cheering":
      return <Path d="M47 69 Q60 88 73 69 Z" fill={INK} />;
    case "relaxed":
      return <Path d="M50 72 Q60 79 70 72" {...stroke} />;
    case "calm":
      return <Path d="M52 73 Q60 76 68 73" {...stroke} />;
    case "sleepy":
      return <Circle cx={60} cy={74} r={3.5} fill={INK} />;
    case "focused":
      return <Path d="M52 72 Q60 76 68 72" {...stroke} />;
    case "curious":
      return <Circle cx={61} cy={74} r={3} fill={INK} />;
    default:
      return <Path d="M49 70 Q60 80 71 70" {...stroke} />;
  }
}

function Outfit({ outfit }: { outfit: TikiOutfit }) {
  switch (outfit) {
    case "cap":
      return (
        <G>
          <Path d="M30 30 Q60 4 90 30 Z" fill="#5B8CFF" />
          <Path d="M84 29 Q100 30 104 36 Q92 36 82 33 Z" fill="#3E6FE0" />
        </G>
      );
    case "crown":
      return (
        <Path
          d="M40 22 L46 6 L54 18 L60 2 L66 18 L74 6 L80 22 Z"
          fill="#FFD84D"
          stroke={RIM}
          strokeWidth={2}
        />
      );
    case "scarf":
      return <Path d="M26 92 Q60 108 94 92 L92 100 Q60 116 28 100 Z" fill="#A57BFF" />;
    default:
      return null;
  }
}

export interface TikiProps {
  mood: TikiMood;
  size?: number;
  outfit?: TikiOutfit;
}

/**
 * Tiki: a round coin with a little clock face. Gently bobs, pops when the mood
 * changes, and stays still when the phone asks for reduced motion.
 */
export function Tiki({ mood, size = 96, outfit = null }: TikiProps) {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    bob.value = withRepeat(
      withSequence(withTiming(-3, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
    );
  }, [bob, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !mood) return;
    pop.value = withSequence(withSpring(1.08, { damping: 6 }), withSpring(1, { damping: 10 }));
  }, [mood, pop, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: pop.value }],
  }));
  const ticks = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessibilityRole="image"
      accessibilityLabel={`Tiki looks ${mood}`}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx={60} cy={62} r={50} fill={COIN} stroke={RIM} strokeWidth={4} />
        <Circle cx={60} cy={62} r={40} fill={FACE} />
        {ticks.map((angle) => (
          <Line
            key={angle}
            x1={60 + Math.sin(angle) * 44}
            y1={62 - Math.cos(angle) * 44}
            x2={60 + Math.sin(angle) * 47}
            y2={62 - Math.cos(angle) * 47}
            stroke={RIM}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        {/* Clock hands peeking over the face like a tuft */}
        <G stroke={RIM} strokeWidth={3.5} strokeLinecap="round">
          <Line x1={60} y1={36} x2={60} y2={25} />
          <Line x1={60} y1={36} x2={68} y2={31} />
        </G>
        <Circle cx={60} cy={36} r={3} fill={RIM} />
        {mood === "proud" || mood === "relaxed" || mood === "cheering" ? (
          <G opacity={0.55}>
            <Circle cx={38} cy={68} r={5} fill={BLUSH} />
            <Circle cx={82} cy={68} r={5} fill={BLUSH} />
          </G>
        ) : null}
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {mood === "sleepy" ? (
          <SvgText x={88} y={30} fontSize={16} fontWeight="bold" fill={INK}>
            z
          </SvgText>
        ) : null}
        {mood === "proud" || mood === "cheering" ? (
          <Path d="M98 20 L100 26 L106 28 L100 30 L98 36 L96 30 L90 28 L96 26 Z" fill="#FFD84D" />
        ) : null}
        <Outfit outfit={outfit} />
      </Svg>
    </Animated.View>
  );
}
