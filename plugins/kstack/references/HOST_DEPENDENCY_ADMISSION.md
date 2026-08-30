# Host dependency admission

KStack host candidates fail closed on their complete target-specific normal and
build dependency closure. An upstream build, license badge, or partial audit is
not admission evidence.

## Required candidate policy

Each exact host/version/target/feature tuple must retain a machine-readable
`cargo-deny` policy (or an equivalent ecosystem-native policy) that binds:

- the exact target triple and enabled feature profile;
- yanked and known-vulnerable dependencies as denied, with no inherited or
  unused advisory exception;
- an explicit SPDX allowlist; absent, unrecognized, or unreviewed licenses are
  denied;
- crates.io as the only default registry and every Git source as an exact,
  candidate-reviewed repository plus immutable revision;
- every path or workspace package to explicit license metadata and retained
  source bytes; and
- the exact lockfile, policy, source-remediation patch, toolchain, and resulting
  artifact identities.

The KStack v1 technical allowlist is `0BSD`, `Apache-2.0`, `Apache-2.0 WITH
LLVM-exception`, `BSD-2-Clause`, `BSD-3-Clause`, `BSL-1.0`, `CC0-1.0`,
`CDLA-Permissive-2.0`, `ISC`, `MIT`, `MIT-0`, `MPL-2.0`, `Unicode-3.0`,
`Unlicense`, `Zlib`, and `bzip2-1.0.6`. Alternatives in an SPDX expression are
admitted only when at least one branch is allowlisted; conjunctive expressions
must have every required license allowlisted.

MPL-2.0 is admitted only with file-level source and notice preservation. A
distributed candidate must carry a complete machine-generated dependency SBOM,
third-party notices, exact corresponding-source retrieval data, and every
modified MPL-covered file. KStack may not claim a final artifact qualified from
the license-policy pass alone.

## Clean-room compatibility replacements

A replacement for a non-admitted dependency is allowed only when all of these
conditions are independently evidenced:

1. KStack authors the replacement without copying the rejected implementation.
2. The replacement exposes only the minimum API reachable from the candidate.
3. Its algorithm, tests, license, source, and package override are explicit.
4. The exact candidate compiles and its relevant behavior fixtures pass against
   the replacement.
5. The final source archive contains the replacement and its license; the build
   provenance binds it as a path dependency.
6. Independent final review approves the source-remediation threat model and
   confirms that the rejected dependency is absent from the resolved closure.

## Release promotion

License/source admission is necessary but not sufficient. Promotion also
requires two independently matching reproducible release-build digests, an SBOM
and notice bundle, static artifact admission, isolated runtime qualification,
adapter conformance, protected distinct evidence, and the staged independent
final review. Until every gate passes, the candidate remains non-executable and
cannot satisfy second-host breadth.

This is a technical distribution-control policy, not a substitute for legal
advice or a waiver of any license obligation.
