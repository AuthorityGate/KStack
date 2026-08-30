# Linux qualification bundles

Linux matrix closure is based on retained evidence bytes, not caller-supplied
digest claims. Each native qualification console must build one exact
`kstack-linux-qualification-bundle-v1` directory and submit it with the
installed runtime command:

```bash
node scripts/kstack-linux-qualification-bundle.mjs admit \
  --root /absolute/path/to/bundle \
  --out /absolute/path/to/qualification-receipt.json
```

The output must be outside the bundle. Admission uses the current UTC time; a
caller cannot choose a more favorable evaluation instant.

## Per-console observation collection

Before a complete lifecycle/backend bundle is available, an exact console may
collect one platform observation with the installed, non-privileged worker:

```bash
bash workers/kstack-linux-observation-collect.sh \
  --cell-id ubuntu-lts-native-x64 \
  --out /absolute/private/new/collection
```

Transfer the complete six-file directory back to the installed runtime without
editing it, then admit it locally:

```bash
node scripts/kstack-linux-observation-admit.mjs admit \
  --root /absolute/private/collection \
  --out /absolute/private/ubuntu-native-observation.json
```

The collector reads only distro, kernel, `/tmp` mount, PID 1/systemd, and
package-manager facts. It installs nothing and requests no privilege. Admission
opens and secret-scans every exact byte, requires the collector digest to match
the installed worker, rejects extra files and symlinks, derives rather than
trusts the native-filesystem and target bindings, and evaluates currentness at
the verifier's clock. A per-console receipt qualifies one observation only. It
does not qualify clean install/upgrade/rollback/recovery, cgroup v2, eBPF,
pidfd, another distro, or the four-cell program.

Moving the collector to an external console is an outbound source transfer.
The active host must obtain whatever exact destination/payload authorization
its safety boundary requires; it must not reconstruct or transmit the worker
through an alternate channel after a transfer denial.

## Exact bundle

The root contains only `manifest.json`, the three canonical JSON records for
each of the four closed cells, and the evidence artifacts named by the
manifest. The cell order is:

1. `debian-stable-native-x64`
2. `fedora-stable-native-x64`
3. `ubuntu-lts-native-x64`
4. `ubuntu-lts-wsl2-x64`

Each cell has `observation`, `lifecycle`, and `backends` descriptors plus a
path-sorted `artifacts` array. Every descriptor has exactly `path` and
`sha256`. Record JSON uses the deterministic bytes produced by
`linuxQualificationCanonicalBytes()`. Its field contracts are the inputs to
`validateLinuxCellObservation()`, `validateLinuxLifecycle()`, and
`validateLinuxBackendQualification()`.

The artifact inventory must cover exactly every distinct evidence digest
referenced by those records. Unreferenced files, missing evidence, substituted
bytes, symlinks, writable files or directories, noncanonical JSON, duplicate
or missing cells, stale evidence, future-time evaluation, non-native storage,
failed lifecycle steps, and seam-tested or unavailable privileged backends all
fail closed. The complete bundle is secret-scanned before admission.

The receipt qualifies only the exact four-cell Linux program. It does not grant
host authority, activate a runtime, approve independent review, close Jira, or
update the runtime maturity report.
