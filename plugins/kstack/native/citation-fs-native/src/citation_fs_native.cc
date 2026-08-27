#include <node_api.h>

#include <cerrno>
#include <cctype>
#include <cstdint>
#include <climits>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#if defined(__linux__)
#include <gnu/libc-version.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/utsname.h>
#include <unistd.h>
#endif

namespace {

constexpr const char* kAbi = "kstack-citation-fs-native-abi-v2";

napi_value Fail(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
  return nullptr;
}

bool Set(napi_env env, napi_value object, const char* name, napi_value value) {
  return napi_set_named_property(env, object, name, value) == napi_ok;
}

napi_value String(napi_env env, const std::string& value) {
  napi_value result;
  if (napi_create_string_utf8(env, value.data(), value.size(), &result) != napi_ok) return nullptr;
  return result;
}

napi_value Uint64(napi_env env, uint64_t value) {
  napi_value result;
  if (napi_create_bigint_uint64(env, value, &result) != napi_ok) return nullptr;
  return result;
}

bool FdArgument(napi_env env, napi_callback_info info, int* fd) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc != 1) return false;
  napi_valuetype type;
  double value;
  if (napi_typeof(env, argv[0], &type) != napi_ok || type != napi_number || napi_get_value_double(env, argv[0], &value) != napi_ok) return false;
  if (!std::isfinite(value) || std::floor(value) != value || value < 0 || value > INT_MAX || value > 9007199254740991.0) return false;
  *fd = static_cast<int>(value);
  return true;
}

bool BaseObject(napi_env env, napi_value* object) {
  if (napi_create_object(env, object) != napi_ok) return false;
  return Set(env, *object, "abiVersion", String(env, kAbi)) && Set(env, *object, "platform", String(env, "linux"));
}

#if defined(__linux__)
bool DirectoryPath(int fd, std::string* result) {
  std::string link = "/proc/self/fd/" + std::to_string(fd);
  for (size_t capacity = 4096; capacity <= 1048576; capacity *= 2) {
    std::string buffer(capacity, '\0');
    const ssize_t count = readlink(link.c_str(), buffer.data(), capacity);
    if (count < 0) return false;
    if (static_cast<size_t>(count) == capacity) continue;
    buffer.resize(static_cast<size_t>(count));
    constexpr const char* deleted_suffix = " (deleted)";
    constexpr size_t deleted_suffix_length = 10;
    if (buffer.empty() || buffer.front() != '/' || buffer.find('\0') != std::string::npos
        || (buffer.size() >= deleted_suffix_length && buffer.compare(buffer.size() - deleted_suffix_length, deleted_suffix_length, deleted_suffix) == 0)) return false;
    char* resolved = realpath(buffer.c_str(), nullptr);
    if (!resolved) return false;
    *result = resolved;
    free(resolved);
    return !result->empty();
  }
  return false;
}

napi_value InspectDirectoryFd(napi_env env, napi_callback_info info) {
  int fd;
  if (!FdArgument(env, info, &fd)) return Fail(env, "invalid fd");
  struct stat stat_value {};
  struct statfs statfs_value {};
  std::string path;
  if (fstat(fd, &stat_value) != 0 || !S_ISDIR(stat_value.st_mode) || fstatfs(fd, &statfs_value) != 0 || !DirectoryPath(fd, &path)) return Fail(env, "directory inspection failed");
  napi_value object;
  if (!BaseObject(env, &object)
      || !Set(env, object, "pathRaw", String(env, path))
      || !Set(env, object, "deviceId", Uint64(env, static_cast<uint64_t>(stat_value.st_dev)))
      || !Set(env, object, "fileIdentity", Uint64(env, static_cast<uint64_t>(stat_value.st_ino)))
      || !Set(env, object, "filesystemTypeRaw", Uint64(env, static_cast<uint64_t>(statfs_value.f_type)))) return Fail(env, "result allocation failed");
  return object;
}

napi_value InspectFileFd(napi_env env, napi_callback_info info) {
  int fd;
  if (!FdArgument(env, info, &fd)) return Fail(env, "invalid fd");
  struct stat stat_value {};
  if (fstat(fd, &stat_value) != 0 || !S_ISREG(stat_value.st_mode)) return Fail(env, "file inspection failed");
  napi_value object;
  if (!BaseObject(env, &object)
      || !Set(env, object, "deviceId", Uint64(env, static_cast<uint64_t>(stat_value.st_dev)))
      || !Set(env, object, "fileIdentity", Uint64(env, static_cast<uint64_t>(stat_value.st_ino)))) return Fail(env, "result allocation failed");
  return object;
}

