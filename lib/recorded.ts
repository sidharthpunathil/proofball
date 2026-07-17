import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import type { Frame } from "./types";

export interface RecordedEvent {
  t: number; // ms since recording start
  data: Frame;
}

/**
 * Load a recorded TxLINE feed from /fixtures/*.ndjson if present.
 * Written by `npm run record` during a live match. Returns null if none.
 * This is how you replace the synthetic sample with REAL captured data.
 */
export function loadRecordedFrames(): RecordedEvent[] | null {
  try {
    const dir = path.join(process.cwd(), "fixtures");
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".ndjson"))
      .sort();
    if (files.length === 0) return null;
    const lines = readFileSync(path.join(dir, files[0]), "utf8").split("\n").filter(Boolean);
    const events = lines.map((l) => JSON.parse(l) as RecordedEvent);
    return events.length > 1 ? events : null;
  } catch {
    return null;
  }
}
