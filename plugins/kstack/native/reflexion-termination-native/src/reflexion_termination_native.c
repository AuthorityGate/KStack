#define _GNU_SOURCE

#include <dirent.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <linux/bpf.h>
#include <linux/capability.h>
#include <linux/filter.h>
#include <linux/perf_event.h>
#include <linux/sched.h>
#include <linux/seccomp.h>
#include <linux/securebits.h>
#include <openssl/sha.h>
#include <sched.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/epoll.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/timerfd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#ifndef P_PIDFD
#define P_PIDFD 3
#endif
#ifndef CLOSE_RANGE_UNSHARE
#define CLOSE_RANGE_UNSHARE (1U << 1)
#endif
#ifndef BPF_F_MMAPABLE
#define BPF_F_MMAPABLE (1U << 10)
#endif

#define ABI_VERSION "kstack-reflexion-termination-native-abi-v1"
#define DEADLINE_LATENCY_LIMIT_NS UINT64_C(1000000)
#define READY_MAGIC UINT64_C(0x4b535441434b5259)
#define RING_BUSY_BIT (1U << 31)
#define RING_DISCARD_BIT (1U << 30)
#define RING_LEN_MASK ((1U << 30) - 1)

struct ready_record {
  uint64_t magic;
  uint32_t uid;
  uint32_t gid;
  uint64_t securebits;
  uint32_t no_new_privs;
  uint32_t seccomp_mode;
  char seccomp_filter_identity[65];
};

struct capability_requirement {
  int number;
  const char *name;
};

static const struct capability_requirement k_required_caps[] = {
  {CAP_SETGID, "CAP_SETGID"}, {CAP_SETUID, "CAP_SETUID"},
  {CAP_SETPCAP, "CAP_SETPCAP"}, {CAP_IPC_LOCK, "CAP_IPC_LOCK"},
  {CAP_SYS_NICE, "CAP_SYS_NICE"}, {CAP_SYS_RESOURCE, "CAP_SYS_RESOURCE"},
  {CAP_PERFMON, "CAP_PERFMON"}, {CAP_BPF, "CAP_BPF"}
};

static int parse_u64(const char *value, uint64_t *result);
static int add_epoll(int epollfd, int fd, uint64_t tag);

static void json_string(const char *value) {
  putchar('"');
  for (const unsigned char *p = (const unsigned char *)value; *p; ++p) {
    if (*p == '"' || *p == '\\') putchar('\\');
    if (*p >= 0x20 && *p < 0x7f) putchar(*p);
  }
  putchar('"');
}

static int emit_error(const char *code, const char *operation) {
  int saved = errno;
  fputs("{\"abiVersion\":\"" ABI_VERSION "\",\"ok\":false,\"code\":", stdout);
  json_string(code);
  fputs(",\"operation\":", stdout); json_string(operation);
  fprintf(stdout, ",\"errno\":%d,\"errnoName\":", saved);
  json_string(strerror(saved));
  fputs("}\n", stdout);
  return 2;
}

static int monotonic_now(uint64_t *result) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC, &value) != 0 || value.tv_sec < 0 || value.tv_nsec < 0) return -1;
  if ((uint64_t)value.tv_sec > (UINT64_MAX - (uint64_t)value.tv_nsec) / UINT64_C(1000000000)) { errno = EOVERFLOW; return -1; }
  *result = (uint64_t)value.tv_sec * UINT64_C(1000000000) + (uint64_t)value.tv_nsec;
  return 0;
}

static struct timespec ns_to_timespec(uint64_t ns) {
  struct timespec result = { .tv_sec = (time_t)(ns / UINT64_C(1000000000)), .tv_nsec = (long)(ns % UINT64_C(1000000000)) };
  return result;
}

static int write_all(int fd, const void *buffer, size_t length) {
  const unsigned char *cursor = buffer;
  while (length) {
    ssize_t count = write(fd, cursor, length);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return -1;
    cursor += (size_t)count; length -= (size_t)count;
  }
  return 0;
}

static int read_all(int fd, void *buffer, size_t length) {
  unsigned char *cursor = buffer;
  while (length) {
    ssize_t count = read(fd, cursor, length);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return -1;
    cursor += (size_t)count; length -= (size_t)count;
  }
  return 0;
}

static int load_seccomp_filter(const char *path, const char *expected_sha256, struct sock_filter **instructions, size_t *count) {
  if (!path || !expected_sha256 || strlen(expected_sha256) != 64) { errno = EINVAL; return -1; }
  int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW); if (fd < 0) return -1;
  struct stat status;
  if (fstat(fd, &status) != 0 || !S_ISREG(status.st_mode) || status.st_size <= 0 || status.st_size > 4096 * (off_t)sizeof(struct sock_filter) || status.st_size % (off_t)sizeof(struct sock_filter) != 0) { close(fd); errno = EINVAL; return -1; }
  size_t length = (size_t)status.st_size; unsigned char *bytes = malloc(length);
  if (!bytes || read_all(fd, bytes, length) != 0) { close(fd); free(bytes); return -1; }
  close(fd);
  unsigned char digest[SHA256_DIGEST_LENGTH]; char hexadecimal[SHA256_DIGEST_LENGTH * 2U + 1U];
  SHA256(bytes, length, digest);
  for (size_t i = 0; i < SHA256_DIGEST_LENGTH; ++i) snprintf(hexadecimal + i * 2U, 3, "%02x", digest[i]);
  if (strcmp(hexadecimal, expected_sha256) != 0) { free(bytes); errno = EBADMSG; return -1; }
  *instructions = (struct sock_filter *)bytes; *count = length / sizeof(struct sock_filter); return 0;
}

static int file_sha256_matches(const char *path, const char *expected_sha256) {
  if (!path || !expected_sha256 || strlen(expected_sha256) != 64) { errno = EINVAL; return -1; }
  int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW); if (fd < 0) return -1;
  SHA256_CTX context; if (SHA256_Init(&context) != 1) { close(fd); errno = EIO; return -1; }
  unsigned char buffer[65536], digest[SHA256_DIGEST_LENGTH]; ssize_t count;
  while ((count = read(fd, buffer, sizeof(buffer))) != 0) {
    if (count < 0 && errno == EINTR) continue;
    if (count < 0 || SHA256_Update(&context, buffer, (size_t)count) != 1) { close(fd); errno = EIO; return -1; }
  }
  close(fd); if (SHA256_Final(digest, &context) != 1) { errno = EIO; return -1; }
  char hexadecimal[SHA256_DIGEST_LENGTH * 2U + 1U];
  for (size_t i = 0; i < SHA256_DIGEST_LENGTH; ++i) snprintf(hexadecimal + i * 2U, 3, "%02x", digest[i]);
  if (strcmp(hexadecimal, expected_sha256) != 0) { errno = EBADMSG; return -1; }
  return 0;
}

