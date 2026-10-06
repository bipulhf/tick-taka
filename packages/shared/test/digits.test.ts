import { describe, expect, test } from "bun:test";
import { parseTypedInteger, toAsciiDigits, toBanglaDigits } from "../src/digits";

describe("digits", () => {
  test("Bangla digits become ASCII, other text is untouched", () => {
    expect(toAsciiDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
    expect(toAsciiDigits("চা ২০")).toBe("চা 20");
    expect(toAsciiDigits("lunch 250")).toBe("lunch 250");
    expect(toAsciiDigits("রুম ৩০২").length).toBe("রুম ৩০২".length);
  });

  test("ASCII digits become Bangla for display", () => {
    expect(toBanglaDigits("0123456789")).toBe("০১২৩৪৫৬৭৮৯");
    expect(toBanglaDigits("৳1,23,456.50")).toBe("৳১,২৩,৪৫৬.৫০");
    expect(toAsciiDigits(toBanglaDigits("−৳640"))).toBe("−৳640");
  });
});

// QA-215: number fields that aren't amounts (habit target, minutes) read Bangla too.
describe("typed whole numbers", () => {
  test("Bangla and ASCII digits read the same; anything else is null", () => {
    expect(parseTypedInteger("৩")).toBe(3);
    expect(parseTypedInteger(" 12 ")).toBe(12);
    expect(parseTypedInteger("১০")).toBe(10);
    expect(parseTypedInteger("")).toBeNull();
    expect(parseTypedInteger("abc")).toBeNull();
    expect(parseTypedInteger("2.5")).toBeNull();
  });
});
