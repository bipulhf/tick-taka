import { Directory, File, Paths } from "expo-file-system";
import { exportsToSweep } from "./export-file";

/**
 * Deletes JSON exports in the cache folder made `keepMs` or more ago; with 0, every
 * one (sign-out). Runs at start and before each new export. Never throws.
 */
export function sweepExports(keepMs: number, now = Date.now()): void {
  try {
    const files = new Directory(Paths.cache)
      .list()
      .filter((item): item is File => item instanceof File);
    const doomed = new Set(
      exportsToSweep(
        files.map((file) => ({ name: file.name, lastModified: file.lastModified ?? null })),
        now,
        keepMs,
      ),
    );
    for (const file of files) if (doomed.has(file.name)) file.delete();
  } catch (error) {
    console.warn("export: couldn't clear old export files", error);
  }
}
