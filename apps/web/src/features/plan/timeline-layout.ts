/** The day timeline's geometry. Pure, so it can be tested. */

export const START_HOUR = 6;
export const END_HOUR = 23;
export const PX_PER_MIN = 1.2;
export const SNAP_MIN = 15;
/** A block is never shorter than this, so a 5-minute task still has room for its title. */
export const MIN_BLOCK_PX = 56;
const DEFAULT_MINUTES = 30;

/** The minute of the day a card dropped `offsetY` px below the grid's top lands on, snapped. */
export function minuteFromOffset(offsetY: number): number {
  const minute = START_HOUR * 60 + Math.round(offsetY / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
  return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - SNAP_MIN, minute));
}

/** Where a minute of the day sits on the grid, in px from its top (before 6 am is the top). */
export function offsetOf(minuteOfDay: number): number {
  return Math.max(0, (minuteOfDay - START_HOUR * 60) * PX_PER_MIN);
}

export interface Block {
  id: string;
  /** Minute of the day it starts. */
  start: number;
  minutes: number | null;
}

export interface PlacedBlock {
  id: string;
  top: number;
  height: number;
  /** Side-by-side position among blocks that overlap it. */
  lane: number;
  lanes: number;
}

/**
 * Places timed tasks on the grid. Blocks that overlap share the width in lanes
 * instead of covering each other; each run of overlapping blocks gets its own count.
 */
export function layoutBlocks(blocks: Block[]): PlacedBlock[] {
  const sorted = [...blocks]
    .map((block) => {
      const top = offsetOf(block.start);
      const height = Math.max(MIN_BLOCK_PX, (block.minutes ?? DEFAULT_MINUTES) * PX_PER_MIN);
      return { id: block.id, top, height };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);
  const placed: PlacedBlock[] = [];
  let group: PlacedBlock[] = [];
  let groupEnd = -1;
  const laneEnds: number[] = [];
  const close = () => {
    const lanes = Math.max(1, ...group.map((b) => b.lane + 1));
    for (const block of group) placed.push({ ...block, lanes });
    group = [];
    laneEnds.length = 0;
  };
  for (const block of sorted) {
    if (group.length && block.top >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= block.top);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = block.top + block.height;
    group.push({ ...block, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, block.top + block.height);
  }
  if (group.length) close();
  return placed;
}

/** "6 am", "12 pm". */
export function hourLabel(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "am" : "pm"}`;
}
