// Item 0: the schema directory applies cleanly on a fresh database and the
// harness itself works in both directions (an expected refusal is refused).
import { freshDb, schemaFiles, suite } from './_harness.mjs';

const t = suite('schema');
const files = schemaFiles();
t.ok(`schema/ holds ${files.length} file(s): ${files.map((f) => f.name).join(', ') || '(none yet)'}`);

let db;
try { db = await freshDb(); t.ok('schema applies on a fresh database'); }
catch (e) { t.bad('schema applies on a fresh database', e.message); t.done(); }

await t.expectOk(db, 'database answers', `select 1 as one`);
await t.expectErr(db, 'harness sees a refusal', `select * from table_that_does_not_exist`, 'does not exist');
const v = await db.query(`show server_version`);
t.ok(`postgres ${v.rows[0].server_version} (PGlite)`);
t.done();
