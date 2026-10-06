import { describe, expect, test } from "bun:test";
import { toAsciiDigits, toBanglaDigits } from "../src/digits";

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
