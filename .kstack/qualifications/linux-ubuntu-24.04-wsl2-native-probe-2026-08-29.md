# Ubuntu 24.04 WSL2 native probe evidence — 2026-08-29

This evidence corrects the earlier observation made inside the managed Codex
PID namespace. It qualifies one platform-observation cell only. It does not
qualify a lifecycle, any privileged backend, or the four-cell Linux program.

## Execution boundary

The probe was launched from Windows with `wsl.exe -d Ubuntu -- ...`, outside
the managed Codex PID namespace. The installed distro was Ubuntu running as
WSL2. No package was installed, no privilege escalation was requested, no
cgroup controller was mutated, and no eBPF program was loaded.

Observed at `2026-08-29T21:09:54.000Z`:

- Ubuntu 24.04.3 LTS on x86_64.
- Kernel `6.18.33.2-microsoft-standard-WSL2`.
- PID 1 is `systemd`; `systemctl is-system-running` returned `running`.
- `/tmp` resolves to `/dev/sdd` with filesystem type `ext4`.
- Package manager is apt 2.8.3.
- cgroup v2 is mounted read-write and exposes controllers.
- Kernel BTF exists; `kernel.unprivileged_bpf_disabled` is `2`.
- `pidfd_open` succeeded for the probe's own process.
- Effective and permitted capability masks were zero. The probe therefore did
  not establish CAP_BPF, CAP_SYS_ADMIN, CAP_SYS_PTRACE, controller mutation, or
  any cross-principal privileged lifecycle.

## Raw-output bindings

Each row binds the exact raw output by byte count and SHA-256. The raw files
were staged under `/tmp/kstack-linux-wsl-native-probe`; this durable record and
the retained JSON carry the evidence identity.

| Output | Bytes | SHA-256 |
|---|---:|---|
| `os-release` | 400 | `3e5851448bae5b36f351becde037a8b13b77307279f484eda808f8177d9a4293` |
| `kernel.txt` | 99 | `c6c4476e3ee889d303b364385b38904d0d28f883a04c12b0ff081e20246e0ff7` |
| `filesystem.json` | 200 | `ca3f5070c196bf9a9a667dee15bc65d43d9b2736ccdaba7f98e21d38c6eeff92` |
| `init-comm.txt` | 8 | `12e6ff4feb1b552a431b41d3935d33f08f9d75ddb8a88f645f4cf231bc05e820` |
| `init-state.txt` | 8 | `a4ecc5c87d811bbff7a118c17ef8cf83318cb623a103c15b8549089aa2a7f0ac` |
| `systemd-version.txt` | 330 | `24e682030f54829600ce9c96ef9d8be4297eb4cd1b11eca8fa7f83c5c4595fc7` |
| `package-manager.txt` | 18 | `62614c8443b2ca3516ba8253d39c9bfa64615211180cb9197d7d693ac8418865` |
| `capability-status.txt` | 125 | `8531c27c54d14c3b9eb8d38d2c72aa047eb692c6ee067cd069d5f0322e1dcba2` |
| `capabilities.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `cgroup-controllers.txt` | 39 | `5bcebcfaf6c1982791d93e1f1b4327d7026ecbb7f993f4ea3bb6e424d245aa30` |
| `cgroup-mount.json` | 207 | `0f84ff5b51acea8dddb979523ba90a977af9b30a90f254c060558ff657666cca` |
| `btf-vmlinux.txt` | 25 | `9dc43786ed1824f91d078a9513decd5b0c5023088c519d7d4f3b4166c532f667` |
| `unprivileged-bpf-disabled.txt` | 2 | `53c234e5e8472b6ac51c1ae1cab3fe06fad053beb8ebfd8977b010655bfdd3c3` |
| `pidfd-self.txt` | 5 | `a9ac0c3ac83c40e1b4c3416066d63d324ee9f8c144641dfeed72d140b6557245` |

## Composite digests

Backend and init evidence use composite digests. For each group, files are
listed in the fixed order below as objects with `name`, `bytes`, and `sha256`;
the evidence digest is SHA-256 of `JSON.stringify(rows)` with no whitespace.

- init (`init-comm.txt`, `init-state.txt`, `systemd-version.txt`):
  `393fa83d510ce4a11f0c3c0606df48a18056a80f6f17fa15a4205df4935de939`
- cgroup v2 (`capability-status.txt`, `capabilities.txt`,
  `cgroup-controllers.txt`, `cgroup-mount.json`):
  `1bee786f02cbf2f41b09ff1d3215fafd39e9e6f386b7a3d02c1bfde12b3ee13e`
- eBPF (`capability-status.txt`, `capabilities.txt`, `btf-vmlinux.txt`,
  `unprivileged-bpf-disabled.txt`):
  `3e27229efe9f6863780cdb9de036385bc4d0a5b4e6a7b1a5c15dd56d0cd2be3d`
- pidfd (`capability-status.txt`, `capabilities.txt`, `pidfd-self.txt`):
  `6785ce4942995902326c44a26ac519cd14118571f57b5a24e22b8ece730a5316`

## Admission result

The WSL2 platform observation is current through
`2026-09-28T21:09:54.000Z`. cgroup v2 and pidfd remain `SEAM_TESTED`; eBPF
remains `UNAVAILABLE`. Feature presence cannot promote a backend without
authorized, observed privileged execution. No lifecycle record was issued.