static int capget_current(struct __user_cap_data_struct data[2]) {
  struct __user_cap_header_struct header = { .version = _LINUX_CAPABILITY_VERSION_3, .pid = 0 };
  return (int)syscall(SYS_capget, &header, data);
}

static int capset_current(const struct __user_cap_data_struct data[2]) {
  struct __user_cap_header_struct header = { .version = _LINUX_CAPABILITY_VERSION_3, .pid = 0 };
  return (int)syscall(SYS_capset, &header, data);
}

static int capability_effective(const struct __user_cap_data_struct data[2], int capability) {
  return (data[capability / 32].effective & (1U << (capability % 32))) != 0;
}

static int require_capabilities(int include_sys_admin) {
  struct __user_cap_data_struct data[2] = {{0}};
  if (capget_current(data) != 0) return -1;
  for (size_t i = 0; i < sizeof(k_required_caps) / sizeof(k_required_caps[0]); ++i) if (!capability_effective(data, k_required_caps[i].number)) { errno = EPERM; return -1; }
  if (include_sys_admin && !capability_effective(data, CAP_SYS_ADMIN)) { errno = EPERM; return -1; }
  return 0;
}

static void emit_capability_array(int include_sys_admin) {
  putchar('[');
  for (size_t i = 0; i < sizeof(k_required_caps) / sizeof(k_required_caps[0]); ++i) {
    if (i) putchar(',');
    json_string(k_required_caps[i].name);
  }
  if (include_sys_admin) { putchar(','); json_string("CAP_SYS_ADMIN"); }
  putchar(']');
}

static int describe(void) {
  fputs("{\"abiVersion\":\"" ABI_VERSION "\",\"platform\":\"linux\",\"clone3\":{\"flags\":[\"CLONE_INTO_CGROUP\",\"CLONE_PIDFD\"],\"exitSignal\":\"SIGCHLD\"},\"deadline\":{\"clock\":\"CLOCK_MONOTONIC\",\"timerFlags\":[\"TFD_CLOEXEC\",\"TFD_NONBLOCK\",\"TFD_TIMER_ABSTIME\"],\"waitPrimitive\":\"epoll_wait\",\"exitObservation\":\"waitid(P_PIDFD,WEXITED|WNOWAIT|WNOHANG)\",\"latencyLimitNs\":1000000},\"signalMonitor\":{\"tracepoints\":[\"signal_generate\",\"signal_deliver\"],\"attachment\":\"BPF_LINK_CREATE/BPF_PERF_EVENT\",\"maps\":[\"BPF_MAP_TYPE_PERCPU_ARRAY\",\"BPF_MAP_TYPE_RINGBUF\"],\"consumer\":\"epoll+mmap-ring-drain\"},\"requiredCapabilities\":", stdout);
  emit_capability_array(0);
  fputs(",\"conditionalCapabilities\":[\"CAP_SYS_ADMIN\"]}\n", stdout);
  return 0;
}

static int capabilities(void) {
  struct __user_cap_data_struct data[2] = {{0}};
  if (capget_current(data) != 0) return emit_error("CAPABILITY_QUERY_FAILED", "capget");
  fputs("{\"abiVersion\":\"" ABI_VERSION "\",\"ok\":true,\"required\":", stdout); emit_capability_array(0); fputs(",\"missing\":[", stdout);
  int first = 1;
  for (size_t i = 0; i < sizeof(k_required_caps) / sizeof(k_required_caps[0]); ++i) if (!capability_effective(data, k_required_caps[i].number)) {
    if (!first) putchar(',');
    json_string(k_required_caps[i].name);
    first = 0;
  }
  fputs("]}\n", stdout);
  return 0;
}

static int deadline_probe(void) {
  int timerfd = timerfd_create(CLOCK_MONOTONIC, TFD_CLOEXEC | TFD_NONBLOCK);
  if (timerfd < 0) return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "timerfd_create");
  int epollfd = epoll_create1(EPOLL_CLOEXEC);
  if (epollfd < 0) { close(timerfd); return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "epoll_create1"); }
  struct epoll_event registration = { .events = EPOLLIN, .data.u64 = 1 };
  if (epoll_ctl(epollfd, EPOLL_CTL_ADD, timerfd, &registration) != 0) { close(epollfd); close(timerfd); return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "epoll_ctl"); }
  uint64_t before, deadline, observed;
  if (monotonic_now(&before) != 0 || before > UINT64_MAX - UINT64_C(5000000)) { close(epollfd); close(timerfd); return emit_error("CLOCK_CONTRACT_VIOLATION", "clock_gettime"); }
  deadline = before + UINT64_C(5000000);
  struct itimerspec specification = { .it_value = ns_to_timespec(deadline) };
  if (timerfd_settime(timerfd, TFD_TIMER_ABSTIME, &specification, NULL) != 0) { close(epollfd); close(timerfd); return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "timerfd_settime"); }
  struct epoll_event event;
  int ready;
  do ready = epoll_wait(epollfd, &event, 1, 1000); while (ready < 0 && errno == EINTR);
  uint64_t expirations = 0;
  if (ready != 1 || read(timerfd, &expirations, sizeof(expirations)) != (ssize_t)sizeof(expirations) || monotonic_now(&observed) != 0 || observed < deadline) { close(epollfd); close(timerfd); return emit_error("MONITOR_GAP", "deadline-wake"); }
  uint64_t latency = observed - deadline;
  fprintf(stdout, "{\"abiVersion\":\"%s\",\"ok\":true,\"deadlineNs\":%llu,\"observedNs\":%llu,\"latencyNs\":%llu,\"failureCodes\":[", ABI_VERSION, (unsigned long long)deadline, (unsigned long long)observed, (unsigned long long)latency);
  if (latency > DEADLINE_LATENCY_LIMIT_NS) fputs("\"MONITOR_GAP\"", stdout);
  fputs("]}\n", stdout);
  close(epollfd); close(timerfd); return 0;
}

static int bpf_call(enum bpf_cmd command, union bpf_attr *attribute) {
  return (int)syscall(SYS_bpf, command, attribute, sizeof(*attribute));
}

