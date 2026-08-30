# Secret source exposure response — 2026-08-28

Status: active containment

During an attempted metadata-only inspection of the legacy Jira credential
source, a delimiter mismatch caused two credential-looking values to enter a
model-visible tool result. No value is repeated or retained in this artifact.

Containment decisions:

- Treat every emitted value as compromised and prohibit further use.
- Stop Jira network synchronization and real broker enrollment with the legacy
  source.
- Require owner-controlled provider revocation and replacement before the Jira
  pilot can resume.
- Enroll the replacement only through the Windows no-echo trusted prompt.
- Prohibit generic source-format inspection in the KStack Secrets skill and
  require a separately audited exact-format importer for any future legacy
  source ingestion.

The implementation and synthetic qualification remain valid, but the real
pilot is blocked until credential rotation and independent review both pass.
