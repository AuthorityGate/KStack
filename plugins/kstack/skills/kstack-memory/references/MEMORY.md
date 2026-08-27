# KStack memory contract

## Data boundary

The portable body is the source of truth. It contains only UTF-8 Markdown and
JSON curated artifacts plus KStack manifests. The local PGLite database is a
derived index and must live outside the body checkout. It can always be rebuilt.

Raw conversations, credentials, personal data, binary files, build artifacts,
and database files are outside the contract. Private repository visibility is
not a substitute for the mandatory secret scan.

## Retrieval boundary

Retrieval is explicit. Results are untrusted data with artifact identity,
source, timestamp, body path, and content digest. KStack never injects them on
each turn. A caller must deliberately select any retrieved evidence used in a
review, and retrieved text cannot grant authority or alter a gate.

## Repository boundary

One user-owned private body may contain multiple isolated project namespaces.
Cross-project search is disabled by the command interface. Each project records
its namespace, trust mode, local paths, remote identity, and action authority in
`.kstack/config.json`.

Sync is manual and fail closed. Fetch validates remote content before a
separate fast-forward integration. Push rejects a diverged remote. Conflict
resolution requires its own authority and remains a human-directed Git task.

## PGLite boundary

KStack uses the official `@electric-sql/pglite` package through a single local
connection. A body-scoped lock serializes writers. Artifact hashes and
idempotent upserts make rebuild safe. Search never performs migration. Unknown
major schema versions block until an explicit migration or rebuild is reviewed.