static int create_percpu_counter(const char *name) {
  union bpf_attr attribute; memset(&attribute, 0, sizeof(attribute));
  attribute.map_type = BPF_MAP_TYPE_PERCPU_ARRAY; attribute.key_size = sizeof(uint32_t); attribute.value_size = sizeof(uint64_t); attribute.max_entries = 1;
  strncpy((char *)attribute.map_name, name, BPF_OBJ_NAME_LEN - 1);
  return bpf_call(BPF_MAP_CREATE, &attribute);
}

static int create_ringbuf(uint32_t bytes) {
  union bpf_attr attribute; memset(&attribute, 0, sizeof(attribute));
  attribute.map_type = BPF_MAP_TYPE_RINGBUF; attribute.max_entries = bytes;
  strncpy((char *)attribute.map_name, "ks_signal_ring", BPF_OBJ_NAME_LEN - 1);
  return bpf_call(BPF_MAP_CREATE, &attribute);
}

static int bpf_probe(void) {
  if (require_capabilities(0) != 0) return emit_error("CAPABILITY_REQUIREMENTS_UNMET", "bpf-map-setup");
  const char *names[] = {"ks_produced", "ks_reserve_fail", "ks_map_fail", "ks_sequence"};
  int fds[5] = {-1,-1,-1,-1,-1};
  for (int i = 0; i < 4; ++i) if ((fds[i] = create_percpu_counter(names[i])) < 0) { for (int j = 0; j < i; ++j) close(fds[j]); return emit_error("MONITOR_GAP", "BPF_MAP_CREATE/percpu-array"); }
  if ((fds[4] = create_ringbuf(65536)) < 0) { for (int i = 0; i < 4; ++i) close(fds[i]); return emit_error("MONITOR_GAP", "BPF_MAP_CREATE/ringbuf"); }
  fputs("{\"abiVersion\":\"" ABI_VERSION "\",\"ok\":true,\"createdPerCpuMaps\":4,\"createdRingBuffers\":1}\n", stdout);
  for (int i = 0; i < 5; ++i) close(fds[i]);
  return 0;
}

static int read_tracepoint_id(const char *name) {
  char path[256]; snprintf(path, sizeof(path), "/sys/kernel/tracing/events/signal/%s/id", name);
  FILE *file = fopen(path, "re");
  int id = -1;
  if (!file || fscanf(file, "%d", &id) != 1 || id <= 0) id = -1;
  if (file) fclose(file);
  return id;
}

static int perf_tracepoint_open(int tracepoint_id, int cpu) {
  struct perf_event_attr attribute; memset(&attribute, 0, sizeof(attribute));
  attribute.type = PERF_TYPE_TRACEPOINT; attribute.size = sizeof(attribute); attribute.config = (uint64_t)(unsigned int)tracepoint_id;
  attribute.sample_period = 1; attribute.wakeup_events = 1; attribute.disabled = 1;
  return (int)syscall(SYS_perf_event_open, &attribute, -1, cpu, -1, PERF_FLAG_FD_CLOEXEC);
}

static int create_perf_bpf_link(int program_fd, int perf_fd) {
  union bpf_attr attribute; memset(&attribute, 0, sizeof(attribute));
  attribute.link_create.prog_fd = (uint32_t)program_fd; attribute.link_create.target_fd = (uint32_t)perf_fd; attribute.link_create.attach_type = BPF_PERF_EVENT;
  return bpf_call(BPF_LINK_CREATE, &attribute);
}

struct ring_consumer {
  size_t page_size;
  uint64_t ring_size;
  uint64_t *consumer_position;
  uint64_t *producer_position;
  unsigned char *data;
  unsigned char *producer_mapping;
  size_t producer_mapping_length;
  unsigned char *retained;
  size_t retained_capacity;
  size_t retained_length;
  uint64_t retained_records;
};

static int ring_consumer_open(int map_fd, struct ring_consumer *consumer) {
  union bpf_attr attribute; memset(&attribute, 0, sizeof(attribute));
  struct bpf_map_info info; memset(&info, 0, sizeof(info));
  attribute.info.bpf_fd = (uint32_t)map_fd; attribute.info.info_len = sizeof(info); attribute.info.info = (uint64_t)(uintptr_t)&info;
  if (bpf_call(BPF_OBJ_GET_INFO_BY_FD, &attribute) != 0 || info.type != BPF_MAP_TYPE_RINGBUF || info.max_entries == 0 || (info.max_entries & (info.max_entries - 1U)) != 0) { errno = EINVAL; return -1; }
  consumer->page_size = (size_t)sysconf(_SC_PAGESIZE); consumer->ring_size = info.max_entries;
  consumer->consumer_position = mmap(NULL, consumer->page_size, PROT_READ | PROT_WRITE, MAP_SHARED, map_fd, 0);
  if (consumer->consumer_position == MAP_FAILED) return -1;
  consumer->producer_mapping_length = consumer->page_size + 2U * (size_t)info.max_entries;
  consumer->producer_mapping = mmap(NULL, consumer->producer_mapping_length, PROT_READ, MAP_SHARED, map_fd, (off_t)consumer->page_size);
  if (consumer->producer_mapping == MAP_FAILED) { munmap(consumer->consumer_position, consumer->page_size); return -1; }
  consumer->producer_position = (uint64_t *)consumer->producer_mapping; consumer->data = consumer->producer_mapping + consumer->page_size;
  consumer->retained_capacity = (size_t)info.max_entries; consumer->retained = malloc(consumer->retained_capacity);
  if (!consumer->retained || mlock(consumer->retained, consumer->retained_capacity) != 0) return -1;
  return 0;
}

static void ring_consumer_close(struct ring_consumer *consumer) {
  if (consumer->retained) { munlock(consumer->retained, consumer->retained_capacity); free(consumer->retained); }
  if (consumer->producer_mapping && consumer->producer_mapping != MAP_FAILED) munmap(consumer->producer_mapping, consumer->producer_mapping_length);
  if (consumer->consumer_position && consumer->consumer_position != MAP_FAILED) munmap(consumer->consumer_position, consumer->page_size);
}

static size_t round_up_8(size_t value) { return (value + 7U) & ~((size_t)7U); }

