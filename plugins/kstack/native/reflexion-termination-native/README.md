# Reflexion termination native backend

`kstack-reflexion-termination-native` is a Linux-only privileged helper. It is
not a syscall simulator. Its production paths invoke `clone3`, pidfd `waitid`,
timerfd, epoll, capability, seccomp, BPF map, perf-event, BPF link, affinity,
real-time scheduling, memory-locking, and ring-buffer syscalls directly.

The helper is built with:

```text
npm run build:termination-native
```

The default output is under the ignored `.kstack/native-build/` directory.
`describe`, `capabilities`, `deadline-probe`, and `clone3-argument-probe` are
non-mutating inspection/qualification commands. `bpf-probe` creates real
preallocated per-CPU counter maps and a real BPF ring buffer, then closes them.

`monitor-object` is the production BPF entry point. It requires a SHA-256-pinned
CO-RE object, a dedicated monitor CPU, and the admitted capabilities. It uses
libbpf only to relocate/load the object, verifies the exact program and map
names/types, attaches `signal_generate` and `signal_deliver` with persistent
`BPF_LINK_CREATE` links on every online CPU, and consumes the ring through
epoll and the kernel mmap ring protocol into preallocated locked memory.
`monitor-once` is the lower-level inherited-fd form for a privileged service
that already owns the pinned program and map descriptors.

`supervise` requires an inherited cgroup-v2 directory fd, distinct deadline
detector CPU, workload UID/GID/nice value,
absolute-policy duration, exact seccomp filter file and SHA-256, and a command.
It creates the timerfd and epoll set before launch, calls
`clone3(CLONE_INTO_CGROUP|CLONE_PIDFD)`, verifies the blocked child's cgroup,
UID/GID, groups, capability masks, securebits, `NoNewPrivs`, seccomp mode, and
descriptor set, arms the absolute timer, and only then releases `execvp`.
Pidfd `waitid` is attempted first after every epoll return and recovery signals
are sent through the pidfd.

The BPF source is `src/signal_monitor.bpf.c`. Target qualification supplies and
pins `vmlinux.h`, libbpf headers/toolchain, verifier log, BTF, tracepoint
formats, and the resulting object digest. The source increments `produced`
before ring reservation, maintains a strictly increasing per-CPU sequence,
and has separate nonwrapping reservation/map-failure counters.

The securebits operation intentionally occurs while `CAP_SETPCAP` is still
effective, immediately before the UID/GID transition and final capability
clear. Linux does not permit changing or locking securebits after the effective
and permitted capability sets have already been cleared. Post-drop rereads,
not operation ordering alone, are the acceptance condition.
