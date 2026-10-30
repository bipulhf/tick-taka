import type { TikiMood } from "@tick-taka/shared/tiki";
import { useEffect, useRef } from "react";

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
        <g stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none">
          <path d="M42 58 Q48 51 54 58" />
          <path d="M66 58 Q72 51 78 58" />
        </g>
      );
    case "relaxed":
      return (
        <g stroke={INK} strokeWidth={3.5} strokeLinecap="round">
          <line x1={42} y1={57} x2={54} y2={57} />
          <line x1={66} y1={57} x2={78} y2={57} />
        </g>
      );
    case "sleepy":
      return (
        <g stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
          <path d="M42 56 Q48 61 54 56" />
          <path d="M66 56 Q72 61 78 56" />
        </g>
      );
    case "focused":
      return (
        <g>
          <g stroke={INK} strokeWidth={2.5} strokeLinecap="round" fill="none">
            <path d="M42 48 Q48 45 54 48" />
            <path d="M66 48 Q72 45 78 48" />
          </g>
          <circle cx={48} cy={58} r={4.5} fill={INK} />
          <circle cx={72} cy={58} r={4.5} fill={INK} />
        </g>
      );
    case "curious":
      return (
        <g>
          <path
            d="M64 47 Q71 42 78 46"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={48} cy={58} r={4.5} fill={INK} />
          <circle cx={72} cy={57} r={5.5} fill={INK} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={48} cy={57} r={5} fill={INK} />
          <circle cx={72} cy={57} r={5} fill={INK} />
          <circle cx={49.5} cy={55.5} r={1.6} fill="#fff" />
          <circle cx={73.5} cy={55.5} r={1.6} fill="#fff" />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: TikiMood }) {
  const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinecap: "round" as const, fill: "none" };
  switch (mood) {
    case "proud":
      return <path d="M47 70 Q60 84 73 70" {...stroke} />;
    case "cheering":
      return <path d="M47 69 Q60 88 73 69 Z" fill={INK} />;
    case "relaxed":
      return <path d="M50 72 Q60 79 70 72" {...stroke} />;
    case "calm":
      return <path d="M52 73 Q60 76 68 73" {...stroke} />;
    case "sleepy":
      return <circle cx={60} cy={74} r={3.5} fill={INK} />;
    case "focused":
      return <path d="M52 72 Q60 76 68 72" {...stroke} />;
    case "curious":
      return <circle cx={61} cy={74} r={3} fill={INK} />;
    default:
      return <path d="M49 70 Q60 80 71 70" {...stroke} />;
  }
}

function Outfit({ outfit }: { outfit: TikiOutfit }) {
  switch (outfit) {
    case "cap":
      return (
        <g>
          <path d="M30 30 Q60 4 90 30 Z" fill="#5B8CFF" />
          <path d="M84 29 Q100 30 104 36 Q92 36 82 33 Z" fill="#3E6FE0" />
        </g>
      );
    case "crown":
      return (
        <path
          d="M40 22 L46 6 L54 18 L60 2 L66 18 L74 6 L80 22 Z"
          fill="#FFD84D"
          stroke={RIM}
          strokeWidth={2}
        />
      );
    case "scarf":
      return <path d="M26 92 Q60 108 94 92 L92 100 Q60 116 28 100 Z" fill="#A57BFF" />;
    default:
      return null;
  }
}

export interface TikiProps {
  mood: TikiMood;
  size?: number;
  outfit?: TikiOutfit;
  className?: string;
}

const ticks = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

/**
 * Tiki: a round coin with a little clock face. Gently bobs, pops when the mood
 * changes, and stays still when the browser asks for reduced motion.
 */
export function Tiki({ mood, size = 96, outfit = null, className }: TikiProps) {
  const node = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!mood) return;
    node.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
      { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [mood]);
  return (
    <span
      ref={node}
      role="img"
      aria-label={`Tiki looks ${mood}`}
      className={`inline-block shrink-0 motion-safe:animate-[tiki-bob_2.8s_ease-in-out_infinite] ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
        <circle cx={60} cy={62} r={50} fill={COIN} stroke={RIM} strokeWidth={4} />
        <circle cx={60} cy={62} r={40} fill={FACE} />
        {ticks.map((angle) => (
          <line
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
        <g stroke={RIM} strokeWidth={3.5} strokeLinecap="round">
          <line x1={60} y1={36} x2={60} y2={25} />
          <line x1={60} y1={36} x2={68} y2={31} />
        </g>
        <circle cx={60} cy={36} r={3} fill={RIM} />
        {mood === "proud" || mood === "relaxed" || mood === "cheering" ? (
          <g opacity={0.55}>
            <circle cx={38} cy={68} r={5} fill={BLUSH} />
            <circle cx={82} cy={68} r={5} fill={BLUSH} />
          </g>
        ) : null}
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {mood === "sleepy" ? (
          <text x={88} y={30} fontSize={16} fontWeight="bold" fill={INK}>
            z
          </text>
        ) : null}
        {mood === "proud" || mood === "cheering" ? (
          <path d="M98 20 L100 26 L106 28 L100 30 L98 36 L96 30 L90 28 L96 26 Z" fill="#FFD84D" />
        ) : null}
        <Outfit outfit={outfit} />
      </svg>
    </span>
  );
}
