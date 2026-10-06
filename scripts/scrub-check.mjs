// Scrub check: nothing from the source systems may cross into this tree.
// Runs in CI and in `npm test`. Exits non-zero on any hit.
//
// The patterns are the ones that would identify a tenant, a client, a
// project or a credential of the systems this code was forked from. Add to
// the list; never remove from it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['.git', 'node_modules']);

const patterns = [
  // Supabase project refs of the source systems
  /ajhrymguwraergqqydjd/i,
  /kuwdminavipvwglvmqnc/i,
  // the source product's publishable key prefix and any sb_ key
  /sb_(publishable|secret)_[A-Za-z0-9_-]{10,}/,
  // GitHub PATs and generic token shapes
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9-]{20,}/,
  // Netlify site ids are UUIDs next to the word netlify
  /netlify[^\n]{0,40}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  // any email address other than the maintainer's own public ones
  /(?<![\w.-])(?!jb@jonasbull\.com)(?!noreply@anthropic\.com)[\w.+-]+@[\w-]+\.[\w.-]+/,
  // source-system tenant and sample names
  /tenant zero|tenant_zero/i,
  /cloud-consultancy/i,
  /\bbrian\b/i,
  // source-system internal names that must not leak as live references
  /\bBRAIN\b/,
  /spine_backlog|stet_\d{4}/i,
];

// Patterns that name the source systems rather than leak a credential. The
// provenance files may carry these; credentials and emails are never exempt.
const provenanceOnly = new Set(patterns.filter((re) => /BRAIN|spine_backlog|kuwdmin|ajhrym|tenant zero|cloud-consultancy/.test(re.source)));
// Files that are allowed to name the source systems.
const allowProvenance = new Set(['README.md', 'docs/PLAN.md', 'docs/PROVENANCE.md']);

let hits = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!/\.(md|sql|mjs|js|ts|json|yml|yaml|txt|sh)$/.test(entry.name)) continue;
    const rel = path.relative(root, p);
    if (rel === path.join('scripts', 'scrub-check.mjs')) continue;
    const text = fs.readFileSync(p, 'utf8');
    text.split('\n').forEach((line, i) => {
      for (const re of patterns) {
        if (re.test(line)) {
          // PLAN.md and PROVENANCE.md may name the source systems; nothing else may.
          if (allowProvenance.has(rel) && provenanceOnly.has(re)) continue;
          hits++;
          console.log(`${rel}:${i + 1}: ${re} -> ${line.trim().slice(0, 120)}`);
        }
      }
    });
  }
}
walk(root);
if (hits) { console.log(`\nscrub-check: ${hits} hit(s)`); process.exit(1); }
console.log('scrub-check: clean');
