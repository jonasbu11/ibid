// Shared PGlite harness. Every suite builds a fresh database from schema/,
// applies it, and records PASS/FAIL per assertion. A suite exits non-zero on
// any FAIL so `npm test` is a single truthful bit.
//
// Refusal tests name the error they expect. A refusal for the wrong reason
// (a harness bug, a missing role) is a failure, not a pass.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function schemaFiles() {
  const dir = path.join(root, 'schema');
  return fs.readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

export async function freshDb({ extensions = {} } = {}) {
  const db = new PGlite({ extensions });
  for (const f of schemaFiles()) {
    try { await db.exec(f.sql); }
    catch (e) { throw new Error(`${f.name}: ${e.message}`); }
  }
  return db;
}

export function suite(name) {
  const results = [];
  const ok = (label) => results.push(['PASS', label]);
  const bad = (label, detail) => results.push(['FAIL', label, detail]);
  const api = {
    ok, bad,
    async expectOk(db, label, sql, params) {
      try { const r = await db.query(sql, params); ok(label); return r; }
      catch (e) { bad(label, e.message); return { rows: [] }; }
    },
    async expectErr(db, label, sql, match, params) {
      try { await db.query(sql, params); bad(label, 'expected a refusal, statement succeeded'); }
      catch (e) {
        if (match && !e.message.includes(match)) bad(label, `refused for the wrong reason: ${e.message}`);
        else ok(`${label} -> refused: ${e.message.split('\n')[0]}`);
      }
    },
    eq(label, got, want) {
      JSON.stringify(got) === JSON.stringify(want) ? ok(label) : bad(label, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    },
    done() {
      const fails = results.filter((r) => r[0] === 'FAIL');
      for (const r of results) console.log(r[0], r[1], r[2] ? `\n    ${r[2]}` : '');
      console.log(`\n${name}: ${results.length - fails.length}/${results.length} passed`);
      if (fails.length) process.exit(1);
    },
  };
  return api;
}
