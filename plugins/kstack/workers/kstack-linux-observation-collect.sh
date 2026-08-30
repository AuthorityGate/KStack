#!/usr/bin/env bash
# Runs on the qualification console; admission remains in the Node runtime.
set -euo pipefail

umask 077
export LC_ALL=C
export LANG=C

fail() {
  printf '%s\n' "${1:-KSTACK_LINUX_OBSERVATION_COLLECT_FAILED}" >&2
  exit 2
}

if [[ $# -ne 4 || $1 != --cell-id || $3 != --out || -z $2 || -z $4 ]]; then
  fail KSTACK_LINUX_OBSERVATION_COLLECT_ARGUMENT_INVALID
fi

cell_id=$2
output=$4
case "$cell_id" in
  debian-stable-native-x64|fedora-stable-native-x64|ubuntu-lts-native-x64|ubuntu-lts-wsl2-x64) ;;
  *) fail KSTACK_LINUX_OBSERVATION_COLLECT_CELL_INVALID ;;
esac

if [[ $output != /* || -e $output || -L $output ]]; then
  fail KSTACK_LINUX_OBSERVATION_COLLECT_OUTPUT_INVALID
fi

command -v date >/dev/null || fail KSTACK_LINUX_OBSERVATION_COLLECT_TOOL_MISSING
command -v findmnt >/dev/null || fail KSTACK_LINUX_OBSERVATION_COLLECT_TOOL_MISSING
command -v ps >/dev/null || fail KSTACK_LINUX_OBSERVATION_COLLECT_TOOL_MISSING
command -v sha256sum >/dev/null || fail KSTACK_LINUX_OBSERVATION_COLLECT_TOOL_MISSING
command -v systemctl >/dev/null || fail KSTACK_LINUX_OBSERVATION_COLLECT_TOOL_MISSING
command -v uname >/dev/null || fail KSTACK_LINUX_OBSERVATION_COLLECT_TOOL_MISSING

mkdir -m 0700 "$output" || fail KSTACK_LINUX_OBSERVATION_COLLECT_OUTPUT_INVALID
complete=false
cleanup() {
  if [[ $complete != true ]]; then
    find "$output" -mindepth 1 -maxdepth 1 -type f -delete 2>/dev/null || true
    rmdir "$output" 2>/dev/null || true
  fi
}
trap cleanup EXIT HUP INT TERM

collector_sha256=$(sha256sum "$0" | awk '{print $1}')
[[ $collector_sha256 =~ ^[a-f0-9]{64}$ ]] || fail KSTACK_LINUX_OBSERVATION_COLLECT_HASH_FAILED
observed_at=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')
expires_at=$(date -u -d "$observed_at +30 days" '+%Y-%m-%dT%H:%M:%S.000Z')

{
  printf 'schema=kstack-linux-observation-collection-v1\n'
  printf 'cellId=%s\n' "$cell_id"
  printf 'collectorSha256=%s\n' "$collector_sha256"
  printf 'observedAt=%s\n' "$observed_at"
  printf 'expiresAt=%s\n' "$expires_at"
} >"$output/metadata.txt"

if [[ ! -r /etc/os-release ]]; then
  fail KSTACK_LINUX_OBSERVATION_COLLECT_DISTRIBUTION_UNAVAILABLE
fi
sed -n '/^ID=/p;/^VERSION_ID=/p;/^ID_LIKE=/p;/^PRETTY_NAME=/p' /etc/os-release >"$output/distribution.txt"

{
  printf 'system=%s\n' "$(uname -s)"
  printf 'release=%s\n' "$(uname -r)"
  printf 'architecture=%s\n' "$(uname -m)"
} >"$output/kernel.txt"

mount_target=$(findmnt -T /tmp -n -o TARGET)
mount_source=$(findmnt -T /tmp -n -o SOURCE)
mount_fstype=$(findmnt -T /tmp -n -o FSTYPE)
mount_options=$(findmnt -T /tmp -n -o OPTIONS)
[[ -n $mount_target && -n $mount_source && -n $mount_fstype && -n $mount_options ]] \
  || fail KSTACK_LINUX_OBSERVATION_COLLECT_FILESYSTEM_UNAVAILABLE
{
  printf 'target=%s\n' "$mount_target"
  printf 'source=%s\n' "$mount_source"
  printf 'fstype=%s\n' "$mount_fstype"
  printf 'options=%s\n' "$mount_options"
} >"$output/filesystem.txt"

pid1=$(ps -p 1 -o comm= | tr -d '[:space:]')
set +e
init_state=$(systemctl is-system-running 2>/dev/null)
init_status=$?
set -e
{
  printf 'pid1=%s\n' "$pid1"
  printf 'systemctlState=%s\n' "$init_state"
  printf 'systemctlStatus=%s\n' "$init_status"
} >"$output/init.txt"

if [[ -x /usr/bin/apt-get ]]; then
  package_command=apt
  package_version=$(/usr/bin/apt-get --version | sed -n '1p')
elif [[ -x /usr/bin/dnf ]]; then
  package_command=dnf
  package_version=$(/usr/bin/dnf --version | sed -n '1p')
else
  fail KSTACK_LINUX_OBSERVATION_COLLECT_PACKAGE_MANAGER_UNAVAILABLE
fi
{
  printf 'command=%s\n' "$package_command"
  printf 'version=%s\n' "$package_version"
} >"$output/package-manager.txt"

find "$output" -mindepth 1 -maxdepth 1 -type f -exec chmod 0600 {} +
complete=true
trap - EXIT HUP INT TERM
printf '{"status":"COLLECTED","cellId":"%s","output":"%s"}\n' "$cell_id" "$output"
