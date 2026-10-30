const LEAF = "#2EC4A0";
const LEAF_DARK = "#1E9E80";
const LEAF_SLOTS = [0, 1, 2, 3, 4];

/**
 * Tiki's plant grows while I focus. Leaving the tab makes it droop; it never dies.
 * `growth` is 0 to 1, `drooping` tilts the leaves down.
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
  const stem = 20 + growth * 90;
  const top = 170 - stem;
  const leaves = Math.min(5, Math.floor(growth * 6));
  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 200 220"
      role="img"
      aria-label={
        drooping
          ? "The plant is resting until you're back"
          : `The plant is ${Math.round(growth * 100)}% grown`
      }
    >
      <path
        d={`M100 172 Q${drooping ? 112 : 100} ${172 - stem / 2} 100 ${top}`}
        stroke={LEAF_DARK}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        className="transition-[d] duration-500 ease-out-quart"
      />
      {LEAF_SLOTS.slice(0, leaves).map((i) => {
        const y = 165 - (i + 1) * (stem / (leaves + 1));
        const left = i % 2 === 0;
        return (
          <g
            key={i}
            style={{
              transform: `rotate(${drooping ? (left ? -55 : 55) : 0}deg)`,
              transformOrigin: `100px ${y}px`,
              transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <ellipse
              cx={left ? 82 : 118}
              cy={y}
              rx={18}
              ry={8}
              fill={i === leaves - 1 ? LEAF : LEAF_DARK}
            />
          </g>
        );
      })}
      {growth >= 0.99 ? <circle cx={100} cy={top - 6} r={10} fill="#FF9385" /> : null}
      <path d="M62 172 L138 172 L128 214 L72 214 Z" fill="#E8962A" />
      <rect x={56} y={164} width={88} height={14} rx={6} fill="#FFB547" />
    </svg>
  );
}