static int ring_consume_available(struct ring_consumer *consumer) {
  uint64_t position = __atomic_load_n(consumer->consumer_position, __ATOMIC_ACQUIRE);
  const uint64_t producer = __atomic_load_n(consumer->producer_position, __ATOMIC_ACQUIRE);
  while (position < producer) {
    unsigned char *record = consumer->data + (position & (consumer->ring_size - 1U));
    uint32_t length_flags = __atomic_load_n((uint32_t *)record, __ATOMIC_ACQUIRE);
    if ((length_flags & RING_BUSY_BIT) != 0) break;
    size_t length = (size_t)(length_flags & RING_LEN_MASK); size_t total = round_up_8(sizeof(uint64_t) + length);
    if (length > consumer->retained_capacity - consumer->retained_length || total > consumer->ring_size) { errno = ENOBUFS; return -1; }
    if ((length_flags & RING_DISCARD_BIT) == 0) {
      memcpy(consumer->retained + consumer->retained_length, record + sizeof(uint64_t), length);
      consumer->retained_length += length; consumer->retained_records += 1;
    }
    position += total;
    __atomic_store_n(consumer->consumer_position, position, __ATOMIC_RELEASE);
  }
  return 0;
}

static int monitor_once(int argc, char **argv) {
  int generate_program = -1, deliver_program = -1, ring_map = -1, monitor_cpu = -1, timeout_ms = 1000, include_sys_admin = 0;
  for (int i = 2; i < argc; ++i) {
    if (strcmp(argv[i], "--require-sys-admin") == 0) { include_sys_admin = 1; continue; }
    if (i + 1 >= argc) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    uint64_t value;
    if (parse_u64(argv[i + 1], &value) != 0 || value > INT32_MAX) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    if (strcmp(argv[i], "--generate-prog-fd") == 0) generate_program = (int)value;
    else if (strcmp(argv[i], "--deliver-prog-fd") == 0) deliver_program = (int)value;
    else if (strcmp(argv[i], "--ring-map-fd") == 0) ring_map = (int)value;
    else if (strcmp(argv[i], "--monitor-cpu") == 0) monitor_cpu = (int)value;
    else if (strcmp(argv[i], "--timeout-ms") == 0) timeout_ms = (int)value;
    else { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    ++i;
  }
  if (generate_program < 0 || deliver_program < 0 || ring_map < 0 || monitor_cpu < 0 || timeout_ms < 0) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "monitor-once"); }
  if (require_capabilities(include_sys_admin) != 0) return emit_error("CAPABILITY_REQUIREMENTS_UNMET", "signal-monitor");
  cpu_set_t affinity; CPU_ZERO(&affinity); CPU_SET((unsigned int)monitor_cpu, &affinity);
  struct sched_param scheduling = { .sched_priority = 80 };
  if (sched_setaffinity(0, sizeof(affinity), &affinity) != 0 || sched_setscheduler(0, SCHED_FIFO, &scheduling) != 0 || mlockall(MCL_CURRENT | MCL_FUTURE) != 0) return emit_error("MONITOR_GAP", "signal-monitor-scheduling");
  struct ring_consumer consumer; memset(&consumer, 0, sizeof(consumer));
  if (ring_consumer_open(ring_map, &consumer) != 0) return emit_error("MONITOR_GAP", "ring-consumer-mmap");
  int generate_id = read_tracepoint_id("signal_generate"), deliver_id = read_tracepoint_id("signal_deliver");
  if (generate_id < 0 || deliver_id < 0) { ring_consumer_close(&consumer); return emit_error("MONITOR_GAP", "tracepoint-id"); }
  long cpu_count = sysconf(_SC_NPROCESSORS_CONF); if (cpu_count <= 0 || cpu_count > 4096) { ring_consumer_close(&consumer); errno = EOVERFLOW; return emit_error("MONITOR_GAP", "online-cpu-count"); }
  int *perf_fds = calloc((size_t)cpu_count * 2U, sizeof(int)); int *link_fds = calloc((size_t)cpu_count * 2U, sizeof(int));
  if (!perf_fds || !link_fds) { ring_consumer_close(&consumer); errno = ENOMEM; return emit_error("MONITOR_GAP", "preallocation"); }
  for (long i = 0; i < cpu_count * 2; ++i) { perf_fds[i] = -1; link_fds[i] = -1; }
  int attached = 0;
  for (int kind = 0; kind < 2; ++kind) for (int cpu = 0; cpu < cpu_count; ++cpu) {
    int index = kind * (int)cpu_count + cpu; int trace_id = kind == 0 ? generate_id : deliver_id; int program = kind == 0 ? generate_program : deliver_program;
    perf_fds[index] = perf_tracepoint_open(trace_id, cpu);
    if (perf_fds[index] < 0 && (errno == ENODEV || errno == EINVAL)) continue;
    if (perf_fds[index] < 0 || (link_fds[index] = create_perf_bpf_link(program, perf_fds[index])) < 0 || ioctl(perf_fds[index], PERF_EVENT_IOC_ENABLE, 0) != 0) {
      for (long j = 0; j < cpu_count * 2; ++j) { if (link_fds[j] >= 0) close(link_fds[j]); if (perf_fds[j] >= 0) close(perf_fds[j]); }
      free(link_fds); free(perf_fds); ring_consumer_close(&consumer); return emit_error("MONITOR_GAP", "persistent-bpf-link-attach");
    }
    attached += 1;
  }
  int epollfd = epoll_create1(EPOLL_CLOEXEC);
  if (epollfd < 0 || add_epoll(epollfd, ring_map, 3) != 0) return emit_error("MONITOR_GAP", "ring-epoll-register");
  struct epoll_event event; int ready;
  do ready = epoll_wait(epollfd, &event, 1, timeout_ms); while (ready < 0 && errno == EINTR);
  if (ready < 0 || (ready > 0 && ring_consume_available(&consumer) != 0)) return emit_error("MONITOR_GAP", "ring-epoll-consume");
  fprintf(stdout, "{\"abiVersion\":\"%s\",\"ok\":true,\"persistentLinkCount\":%d,\"retainedEventCount\":%llu,\"retainedBytes\":%zu,\"epollWakeObserved\":%s}\n", ABI_VERSION, attached, (unsigned long long)consumer.retained_records, consumer.retained_length, ready > 0 ? "true" : "false");
  close(epollfd); for (long i = 0; i < cpu_count * 2; ++i) { if (link_fds[i] >= 0) close(link_fds[i]); if (perf_fds[i] >= 0) close(perf_fds[i]); }
  free(link_fds); free(perf_fds); ring_consumer_close(&consumer); return 0;
}

struct bpf_object;
struct bpf_program;
struct bpf_map;

