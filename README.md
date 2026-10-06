# Ibid

**Told twice is a rule.**

Ibid is a self-managing memory and rulebook for AI assistants. The owner says how they work, in passing, while working. The database decides when a statement has become a rule: said explicitly, said about one client, or said twice in distinct contexts within 90 days. One-offs never count. Rules live on a tree of spaces (a client, a job under the client) and a set of task kinds. `recall` returns the rules that apply, widest first; the narrower rule wins on conflict. A rule told for two siblings moves up a level and supersedes its narrower copies.

Nothing is edited or deleted. Rows are append-only and corrections are supersessions. The owner reads a manual the system wrote, and everything it added on its own is listed with an undo.

Alongside the rulebook sits a memory store: append-only facts with confidence and importance, salience that rises with use and decays without it, and a resolver that finds near-duplicate memories and links them as restatements or supersessions. Kill signals, registered as SQL, say when a feature has failed.

It runs on plain Postgres and speaks MCP, so it attaches to Claude, ChatGPT, Claude Code, Cursor or anything else that adds an MCP server.

## Provenance

This is a partial fork from the internal code of stetworks.com.

Taken from Stet: the learning loop (lessons, evidence, the told-twice bar, promotion), spaces, kinds, recall, the manual, the MCP server, and the test discipline (every rule the database enforces has a test that tries to break it and is refused). Added here: the memory store, salience, the near-duplicate resolver, staged approvals, the plain-Postgres and stdio targets, the CLI and export/import. Left behind: everything about quoting, drafting, mailboxes, credentials and hosting that made Stet a product. No customer, tenant or credential data crossed over; `scripts/scrub-check.mjs` runs in CI to keep it that way.

## Status

Item 0 of the build plan: repository, license, harness, CI. See [docs/PLAN.md](docs/PLAN.md) for the build order and acceptance criteria.

```
npm install
npm test        # real Postgres via PGlite, no services needed
```

## License

MIT. See [LICENSE](LICENSE).
