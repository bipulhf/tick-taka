import { describe, expect, mock, test } from "bun:test";

// The stores read AsyncStorage on the phone; these tests only parse what it holds.
mock.module("@react-native-async-storage/async-storage", () => ({ default: {} }));

const { EMPTY_CACHE, parseCache, pickQuickEntries } = await import(
  "../src/features/widget/widget-cache"
);
const { lookOf, parseLooks } = await import("../src/features/widget/widget-looks");

describe("the widget cache read back", () => {
  test("nothing stored, or unreadable, is the empty cache", () => {
    expect(parseCache(null)).toBe(EMPTY_CACHE);
    expect(parseCache("{oops")).toBe(EMPTY_CACHE);
  });

  test("an older build's counts don't break the lists, and unknown fields go", () => {
    const old = JSON.stringify({
      signedIn: true,
      leftTodayMinor: 48_300,
      habits: { done: 2, total: 4 },
      topThree: { done: 1, total: 3 },
      lastLog: null,
    });
    const cache = parseCache(old);
    expect(cache.signedIn).toBe(true);
    expect(cache.leftTodayMinor).toBe(48_300);
    expect(cache.habits).toEqual([]);
    expect("topThree" in cache).toBe(false);
  });
});

test("quick-log chips: repeated note and amount, most frequent first, with the category's emoji", () => {
  const tx = (note: string, amountMinor: number, categoryId: string | null = "food") => ({
    type: "expense",
    note,
    amountMinor,
    categoryId,
  });
  const chips = pickQuickEntries(
    [
      tx("Cha", 2_000),
      tx("cha", 2_000),
      tx("Cha", 2_000),
      tx("Lunch", 18_000),
      tx("Lunch", 18_000),
    ],
    3,
    (id) => (id === "food" ? "🍱" : null),
  );
  expect(chips.map((c) => `${c.emoji} ${c.label}`)).toEqual(["🍱 Cha", "🍱 Lunch"]);
  expect(pickQuickEntries([tx("Once", 100)])).toEqual([]);
});

describe("each widget's look", () => {
  test("is what was picked for its id, else Auto", () => {
    const looks = parseLooks(JSON.stringify({ 12: "glass", 13: "neon" }));
    expect(lookOf(looks, 12)).toBe("glass");
    expect(lookOf(looks, 13)).toBe("auto");
    expect(lookOf(looks, 99)).toBe("auto");
    expect(parseLooks("not json")).toEqual({});
  });
});
