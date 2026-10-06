# Standalone extraction plan: the self-managing memory loop

Name: **Ibid** (jonasbu11/ibid; decided 2026-10-06). Partial fork from the internal Stet code at stetworks.com (jonasbu11/spine) plus the memory substrate from the BRAIN, re-homed as a plain-Postgres product with no tenant, client or credential baggage.

Sources read for this plan (confirmed, 2026-10-06): jonasbu11/spine at 5a42c65 (schema.sql, deploy/migrations 0003 through 0023, supabase/functions/mcp/mcp.js, test suite, README); BRAIN function and table catalog for memories, memory_usage, memory_dup_candidates, memory_resolver_*, promotion_sweep, entity_lca, rules_for/rules_load, pending_edits, kill_signal_report.

## What the system is, in one paragraph

An owner tells an assistant how they work, in passing, while working. The database decides when a statement has become a rule: said explicitly, said about one client, or said twice in distinct contexts within 90 days. One-offs never count. Rules live on a tree of spaces (client, job under client) and a set of task kinds; recall returns the rules that apply, widest first, narrower wins on conflict. Told for two siblings, a rule moves up a level and supersedes its narrower copies. Everything is append-only and supersession-based; nothing is edited or deleted. Alongside the rulebook sits a memory store: append-only facts with confidence and importance, salience that rises with use and decays without it, and a resolver that finds near-duplicate memories and links them as restates or supersedes. The owner reads a manual the system wrote; everything the system added on its own is listed with an undo. Kill signals, registered as SQL, say when a feature has failed.

## What gets extracted, and from where

### From spine (code exists, port verbatim then strip)