bool ProtectionArguments(napi_env env, napi_callback_info info, int* fd, mode_t* mode) {
  size_t argc = 2;
  napi_value argv[2];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc != 2) return false;
  napi_valuetype type;
  double value;
  if (napi_typeof(env, argv[0], &type) != napi_ok || type != napi_number || napi_get_value_double(env, argv[0], &value) != napi_ok
      || !std::isfinite(value) || std::floor(value) != value || value < 0 || value > INT_MAX) return false;
  *fd = static_cast<int>(value);
  size_t length = 0;
  if (napi_typeof(env, argv[1], &type) != napi_ok || type != napi_string || napi_get_value_string_utf8(env, argv[1], nullptr, 0, &length) != napi_ok || length > 32) return false;
  std::string kind(length, '\0');
  if (napi_get_value_string_utf8(env, argv[1], kind.data(), kind.size() + 1, &length) != napi_ok) return false;
  if (kind == "directory") *mode = 0700;
  else if (kind == "regular-file") *mode = 0600;
  else return false;
  return true;
}

const char* ProtectionVerdict(int fd, mode_t expected) {
  struct stat value {};
  if (fstat(fd, &value) != 0) return "inspect-failed";
  if (value.st_uid != geteuid()) return "owner-mismatch";
  if ((value.st_mode & 07777) != expected) return "protection-mismatch";
  return "enforced";
}

napi_value ProtectionResult(napi_env env, const char* verdict) {
  napi_value object;
  if (!BaseObject(env, &object) || !Set(env, object, "verdict", String(env, verdict))) return Fail(env, "result allocation failed");
  return object;
}

napi_value InspectProtectionFd(napi_env env, napi_callback_info info) {
  int fd;
  mode_t mode;
  if (!ProtectionArguments(env, info, &fd, &mode)) return Fail(env, "invalid protection arguments");
  return ProtectionResult(env, ProtectionVerdict(fd, mode));
}

napi_value ApplyAndInspectProtectionFd(napi_env env, napi_callback_info info) {
  int fd;
  mode_t mode;
  if (!ProtectionArguments(env, info, &fd, &mode)) return Fail(env, "invalid protection arguments");
  if (fchmod(fd, mode) != 0) return ProtectionResult(env, "apply-failed");
  return ProtectionResult(env, ProtectionVerdict(fd, mode));
}

bool VersionAtLeast(const char* value, int required_major, int required_minor) {
  int major = -1;
  int minor = -1;
  char extra = '\0';
  return std::sscanf(value, "%d.%d%c", &major, &minor, &extra) >= 2 && (major > required_major || (major == required_major && minor >= required_minor));
}

napi_value SelfTest(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  if (napi_get_cb_info(env, info, &argc, nullptr, nullptr, nullptr) != napi_ok || argc != 0) return Fail(env, "selfTest accepts no arguments");
  const char* verdict = "pass";
  struct utsname name {};
  if (!VersionAtLeast(gnu_get_libc_version(), 2, 28)) verdict = "libc-floor-failed";
  else if (uname(&name) != 0) verdict = "api-failed";
  else {
    int major = -1;
    int minor = -1;
    int patch = -1;
    if (std::sscanf(name.release, "%d.%d.%d", &major, &minor, &patch) != 3 || major < 4 || (major == 4 && minor < 18)) verdict = "os-floor-failed";
    std::string release(name.release);
    for (char& character : release) character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    if (release.find("microsoft") != std::string::npos && release.find("wsl2") == std::string::npos) verdict = "runtime-unsupported";
  }
  napi_value object;
  if (!BaseObject(env, &object) || !Set(env, object, "verdict", String(env, verdict))) return Fail(env, "result allocation failed");
  return object;
}
#else
napi_value Unsupported(napi_env env, napi_callback_info) { return Fail(env, "runtime unsupported"); }
#define InspectDirectoryFd Unsupported
#define InspectFileFd Unsupported
#define InspectProtectionFd Unsupported
#define ApplyAndInspectProtectionFd Unsupported
#define SelfTest Unsupported
#endif

napi_value Init(napi_env env, napi_value exports) {
  const auto attributes = static_cast<napi_property_attributes>(napi_writable | napi_enumerable | napi_configurable);
  napi_property_descriptor properties[] = {
    {"inspectDirectoryFd", nullptr, InspectDirectoryFd, nullptr, nullptr, nullptr, attributes, nullptr},
    {"inspectFileFd", nullptr, InspectFileFd, nullptr, nullptr, nullptr, attributes, nullptr},
    {"applyAndInspectProtectionFd", nullptr, ApplyAndInspectProtectionFd, nullptr, nullptr, nullptr, attributes, nullptr},
    {"inspectProtectionFd", nullptr, InspectProtectionFd, nullptr, nullptr, nullptr, attributes, nullptr},
    {"selfTest", nullptr, SelfTest, nullptr, nullptr, nullptr, attributes, nullptr}
  };
  if (napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties) != napi_ok) return nullptr;
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
