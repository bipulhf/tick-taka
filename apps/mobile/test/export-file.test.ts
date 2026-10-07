import { describe, expect, test } from "bun:test";
import {
  EXPORT_KEEP_MS,
  exportFileName,
  exportsToSweep,
  isExportFile,
} from "../src/lib/export-file";

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

// QA-402 / UX-052: the app a share went to may read the file after the sheet returns.
describe("sweeping exports", () => {
  const NOW = Date.UTC(2026, 9, 7, 12);
  const files = [
    { name: "tick-taka-export-2026-10-07.json", lastModified: NOW - 5 * 60_000 },
    { name: "tick-taka-export-2026-10-06.json", lastModified: NOW - 26 * 3_600_000 },
    { name: "tick-taka-export-2026-10-05.json", lastModified: null },
    { name: "receipt-01J.jpg", lastModified: NOW - 48 * 3_600_000 },
  ];

  test("a recent export is kept for the app it was shared to; older ones go", () => {
    expect(exportsToSweep(files, NOW, EXPORT_KEEP_MS)).toEqual([
      "tick-taka-export-2026-10-06.json",
      "tick-taka-export-2026-10-05.json",
    ]);
    expect(EXPORT_KEEP_MS).toBeGreaterThanOrEqual(60 * 60_000);
  });

  test("an export becomes old an hour after it was made", () => {
    const made = [{ name: "tick-taka-export-2026-10-07.json", lastModified: NOW }];
    expect(exportsToSweep(made, NOW + EXPORT_KEEP_MS - 1, EXPORT_KEEP_MS)).toEqual([]);
    expect(exportsToSweep(made, NOW + EXPORT_KEEP_MS, EXPORT_KEEP_MS)).toHaveLength(1);
  });

  test("on sign-out (keep nothing) every export goes, and nothing else", () => {
    expect(exportsToSweep(files, NOW, 0)).toEqual([
      "tick-taka-export-2026-10-07.json",
      "tick-taka-export-2026-10-06.json",
      "tick-taka-export-2026-10-05.json",
    ]);
  });
});