| Component | Source | Status in source |
| --- | --- | --- |
| lessons, lesson_evidence, learned_bar (explicit / customer / twice / clients), learn_from_evidence trigger, same_lesson, lesson_covered, lesson_words, lesson_numbers, rule_head, retire_dismisses_lesson, enforce_learned_has_evidence, stamp_evidence_now | 0016, 0021, 0023 | live, tested (learning 23, learning-api 17, promotion 10) |
| rules with customer, except_when, kind_key, space_id, supersession, retire/restore | 0012, 0015, 0016, 0019, 0021 | live |
| spaces: entities tree with parent_id, closed_on, sibling-unique names, enforce_space_tree, resolve_space, find_space, ensure_space, space_path, rules_for root-to-leaf | 0021 | live |
| space levels (tenant names its own levels, one to four) | 0022 | live |
| work_kinds (type of task), enforce_kind_exists | 0019, 0020 | live |
| api.recall, api.learn, confirm/dismiss_lesson, retire/restore_rule, add_exception, define_kind, define_space, close_space, lessons_heard, learned_recently, assistant_status | 0016 to 0023 | live |
| the manual: manual_rules, manual_history, manual_summary, manual_export (markdown), manual_opened | 0015, 0016, 0019 | live |
| kill_signals table and kill_signal_report | 0015 | live |
| enforce_append_only, refuse_mutation, supersession pattern, tenant-scoped composite FKs, RLS | schema.sql, 0003 | live |
| MCP server (Streamable HTTP, JSON-RPC, 11 tools, draft prompt, manual resource) | supabase/functions/mcp/mcp.js | live v5, tested (mcp 248 lines) |
| PGlite test harness, deploy-as-non-superuser test, adversarial suite shape | test/*.mjs, test/live/*.sql | live |

Known defect to fix in the fork rather than inherit: schema.sql and deploy/supabase.sql are behind migrations 0021 to 0023 (spine backlog 25). The fork builds one fresh schema that includes spaces, levels and promotion from the start; the migration chain is not carried over.

### From the BRAIN (SQL exists, re-derive without BRAIN coupling)

| Component | Source | Notes |
| --- | --- | --- |
| memories: body, kind, confidence (confirmed / inferred / unverified), importance 1 to 10, occurred_on, source, supersedes, scope_id; append-only, supersede-not-edit | memories table, remember() | fix the 1-5 vs 1-10 scale defect (lesson 1189) by making the scale a CHECK plus documented anchors |
| memory_entities (memory linked to one or more spaces, with role and basis) | memory_entities | |
| salience: memory_salience(importance, recorded_at, confidence), memory_usage, touch_memory (+50% cap, ~60 day decay) | memory_salience, touch_memory | |
| near-duplicate resolver: memory_dup_candidates, resolver tick, floor with probe band, auto-tune with bounds and history, unlink | memory_resolver_tick/tune/unlink, kv memory:resolver | default to pg_trgm similarity so plain Postgres works; pgvector optional (lesson 10: cosine floor on this kind of corpus is ~0.795, so absolute thresholds under ~0.93 are meaningless) |
| cross-space promotion of memory pairs to their lowest common ancestor (entity_lca, promotion_sweep as pending edits) | entity_lca, promotion_sweep, v_promotion_candidates | |
| staged edits / approvals (pending_edits, stage_edit, approval_set): changes the system makes on its own initiative wait for the owner | pending_edits, stage_edit, approval_set | this is the memory-side twin of "Added on its own this week" with Undo |
| rules_load by cues (kind cues registry) | rules_load, registry:rule-kinds | optional layer over rules_for |

### Deliberately left behind

Packs and stages, runner, replay, broker and Google verbs, quote documents and templates, quote examples / past_work, consent handoff, sample packages and install/purge_sample, tenant rows (tenant zero, 0014), the publishable key and project refs, the owner app (web/), the marketing site (www/, site/, brand/), kill signals that measure drafts or quotes, anything naming a client. Embeddings via the BRAIN's embed edge function (replaced by the pluggable similarity provider).

## Target shape of the new repo

```
ibid/
  README.md                 what it is, the told-twice rule in plain words, provenance line (see below)
  LICENSE                   MIT proposed
  schema/
    000_core.sql            tenants (optional, default single-tenant), spaces tree, kinds, append-only helpers
    010_rules.sql           rules, supersession, retire/restore, except_when
    020_lessons.sql         lessons, evidence, learned_bar, learn_from_evidence, promotion
    030_memories.sql        memories, memory_spaces, salience, touch, usage
    040_resolver.sql        dup candidates, tick, tune, unlink (pg_trgm default, pgvector optional)
    050_recall.sql          rules_for, recall(), manual_*, status
    060_review.sql          pending_edits, stage_edit, approval_set, learned_recently with undo
    070_kill_signals.sql    table, report, the signals that still apply
    080_api.sql             api schema: SECURITY DEFINER surface, tenant from caller
  deploy/
    build.mjs               concatenates schema/ into one deploy script; two targets: plain Postgres, Supabase
    docker-compose.yml      Postgres 16 + pg_trgm (+ pgvector image variant) for local use
  server/
    mcp.js                  the MCP handler, host-agnostic (fetch Request/Response in, out)
    stdio.mjs               stdio transport for Claude Desktop / Claude Code / Cursor
    http.mjs                Node Streamable HTTP server with bearer or OAuth 2.1 pass-through
    supabase/index.ts       Deno entry for Supabase Edge Functions (what spine has today)
  cli/
    ibid.mjs                  ibid learn / recall / manual / status / export / import against a DATABASE_URL
  test/
    *.mjs                   PGlite suites ported from spine: schema, adversarial, injection, learning, learning-api, spaces, promotion, mcp, killsignals, deploy-as-non-superuser
    live/*.sql              adversarial suites against a real database, every attack naming its expected error
  docs/
    DESIGN.md               invariants, what the database enforces and why
    HOST-SETUP.md           Claude, ChatGPT, Claude Code, Cursor connection walkthroughs
    PROVENANCE.md           file-by-file map back to spine migrations and BRAIN functions
  .github/workflows/ci.yml npm test on PGlite; nightly live suite against a disposable Postgres service
```

README provenance line, verbatim as you asked: "This is a partial fork from the internal code of stetworks.com." Expanded one paragraph under it: what was taken (the learning loop, spaces, recall, the manual, the MCP server, the test discipline), what was added (the memory store, salience, the resolver, staged approvals, plain-Postgres and stdio targets), what was left behind, and that no customer, tenant or credential data crossed over.

## Additions that earn their place

1. Plain Postgres as the first target, Supabase as the second. Tenant isolation becomes optional: single-tenant mode sets one tenant row and skips RLS; multi-tenant mode is the spine design unchanged. Kill signal: if nobody runs multi-tenant in 90 days after release, drop the mode rather than carry it.
2. stdio MCP transport so the server runs locally against a local database with no hosting at all. This is the install path for most people and spine does not have it.
3. CLI with export and import. The manual exports to markdown already; add a JSON round trip (rules, lessons, evidence, spaces, kinds, memories) so a user can leave, back up, or move hosts. Import is additive and append-only like everything else.
4. Pluggable similarity. `similarity(a, b)` is one SQL function; pg_trgm implementation ships, pgvector implementation ships behind a flag with a documented embedding hook. The resolver's floor, probe band and auto-tune work on either.
5. Memories gain the lessons treatment: a memory's confidence can only move by supersession, and a fact stated twice from different sources (source differs, day differs) is what moves inferred to confirmed. Same bar, same trigger shape, no new concept.
6. "Added on its own" extends to memory links: resolver verdicts and promotions land in pending_edits with Undo, exactly as learned rules do in the manual, so the owner has one place to see everything the system decided alone.
7. Kill signals ship registered and reported, with the five that still apply: recall_calls_per_week_under_3, manual_never_opened_30d, learn_per_recall_not_falling_wk4, promotion_unused_60d, resolver_unsure_share_over_half.
8. CI that builds as a non-superuser shaped like a managed Postgres user (spine's test/deploy.mjs lesson: PGlite's superuser hides ownership bugs that bite live).

## Build order, acceptance, cycle estimate

One cycle is one working session. Each item ends with its tests passing on PGlite, a commit to the new repo's main, and the kill signal registered where one applies.

| # | Item | Acceptance | Cycles |
| --- | --- | --- | --- |
| 0 | Repo created, license, README with provenance, CI skeleton, PGlite harness, docker-compose; `npm test` runs an empty suite green | CI green on an empty schema | 0.5 |
| 1 | Core: spaces tree, kinds, append-only helpers, supersession, single/multi-tenant switch | ported schema and adversarial suites pass; a row cannot reference another tenant's row; UPDATE and DELETE refused on protected tables | 1 |
| 2 | Rules and lessons: told twice, explicit, customer, clients bars; promotion with supersession of narrower copies; retire/restore; except_when | spine's learning (23), learning-api (17), promotion (10) and spaces (20) suites pass unchanged in substance | 1 |
| 3 | Recall, manual, status, kill signals | recall returns rules widest first, narrower wins, except_when honored; manual export shows origin per rule and "added on its own" with undo; kill_signal_report runs | 1 |
| 4 | Memories, salience, touch, usage | importance scale is 1 to 10 by CHECK with anchors in a comment; touch caps at +50% and decays; supersede-only correction | 1 |
| 5 | Resolver with pg_trgm default, pgvector optional; staged edits and approvals | planted near-duplicates are found, adjudicated, linkable and unlinkable; floor auto-tune moves only within bounds and logs history; every resolver verdict is a pending edit until accepted | 1.5 |
| 6 | MCP server: shared handler, stdio, Node HTTP, Supabase Deno entry | spine's mcp suite passes against the shared handler; a fresh Claude Desktop session attaches over stdio and completes the first-acceptance script below | 1 |
| 7 | CLI, export/import, docs (DESIGN, HOST-SETUP, PROVENANCE) | export then import into an empty database yields identical recall output; PROVENANCE maps every schema file to its spine or BRAIN origin | 1 |
| 8 | Release: tag v0.1.0, CI nightly live suite, README walkthrough verified from a clean clone by a second agent that has not seen the build | second agent completes install and first acceptance from README alone | 0.5 |

Total: about 8.5 cycles.

First acceptance for the whole thing: from a fresh assistant session with the server attached over stdio against a local Postgres, the user states a rule once for client A, once for client B on a different (clock-advanced) day; recall for client C returns it as a workspace rule; the manual lists it under "added on its own" with its two origins; undo retires it; saying it a third time does not revive it; "always" does.

## Scrubbing discipline

Before any commit: grep the tree for tenant names, emails, the spine publishable key, project refs (ajhrymguwraergqqydjd, kuwdminavipvwglvmqnc), client names from the BRAIN, and Netlify ids. Spine's samples/ and 0008/0014 never enter the tree. Test fixtures are synthetic. The scrub list lives in `scripts/scrub-check.mjs` and runs in CI, so the check is a test, not a habit.

## Decisions that need your hand

1. DECIDED: jonasbu11/ibid, private until item 8 passes, then public.
2. License. MIT proposed. Apache-2.0 if you want the patent grant.
3. Whether the fork keeps the name Stet anywhere beyond the provenance line. Proposed: no; the product and the open repo stay separable.
4. Single-tenant default (proposed) or multi-tenant default (spine's).

Everything else above is below the line and gets built on your go, item by item, with evidence per item.