static int map_type_for_fd(int fd, uint32_t *type) {
  union bpf_attr attribute; memset(&attribute, 0, sizeof(attribute)); struct bpf_map_info info; memset(&info, 0, sizeof(info));
  attribute.info.bpf_fd = (uint32_t)fd; attribute.info.info_len = sizeof(info); attribute.info.info = (uint64_t)(uintptr_t)&info;
  if (bpf_call(BPF_OBJ_GET_INFO_BY_FD, &attribute) != 0) return -1;
  *type = info.type;
  return 0;
}

static int monitor_object(int argc, char **argv) {
  const char *object_path = NULL, *object_sha256 = NULL; int monitor_cpu = -1, timeout_ms = 1000, include_sys_admin = 0;
  for (int i = 2; i < argc; ++i) {
    if (strcmp(argv[i], "--require-sys-admin") == 0) { include_sys_admin = 1; continue; }
    if (i + 1 >= argc) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    if (strcmp(argv[i], "--bpf-object") == 0) object_path = argv[++i];
    else if (strcmp(argv[i], "--bpf-object-sha256") == 0) object_sha256 = argv[++i];
    else {
      uint64_t value; if (parse_u64(argv[i + 1], &value) != 0 || value > INT32_MAX) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
      if (strcmp(argv[i], "--monitor-cpu") == 0) monitor_cpu = (int)value;
      else if (strcmp(argv[i], "--timeout-ms") == 0) timeout_ms = (int)value;
      else { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
      ++i;
    }
  }
  if (!object_path || !object_sha256 || monitor_cpu < 0 || timeout_ms < 0) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "monitor-object"); }
  if (require_capabilities(include_sys_admin) != 0) return emit_error("CAPABILITY_REQUIREMENTS_UNMET", "signal-monitor-object");
  if (file_sha256_matches(object_path, object_sha256) != 0) return emit_error("MONITOR_GAP", "bpf-object-digest");
  void *library = dlopen("libbpf.so.1", RTLD_NOW | RTLD_LOCAL); if (!library) { errno = ENOSYS; return emit_error("MONITOR_GAP", "libbpf-load"); }
  struct bpf_object *(*object_open)(const char *, const void *) = dlsym(library, "bpf_object__open_file");
  int (*object_load)(struct bpf_object *) = dlsym(library, "bpf_object__load");
  struct bpf_program *(*find_program)(const struct bpf_object *, const char *) = dlsym(library, "bpf_object__find_program_by_name");
  int (*program_fd)(const struct bpf_program *) = dlsym(library, "bpf_program__fd");
  struct bpf_map *(*find_map)(const struct bpf_object *, const char *) = dlsym(library, "bpf_object__find_map_by_name");
  int (*map_fd)(const struct bpf_map *) = dlsym(library, "bpf_map__fd");
  void (*object_close)(struct bpf_object *) = dlsym(library, "bpf_object__close");
  if (!object_open || !object_load || !find_program || !program_fd || !find_map || !map_fd || !object_close) { dlclose(library); errno = ENOSYS; return emit_error("MONITOR_GAP", "libbpf-symbols"); }
  struct bpf_object *object = object_open(object_path, NULL); if (!object || object_load(object) != 0) { if (object) object_close(object); dlclose(library); errno = EPERM; return emit_error("MONITOR_GAP", "bpf-object-load"); }
  struct bpf_program *generate = find_program(object, "kstack_signal_generate"), *deliver = find_program(object, "kstack_signal_deliver");
  struct bpf_map *ring = find_map(object, "events"); const char *counter_names[] = {"produced_count", "reservation_failure_count", "map_failure_count", "event_sequence"};
  if (!generate || !deliver || !ring) { object_close(object); dlclose(library); errno = ENOENT; return emit_error("MONITOR_GAP", "bpf-object-contract"); }
  int ring_fd = map_fd(ring); uint32_t type = 0;
  if (ring_fd < 0 || map_type_for_fd(ring_fd, &type) != 0 || type != BPF_MAP_TYPE_RINGBUF) { object_close(object); dlclose(library); errno = EINVAL; return emit_error("MONITOR_GAP", "bpf-ring-map-contract"); }
  for (size_t i = 0; i < sizeof(counter_names) / sizeof(counter_names[0]); ++i) {
    struct bpf_map *map = find_map(object, counter_names[i]); int fd = map ? map_fd(map) : -1;
    if (fd < 0 || map_type_for_fd(fd, &type) != 0 || type != BPF_MAP_TYPE_PERCPU_ARRAY) { object_close(object); dlclose(library); errno = EINVAL; return emit_error("MONITOR_GAP", "bpf-percpu-map-contract"); }
  }
  char generate_fd[32], deliver_fd[32], ring_fd_text[32], cpu_text[32], timeout_text[32];
  snprintf(generate_fd, sizeof(generate_fd), "%d", program_fd(generate)); snprintf(deliver_fd, sizeof(deliver_fd), "%d", program_fd(deliver)); snprintf(ring_fd_text, sizeof(ring_fd_text), "%d", ring_fd); snprintf(cpu_text, sizeof(cpu_text), "%d", monitor_cpu); snprintf(timeout_text, sizeof(timeout_text), "%d", timeout_ms);
  char *forwarded[] = {argv[0], "monitor-once", "--generate-prog-fd", generate_fd, "--deliver-prog-fd", deliver_fd, "--ring-map-fd", ring_fd_text, "--monitor-cpu", cpu_text, "--timeout-ms", timeout_text, NULL};
  int result = monitor_once(12, forwarded); object_close(object); dlclose(library); return result;
}

static int parse_u64(const char *value, uint64_t *result) {
  if (!value || !*value || *value == '-') return -1;
  char *end = NULL; errno = 0; unsigned long long parsed = strtoull(value, &end, 10);
  if (errno || !end || *end) return -1;
  *result = (uint64_t)parsed;
  return 0;
}

static int clear_inheritable(void) {
  struct __user_cap_data_struct data[2] = {{0}};
  if (capget_current(data) != 0) return -1;
  data[0].inheritable = 0; data[1].inheritable = 0;
  return capset_current(data);
}

static int clear_all_capabilities(void) {
  const struct __user_cap_data_struct data[2] = {{0}};
  return capset_current(data);
}

static int install_filter(const struct sock_filter *instructions, size_t count) {
  struct sock_fprog program = { .len = (unsigned short)count, .filter = (struct sock_filter *)instructions };
  return (int)syscall(SYS_seccomp, SECCOMP_SET_MODE_FILTER, 0, &program);
}

