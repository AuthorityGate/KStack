# Reflexion retrieval safety

Reflexion v1 performs lexical semantic matching with one shared pure normalizer: `NFKC`, locale-independent lowercase, then Unicode Letter/Mark/Number tokenization. `normalization.mjs` owns that function; `retrieval-core.mjs` re-exports it, while the sealed corpus boundary consumes the pure dependency directly. This ownership is confirmed and intentional.

Always pass `--project-root .` (or another explicit root). The v1 compatibility default to the starting working directory is deprecated and can select lessons from an untrusted checkout. Lookup remains read-only and does not wait for the mutation lock.

Verbose evidence is operator-only stderr. Never merge it with stdout or place it in a model prompt. Matching uses the validated, unredacted signature and alias values, so a caller who controls keywords and observes results has an exact-match confirmation oracle. The positive prompt allowlist accepts only typed `actor-reference-v1` records with `modelContextEligible:true`; warnings, evidence, repair digests, and unknown records are rejected.

Mutation lock timeouts do not remove the lock. The bounded diagnostic reports a validated UUID owner token and nonnegative decimal age when available. After a crash, establish that no writer is alive before manually removing only `.kstack/reflexion-lessons.lock`.

Repair candidates belong only in the private `.kstack-repair-candidates` directory. Its `.gitignore` does not protect candidates from archives, Docker contexts, backups, snapshots, sync clients, editors, indexers, or agents.

An EUCLEAN-authorized repair preserves the old endpoint at `reflexion-lessons.json.euclean-quarantine` using a no-replace hard link and never removes or overwrites that forensic name. A non-regular directory endpoint is moved to a unique same-parent quarantine; KStack removes it only if empty and never recursively deletes it. Cleanup failures occur after the new corpus is committed and require operator inspection.

Runtime-contract and sentinel transitions are POSIX/WSL2-only. Native Windows direct dispatch fails before artifact admission. Corpus replacement’s separately testable Windows schedule retries sharing errors after exactly 50, 100, 200, 400, and 800 milliseconds without deleting the destination.
