import { describe, expect, test } from "bun:test";
import { exportFileName, isExportFile } from "../src/lib/export-file";

describe("the export file left for sharing (QA-307)", () => {
  test("is named by date, and the sweep on sign-out finds it", () => {
    const name = exportFileName(new Date(Date.UTC(2026, 9, 7, 12)));
    expect(name).toBe("tick-taka-export-2026-10-07.json");
    expect(isExportFile(name)).toBe(true);
  });

  test("the sweep leaves other cache files alone", () => {
    for (const name of ["receipt-01J.jpg", "tick-taka-export-2026-10-07.json.tmp", "export.json"])
      expect(isExportFile(name)).toBe(false);
  });
});
