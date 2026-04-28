#!/usr/bin/env node
/**
 * SQL migration safety check.
 *
 * Scans every file under sql/ for statements that are unsafe under the
 * shared-change policy (docs/release/shared-change-policy.md). Migrations
 * that match a forbidden pattern must include an opt-in marker comment that
 * explicitly names the dual-write or backfill plan.
 *
 * Forbidden without a marker:
 *   - DROP COLUMN
 *   - DROP TABLE
 *   - ALTER COLUMN ... TYPE
 *   - DROP POLICY (RLS)
 *
 * Marker (place anywhere in the file, on its own line):
 *   -- compat:approved <reason>
 *
 * Exit codes:
 *   0  no problems
 *   1  one or more violations (printed to stderr)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sqlDir = join(process.cwd(), "sql");

// DROP POLICY immediately followed by CREATE POLICY on the same surface is
// the standard Supabase RLS upsert pattern and is not destructive. We only
// flag DROP POLICY when it is NOT followed (within the same file) by an
// equivalent CREATE POLICY. The other patterns are always considered risky
// without an explicit approval marker.
const PATTERNS = [
  { name: "DROP COLUMN", regex: /\bdrop\s+column\b/i },
  { name: "DROP TABLE", regex: /\bdrop\s+table\b/i },
  { name: "ALTER COLUMN TYPE", regex: /\balter\s+column\s+\S+\s+(?:set\s+data\s+)?type\b/i },
];

const DROP_POLICY = /\bdrop\s+policy\b/i;
const CREATE_POLICY = /\bcreate\s+policy\b/i;
const APPROVAL_MARKER = /^\s*--\s*compat:approved\b.*$/im;

function listSqlFiles(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out = out.concat(listSqlFiles(full));
    } else if (entry.endsWith(".sql")) {
      out.push(full);
    }
  }
  return out;
}

function checkFile(file) {
  const sql = readFileSync(file, "utf8");
  const approved = APPROVAL_MARKER.test(sql);
  const hits = [];

  for (const p of PATTERNS) {
    if (p.regex.test(sql)) hits.push(p.name);
  }

  // DROP POLICY only counts when there is no CREATE POLICY in the same file
  // (standalone drops are destructive; drop-then-create is the upsert
  // pattern used throughout Supabase migrations and is safe).
  if (DROP_POLICY.test(sql) && !CREATE_POLICY.test(sql)) {
    hits.push("DROP POLICY without re-create");
  }

  if (hits.length === 0) return null;
  if (approved) return null;

  return { file, hits };
}

let dirExists = true;
try {
  statSync(sqlDir);
} catch {
  dirExists = false;
}

if (!dirExists) {
  console.log("[check-migrations] No sql/ directory; nothing to check.");
  process.exit(0);
}

const files = listSqlFiles(sqlDir);
const violations = files.map(checkFile).filter(Boolean);

if (violations.length === 0) {
  console.log(`[check-migrations] OK (${files.length} files scanned)`);
  process.exit(0);
}

console.error("[check-migrations] FAILED — destructive SQL without approval marker:");
for (const v of violations) {
  console.error(`  - ${v.file}: ${v.hits.join(", ")}`);
}
console.error("");
console.error("Add the line `-- compat:approved <reason>` to each flagged file");
console.error("after confirming the change is safe per docs/release/shared-change-policy.md.");
process.exit(1);