static void child_launcher(int ready_write, int start_read, uid_t uid, gid_t gid, int child_nice, const struct sock_filter *filter, size_t filter_count, const char *filter_identity, char *const command[]) {
  int ready_saved = fcntl(ready_write, F_DUPFD_CLOEXEC, 100);
  int start_saved = fcntl(start_read, F_DUPFD_CLOEXEC, 100);
  if (ready_saved < 0 || start_saved < 0 || dup3(ready_saved, 3, O_CLOEXEC) < 0 || dup3(start_saved, 4, O_CLOEXEC) < 0) _exit(201);
  if (syscall(SYS_close_range, 5U, ~0U, CLOSE_RANGE_UNSHARE) != 0) _exit(202);
  struct sched_param child_scheduling = { .sched_priority = 0 };
  if (sched_setscheduler(0, SCHED_OTHER, &child_scheduling) != 0 || setpriority(PRIO_PROCESS, 0, child_nice) != 0) _exit(211);
  if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_CLEAR_ALL, 0, 0, 0) != 0 || clear_inheritable() != 0) _exit(203);
  if (setgroups(0, NULL) != 0) _exit(204);
  unsigned long securebits = SECBIT_NOROOT | SECBIT_NOROOT_LOCKED | SECBIT_NO_SETUID_FIXUP | SECBIT_NO_SETUID_FIXUP_LOCKED | SECBIT_NO_CAP_AMBIENT_RAISE | SECBIT_NO_CAP_AMBIENT_RAISE_LOCKED;
  if (prctl(PR_SET_SECUREBITS, securebits, 0, 0, 0) != 0 || prctl(PR_SET_KEEPCAPS, 0, 0, 0, 0) != 0) _exit(205);
  if (setresgid(gid, gid, gid) != 0 || setresuid(uid, uid, uid) != 0 || clear_all_capabilities() != 0) _exit(206);
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 || install_filter(filter, filter_count) != 0) _exit(207);
  struct ready_record record = { .magic = READY_MAGIC, .uid = (uint32_t)getuid(), .gid = (uint32_t)getgid(), .securebits = (uint64_t)prctl(PR_GET_SECUREBITS, 0, 0, 0, 0), .no_new_privs = (uint32_t)prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0), .seccomp_mode = (uint32_t)prctl(PR_GET_SECCOMP, 0, 0, 0, 0) };
  strncpy(record.seccomp_filter_identity, filter_identity, sizeof(record.seccomp_filter_identity) - 1U);
  if (write_all(3, &record, sizeof(record)) != 0) _exit(208);
  unsigned char release = 0;
  if (read_all(4, &release, 1) != 0 || release != 0xa5) _exit(209);
  if (command && command[0]) { execvp(command[0], command); _exit(210); }
  _exit(1);
}

static int status_has(pid_t pid, const char *field, const char *expected) {
  char path[64]; snprintf(path, sizeof(path), "/proc/%d/status", pid);
  FILE *file = fopen(path, "re"); if (!file) return 0;
  char *line = NULL; size_t capacity = 0; int matched = 0;
  while (getline(&line, &capacity, file) >= 0) if (strncmp(line, field, strlen(field)) == 0) {
    char *value = line + strlen(field); while (*value == ' ' || *value == '\t') ++value; value[strcspn(value, "\r\n")] = 0;
    matched = strcmp(value, expected) == 0; break;
  }
  free(line); fclose(file); return matched;
}

static int verify_descriptors(pid_t pid) {
  char path[64]; snprintf(path, sizeof(path), "/proc/%d/fd", pid);
  DIR *directory = opendir(path); if (!directory) return 0;
  unsigned mask = 0; struct dirent *entry;
  while ((entry = readdir(directory)) != NULL) {
    char *end = NULL; long fd = strtol(entry->d_name, &end, 10);
    if (end && *end == 0 && fd >= 0) { if (fd > 4) { closedir(directory); return 0; } mask |= 1U << fd; }
  }
  closedir(directory); return mask == 0x1fU;
}

static int verify_cgroup_identity(pid_t pid, int cgroupfd) {
  struct stat expected, observed;
  if (fstat(cgroupfd, &expected) != 0) return 0;
  char proc_path[64]; snprintf(proc_path, sizeof(proc_path), "/proc/%d/cgroup", pid);
  FILE *file = fopen(proc_path, "re"); if (!file) return 0;
  char *line = NULL; size_t capacity = 0; int matched = 0;
  while (getline(&line, &capacity, file) >= 0) if (strncmp(line, "0::", 3) == 0) {
    char *relative = line + 3; relative[strcspn(relative, "\r\n")] = 0;
    char resolved[4096]; int length = snprintf(resolved, sizeof(resolved), "/sys/fs/cgroup%s", relative);
    if (length > 0 && (size_t)length < sizeof(resolved) && stat(resolved, &observed) == 0 && observed.st_dev == expected.st_dev && observed.st_ino == expected.st_ino) matched = 1;
    break;
  }
  free(line); fclose(file); return matched;
}

static int verify_child(pid_t pid, int cgroupfd, uid_t uid, gid_t gid, const char *filter_identity, const struct ready_record *record) {
  char uid_line[128], gid_line[128];
  snprintf(uid_line, sizeof(uid_line), "%u\t%u\t%u\t%u", uid, uid, uid, uid);
  snprintf(gid_line, sizeof(gid_line), "%u\t%u\t%u\t%u", gid, gid, gid, gid);
  unsigned long required_securebits = SECBIT_NOROOT | SECBIT_NOROOT_LOCKED | SECBIT_NO_SETUID_FIXUP | SECBIT_NO_SETUID_FIXUP_LOCKED | SECBIT_NO_CAP_AMBIENT_RAISE | SECBIT_NO_CAP_AMBIENT_RAISE_LOCKED;
  return record->magic == READY_MAGIC && record->uid == uid && record->gid == gid && record->securebits == required_securebits && record->no_new_privs == 1 && record->seccomp_mode == 2 && strcmp(record->seccomp_filter_identity, filter_identity) == 0
    && status_has(pid, "Uid:", uid_line) && status_has(pid, "Gid:", gid_line) && status_has(pid, "Groups:", "")
    && status_has(pid, "CapInh:", "0000000000000000") && status_has(pid, "CapPrm:", "0000000000000000") && status_has(pid, "CapEff:", "0000000000000000")
    && status_has(pid, "CapAmb:", "0000000000000000") && status_has(pid, "NoNewPrivs:", "1") && status_has(pid, "Seccomp:", "2") && verify_descriptors(pid) && verify_cgroup_identity(pid, cgroupfd);
}

