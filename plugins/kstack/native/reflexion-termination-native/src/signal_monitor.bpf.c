// Target-built CO-RE object. The qualified build supplies its digest-pinned
// vmlinux.h and libbpf headers; the privileged helper verifies the resulting
// object digest before libbpf performs CO-RE relocation and loading.
#include "vmlinux.h"
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_helpers.h>

char LICENSE[] SEC("license") = "GPL";

struct signal_identity {
  __u64 start_time_ticks;
  __u64 cgroup_id;
};

struct signal_event {
  __u64 t_event_ns;
  __u64 event_sequence;
  __u64 sender_pid;
  __u64 sender_tgid;
  __u64 target_pid;
  __u64 target_tgid;
  __u64 target_start_time_ticks;
  __u64 target_cgroup_id;
  __u32 cpu;
  __u32 signal_number;
  __u32 kind;
  __u32 reserved;
};

struct signal_generate_context {
  __u64 unused;
  int signal_number;
  int error_number;
  int code;
  char comm[16];
  int target_pid;
  int group;
  int result;
};

struct signal_deliver_context {
  __u64 unused;
  int signal_number;
  int error_number;
  int code;
  unsigned long handler;
  unsigned long flags;
};

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __uint(max_entries, 1);
  __type(key, __u32);
  __type(value, __u64);
} produced_count SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __uint(max_entries, 1);
  __type(key, __u32);
  __type(value, __u64);
} reservation_failure_count SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __uint(max_entries, 1);
  __type(key, __u32);
  __type(value, __u64);
} map_failure_count SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __uint(max_entries, 1);
  __type(key, __u32);
  __type(value, __u64);
} event_sequence SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __uint(max_entries, 1);
  __type(key, __u32);
  __type(value, struct signal_identity);
} workload_identity SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 20);
} events SEC(".maps");

static __always_inline int retain_signal(__u32 signal_number, __u32 kind, __u32 target_pid, __u32 target_tgid, __u64 target_start, __u64 target_cgroup) {
  __u32 zero = 0;
  __u64 *produced = bpf_map_lookup_elem(&produced_count, &zero);
  __u64 *sequence = bpf_map_lookup_elem(&event_sequence, &zero);
  if (!produced || !sequence) {
    __u64 *failures = bpf_map_lookup_elem(&map_failure_count, &zero);
    if (failures) __sync_fetch_and_add(failures, 1);
    return 0;
  }
  __sync_fetch_and_add(produced, 1);
  __u64 next_sequence = __sync_add_and_fetch(sequence, 1);
  struct signal_event *event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
  if (!event) {
    __u64 *failures = bpf_map_lookup_elem(&reservation_failure_count, &zero);
    if (failures) __sync_fetch_and_add(failures, 1);
    else {
      failures = bpf_map_lookup_elem(&map_failure_count, &zero);
      if (failures) __sync_fetch_and_add(failures, 1);
    }
    return 0;
  }
  __u64 sender = bpf_get_current_pid_tgid();
  event->t_event_ns = bpf_ktime_get_ns(); event->event_sequence = next_sequence;
  event->sender_pid = (__u32)sender; event->sender_tgid = sender >> 32;
  event->target_pid = target_pid; event->target_tgid = target_tgid;
  event->target_start_time_ticks = target_start; event->target_cgroup_id = target_cgroup;
  event->cpu = bpf_get_smp_processor_id(); event->signal_number = signal_number; event->kind = kind; event->reserved = 0;
  bpf_ringbuf_submit(event, 0); return 0;
}

SEC("tracepoint/signal/signal_generate")
int kstack_signal_generate(struct signal_generate_context *context) {
  __u32 target = (__u32)context->target_pid;
  struct signal_identity *identity = bpf_map_lookup_elem(&workload_identity, &target);
  if (!identity) return 0;
  return retain_signal((__u32)context->signal_number, 1, target, target, identity->start_time_ticks, identity->cgroup_id);
}

SEC("tracepoint/signal/signal_deliver")
int kstack_signal_deliver(struct signal_deliver_context *context) {
  __u64 current = bpf_get_current_pid_tgid(); __u32 target = (__u32)current; __u32 tgid = current >> 32;
  struct signal_identity *identity = bpf_map_lookup_elem(&workload_identity, &target);
  if (!identity) return 0;
  return retain_signal((__u32)context->signal_number, 2, target, tgid, identity->start_time_ticks, identity->cgroup_id);
}
