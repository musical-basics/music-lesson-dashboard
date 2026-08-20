#!/usr/bin/env node
/**
 * Backfills size_bytes (and duration_seconds, if the column exists) on
 * classroom_recordings rows.
 *
 * LiveKit Egress finalizes the R2 upload a few seconds AFTER stopEgress()
 * returns, so the stop route never learns the real file size and stores 0.
 * This reads the truth back from the object: content-length via HEAD, and
 * duration via ffprobe (skipped automatically if ffprobe isn't installed).
 *
 * Usage: node scripts/backfill-recording-metadata.mjs [--all] [--dry-run]
 *   default: only rows with size_bytes = 0 or a null duration
 *   --all:   re-check every row (also repairs the inflated legacy sizes)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALL = process.argv.includes("--all");
const DRY = process.argv.includes("--dry-run");

function loadEnv() {
  const out = { ...process.env };
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      if (!out[k]) out[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function hasFfprobe() {
  try {
    await run("ffprobe", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function probeDuration(url) {
  try {
    const { stdout } = await run(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", url],
      { timeout: 120000 }
    );
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null; // corrupt/headerless file — leave duration null
  }
}

const main = async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/classroom_recordings?select=*&order=created_at.desc`,
    { headers }
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));

  const hasDurationCol = rows.length > 0 && "duration_seconds" in rows[0];
  if (!hasDurationCol) {
    console.log("note: duration_seconds column not found — run supabase/migrations/20260820_recording_duration.sql to enable duration backfill\n");
  }
  const canProbe = hasDurationCol && (await hasFfprobe());
  if (hasDurationCol && !canProbe) console.log("note: ffprobe not found — durations will be skipped\n");

  const targets = ALL
    ? rows
    : rows.filter((r) => !r.size_bytes || (hasDurationCol && r.duration_seconds == null));

  console.log(`${rows.length} rows total, ${targets.length} to check${DRY ? " (dry run)" : ""}\n`);

  let updated = 0;
  for (const row of targets) {
    if (!row.url) continue;
    let size = null;
    try {
      const head = await fetch(row.url, { method: "HEAD" });
      if (!head.ok) {
        console.log(`  ${row.filename}: HTTP ${head.status} — skipped`);
        continue;
      }
      size = Number(head.headers.get("content-length") || 0);
    } catch (e) {
      console.log(`  ${row.filename}: unreachable — skipped`);
      continue;
    }

    const patch = {};
    if (size && size !== row.size_bytes) patch.size_bytes = size;
    if (canProbe && row.duration_seconds == null) {
      const d = await probeDuration(row.url);
      if (d != null) patch.duration_seconds = Math.round(d);
    }
    if (!Object.keys(patch).length) continue;

    const mb = (size / 1e6).toFixed(1);
    const dur = patch.duration_seconds != null ? `${Math.floor(patch.duration_seconds / 60)}m` : "";
    console.log(`  ${row.filename}: ${mb}MB ${dur}`.trimEnd());

    if (!DRY) {
      const up = await fetch(`${SUPABASE_URL}/rest/v1/classroom_recordings?id=eq.${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      if (!up.ok) {
        console.log(`    update failed: ${up.status} ${await up.text()}`);
        continue;
      }
    }
    updated++;
  }
  console.log(`\n${DRY ? "would update" : "updated"} ${updated} row(s)`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