static int add_epoll(int epollfd, int fd, uint64_t tag) {
  struct epoll_event event = { .events = EPOLLIN, .data.u64 = tag };
  return epoll_ctl(epollfd, EPOLL_CTL_ADD, fd, &event);
}

static int supervise(int argc, char **argv, int probe_only) {
  int cgroupfd = -1, deadline_cpu = -1, child_nice = 0; uid_t uid = getuid(); gid_t gid = getgid(); uint64_t duration = UINT64_C(1000000000); int separator = argc;
  const char *filter_path = NULL, *filter_sha256 = NULL;
  for (int i = 2; i < argc; ++i) {
    if (strcmp(argv[i], "--") == 0) { separator = i + 1; break; }
    if (i + 1 >= argc) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    if (strcmp(argv[i], "--seccomp-filter-file") == 0) { filter_path = argv[++i]; continue; }
    if (strcmp(argv[i], "--seccomp-filter-sha256") == 0) { filter_sha256 = argv[++i]; continue; }
    if (strcmp(argv[i], "--child-nice") == 0) {
      char *end = NULL; errno = 0; long parsed_nice = strtol(argv[++i], &end, 10);
      if (errno || !end || *end || parsed_nice < -20 || parsed_nice > 19) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "--child-nice"); }
      child_nice = (int)parsed_nice; continue;
    }
    uint64_t parsed;
    if (parse_u64(argv[i + 1], &parsed) != 0) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    if (strcmp(argv[i], "--cgroup-fd") == 0) cgroupfd = (int)parsed;
    else if (strcmp(argv[i], "--uid") == 0) uid = (uid_t)parsed;
    else if (strcmp(argv[i], "--gid") == 0) gid = (gid_t)parsed;
    else if (strcmp(argv[i], "--deadline-after-ns") == 0) duration = parsed;
    else if (strcmp(argv[i], "--deadline-cpu") == 0 && parsed <= INT32_MAX) deadline_cpu = (int)parsed;
    else { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", argv[i]); }
    ++i;
  }
  if (cgroupfd < 0 || duration == 0 || (!probe_only && (separator >= argc || !filter_path || !filter_sha256 || deadline_cpu < 0))) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "supervise"); }
  if (require_capabilities(0) != 0) return emit_error("CAPABILITY_REQUIREMENTS_UNMET", "supervise");
  if (!probe_only) {
    cpu_set_t affinity; CPU_ZERO(&affinity); CPU_SET((unsigned int)deadline_cpu, &affinity); struct sched_param scheduling = { .sched_priority = 80 };
    if (sched_setaffinity(0, sizeof(affinity), &affinity) != 0 || sched_setscheduler(0, SCHED_FIFO, &scheduling) != 0 || mlockall(MCL_CURRENT | MCL_FUTURE) != 0) return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "deadline-detector-scheduling");
  }
  int ready_pipe[2], start_pipe[2];
  if (pipe2(ready_pipe, O_CLOEXEC) != 0 || pipe2(start_pipe, O_CLOEXEC) != 0) return emit_error("CHILD_PRIVILEGE_DROP_FAILED", "pipe2");
  int timerfd = timerfd_create(CLOCK_MONOTONIC, TFD_CLOEXEC | TFD_NONBLOCK); int epollfd = epoll_create1(EPOLL_CLOEXEC);
  if (timerfd < 0 || epollfd < 0) return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "timerfd/epoll-create");
  struct sock_filter allow_filter[] = { BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW) };
  struct sock_filter *loaded_filter = NULL; size_t loaded_filter_count = 0;
  if (!probe_only && load_seccomp_filter(filter_path, filter_sha256, &loaded_filter, &loaded_filter_count) != 0) return emit_error("CHILD_PRIVILEGE_DROP_FAILED", "seccomp-filter-digest");
  const struct sock_filter *selected_filter = probe_only ? allow_filter : loaded_filter; size_t selected_filter_count = probe_only ? 1U : loaded_filter_count;
  const char *selected_filter_identity = probe_only ? "probe-allow-all-not-production" : filter_sha256;
  int pidfd = -1; struct clone_args arguments; memset(&arguments, 0, sizeof(arguments));
  arguments.flags = (uint64_t)(CLONE_INTO_CGROUP | CLONE_PIDFD); arguments.pidfd = (uint64_t)(uintptr_t)&pidfd; arguments.cgroup = (uint64_t)(unsigned int)cgroupfd; arguments.exit_signal = (uint64_t)SIGCHLD;
  uint64_t launch;
  if (monotonic_now(&launch) != 0 || launch > UINT64_MAX - duration) return emit_error("CLOCK_CONTRACT_VIOLATION", "pre-clone-clock");
  pid_t pid = (pid_t)syscall(SYS_clone3, &arguments, sizeof(arguments));
  if (pid < 0) return emit_error("SPAWN_FAILED_AFTER_LAUNCH", "clone3(CLONE_INTO_CGROUP|CLONE_PIDFD)");
  if (pid == 0) { close(ready_pipe[0]); close(start_pipe[1]); child_launcher(ready_pipe[1], start_pipe[0], uid, gid, child_nice, selected_filter, selected_filter_count, selected_filter_identity, probe_only ? NULL : &argv[separator]); }
  close(ready_pipe[1]); close(start_pipe[0]);
  if (add_epoll(epollfd, pidfd, 1) != 0 || add_epoll(epollfd, timerfd, 2) != 0) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "epoll-register"); }
  struct ready_record ready;
  if (read_all(ready_pipe[0], &ready, sizeof(ready)) != 0 || !verify_child(pid, cgroupfd, uid, gid, selected_filter_identity, &ready)) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); return emit_error("CHILD_PRIVILEGE_DROP_FAILED", "parent-verification"); }
  uint64_t deadline = launch + duration; struct itimerspec specification = { .it_value = ns_to_timespec(deadline) };
  if (timerfd_settime(timerfd, TFD_TIMER_ABSTIME, &specification, NULL) != 0) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); return emit_error("DEADLINE_DETECTOR_SETUP_FAILED", "timerfd-arm"); }
  uint64_t armed; if (monotonic_now(&armed) != 0 || armed >= deadline) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); errno = ETIME; return emit_error("DEADLINE_ARMING_TOO_LATE", "post-arm-clock"); }
  unsigned char release = 0xa5; if (write_all(start_pipe[1], &release, 1) != 0) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); return emit_error("CHILD_PRIVILEGE_DROP_FAILED", "release-barrier"); }
  int terminal = 0, timed_out = 0, status = -1, signal_number = 0; uint64_t observed = 0, timer_read = 0;
  while (!terminal) {
    struct epoll_event events[2]; int count;
    do count = epoll_wait(epollfd, events, 2, 6000); while (count < 0 && errno == EINTR);
    if (count <= 0) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); errno = ETIME; return emit_error("MONITOR_GAP", "epoll-wait"); }
    siginfo_t info; memset(&info, 0, sizeof(info));
    if (waitid(P_PIDFD, (id_t)pidfd, &info, WEXITED | WNOWAIT | WNOHANG) != 0) return emit_error("OS_EXIT_OBSERVATION_INVALID", "waitid-wnowait");
    if (info.si_pid != 0) {
      if (monotonic_now(&observed) != 0) return emit_error("CLOCK_CONTRACT_VIOLATION", "exit-observed-clock");
      if (info.si_code == CLD_EXITED) status = info.si_status; else signal_number = info.si_status;
      terminal = 1;
    }
    for (int i = 0; i < count; ++i) if (events[i].data.u64 == 2) {
      uint64_t expirations; if (read(timerfd, &expirations, sizeof(expirations)) != (ssize_t)sizeof(expirations) || monotonic_now(&timer_read) != 0) return emit_error("MONITOR_GAP", "timerfd-read");
      timed_out = 1; if (!terminal) syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0);
    }
  }
  siginfo_t reaped; memset(&reaped, 0, sizeof(reaped)); if (waitid(P_PIDFD, (id_t)pidfd, &reaped, WEXITED) != 0) return emit_error("OS_EXIT_OBSERVATION_INVALID", "waitid-reap");
  uint64_t latency = timed_out && timer_read >= deadline ? timer_read - deadline : 0;
  fprintf(stdout, "{\"abiVersion\":\"%s\",\"ok\":true,\"cloneFlags\":[\"CLONE_INTO_CGROUP\",\"CLONE_PIDFD\"],\"pid\":%d,\"pidfdWait\":true,\"privilegeDropVerified\":true,\"tLaunchNs\":%llu,\"deadlineNs\":%llu,\"tTimerArmedNs\":%llu,\"tOsExitObservedNs\":%llu,\"tTimerfdReadNs\":", ABI_VERSION, pid, (unsigned long long)launch, (unsigned long long)deadline, (unsigned long long)armed, (unsigned long long)observed);
  if (timed_out) fprintf(stdout, "%llu", (unsigned long long)timer_read); else fputs("null", stdout);
  fputs(",\"deadlineDetectionLatencyNs\":", stdout); if (timed_out) fprintf(stdout, "%llu", (unsigned long long)latency); else fputs("null", stdout);
  fputs(",\"osStatus\":", stdout); if (status >= 0) fprintf(stdout, "%d", status); else fputs("null", stdout);
  fprintf(stdout, ",\"osSignalNumber\":%d,\"seccompFilterSha256\":", signal_number); if (probe_only) fputs("\"probe-allow-all-not-production\"", stdout); else json_string(filter_sha256);
  fputs(",\"failureCodes\":[", stdout);
  int wrote = 0; if (timed_out) { fputs("\"PARENT_OBSERVED_DEADLINE_EXCEEDED\"", stdout); wrote = 1; } if (latency > DEADLINE_LATENCY_LIMIT_NS) { if (wrote) putchar(','); fputs("\"MONITOR_GAP\"", stdout); }
  fputs("]}\n", stdout);
  free(loaded_filter); close(ready_pipe[0]); close(start_pipe[1]); close(pidfd); close(timerfd); close(epollfd); return 0;
}

