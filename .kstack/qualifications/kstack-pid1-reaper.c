#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static volatile sig_atomic_t primary_pid = -1;

static void forward_signal(int signal_number) {
  const pid_t pid = (pid_t)primary_pid;
  if (pid > 0) (void)kill(pid, signal_number);
}

int main(int argc, char **argv) {
  if (argc < 2) {
    fputs("usage: kstack-pid1-reaper COMMAND [ARG...]\n", stderr);
    return 2;
  }

  struct sigaction action;
  action.sa_handler = forward_signal;
  sigemptyset(&action.sa_mask);
  action.sa_flags = SA_RESTART;
  if (sigaction(SIGTERM, &action, NULL) != 0 || sigaction(SIGINT, &action, NULL) != 0
      || sigaction(SIGHUP, &action, NULL) != 0) {
    perror("sigaction");
    return 2;
  }

  const pid_t child = fork();
  if (child < 0) {
    perror("fork");
    return 2;
  }
  if (child == 0) {
    execvp(argv[1], &argv[1]);
    perror("execvp");
    _exit(127);
  }
  primary_pid = child;

  int primary_status = 0;
  int primary_seen = 0;
  for (;;) {
    int status = 0;
    const pid_t reaped = waitpid(-1, &status, 0);
    if (reaped < 0) {
      if (errno == EINTR) continue;
      if (errno == ECHILD) break;
      perror("waitpid");
      return 2;
    }
    if (reaped == child) {
      primary_status = status;
      primary_seen = 1;
      primary_pid = -1;
    }
  }

  if (!primary_seen) return 2;
  if (WIFEXITED(primary_status)) return WEXITSTATUS(primary_status);
  if (WIFSIGNALED(primary_status)) return 128 + WTERMSIG(primary_status);
  return 2;
}
