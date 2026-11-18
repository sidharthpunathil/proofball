/**
 * Tiny D1 client for the CLI scripts: shells out to `wrangler d1 execute`.
 *
 * Targets the remote (production) database by default. Set D1_LOCAL=1 to use the
 * local database that `next dev` / `wrangler dev` read from instead.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DB_NAME = process.env.D1_DATABASE || "proofball";
const TARGET = process.env.D1_LOCAL === "1" ? "--local" : "--remote";

function wrangler(args) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", DB_NAME, TARGET, "--json", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

/** Run one read query; returns its rows. */
export function d1Query(sql) {
  const res = wrangler(["--command", sql]);
  return res[0]?.results ?? [];
}

/** Run a SQL file's worth of statements (writes). */
export function d1ExecSql(sql) {
  const dir = mkdtempSync(join(tmpdir(), "proofball-d1-"));
  const file = join(dir, "batch.sql");
  try {
    writeFileSync(file, sql);
    return wrangler(["--file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Quote a value as a SQLite literal. */
export function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}