static int clone3_argument_probe(void) {
  int pidfd = -1; struct clone_args arguments; memset(&arguments, 0, sizeof(arguments));
  arguments.flags = (uint64_t)(CLONE_INTO_CGROUP | CLONE_PIDFD); arguments.pidfd = (uint64_t)(uintptr_t)&pidfd; arguments.cgroup = UINT64_MAX; arguments.exit_signal = (uint64_t)SIGCHLD;
  errno = 0; pid_t pid = (pid_t)syscall(SYS_clone3, &arguments, sizeof(arguments)); int saved = errno;
  if (pid == 0) _exit(220);
  if (pid > 0) { syscall(SYS_pidfd_send_signal, pidfd, SIGKILL, NULL, 0); waitid(P_PIDFD, (id_t)pidfd, NULL, WEXITED); close(pidfd); errno = EPROTO; return emit_error("NATIVE_PROBE_UNEXPECTEDLY_SPAWNED", "clone3-argument-probe"); }
  fprintf(stdout, "{\"abiVersion\":\"%s\",\"ok\":true,\"syscallInvoked\":true,\"flags\":[\"CLONE_INTO_CGROUP\",\"CLONE_PIDFD\"],\"cgroupFd\":-1,\"pidfdStorage\":true,\"errno\":%d,\"errnoName\":", ABI_VERSION, saved); json_string(strerror(saved)); fputs("}\n", stdout); return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "mode"); }
  if (argc != 2 && strcmp(argv[1], "clone3-probe") != 0 && strcmp(argv[1], "supervise") != 0 && strcmp(argv[1], "monitor-once") != 0 && strcmp(argv[1], "monitor-object") != 0) { errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "mode"); }
  if (strcmp(argv[1], "describe") == 0) return describe();
  if (strcmp(argv[1], "capabilities") == 0) return capabilities();
  if (strcmp(argv[1], "deadline-probe") == 0) return deadline_probe();
  if (strcmp(argv[1], "bpf-probe") == 0) return bpf_probe();
  if (strcmp(argv[1], "clone3-argument-probe") == 0) return clone3_argument_probe();
  if (strcmp(argv[1], "monitor-once") == 0) return monitor_once(argc, argv);
  if (strcmp(argv[1], "monitor-object") == 0) return monitor_object(argc, argv);
  if (strcmp(argv[1], "clone3-probe") == 0) return supervise(argc, argv, 1);
  if (strcmp(argv[1], "supervise") == 0) return supervise(argc, argv, 0);
  errno = EINVAL; return emit_error("NATIVE_ARGUMENT_INVALID", "mode");
}
