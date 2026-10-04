import { createStore } from "./store";

/** Sparks earned in this session before the server confirms them; drives the "+10" fly-up. */
export const sparkBurstStore = createStore<{ id: number; amount: number } | null>(null);
let nextId = 1;

export function awardSparks(amount: number) {
  sparkBurstStore.set({ id: nextId++, amount });
}
