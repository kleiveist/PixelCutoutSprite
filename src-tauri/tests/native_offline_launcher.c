/* Linux-only native acceptance helper. No production linkage.
 * cc -Wall -Wextra -Werror native_offline_launcher.c -o /tmp/native-offline
 * /tmp/native-offline /absolute/path/to/pixel-cutout-sprite-studio
 * Descendants inherit the kernel filter; AF_UNIX remains available to GTK.
 */
#include <errno.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <sys/prctl.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <unistd.h>

#if defined(__x86_64__)
#define TEST_ARCH AUDIT_ARCH_X86_64
#elif defined(__aarch64__)
#define TEST_ARCH AUDIT_ARCH_AARCH64
#else
#error "Native offline probe supports Linux x86_64/aarch64 only"
#endif

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "Usage: native-offline PROGRAM [ARGS...]\n"); return 2; }
    struct sock_filter code[] = {
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, TEST_ARCH, 1, 0),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_socket, 1, 0),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_socketpair, 0, 4),
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AF_INET, 1, 0),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AF_INET6, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    };
    struct sock_fprog filter = { .len = sizeof(code) / sizeof(code[0]), .filter = code };
    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) || prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &filter)) {
        perror("Cannot enforce offline filter"); return 1;
    }
    int internet = socket(AF_INET, SOCK_STREAM, 0);
    if (internet >= 0 || errno != EPERM) { fprintf(stderr, "IPv4 negative control failed\n"); return 1; }
    internet = socket(AF_INET6, SOCK_STREAM, 0);
    if (internet >= 0 || errno != EPERM) { fprintf(stderr, "IPv6 negative control failed\n"); return 1; }
    int local = socket(AF_UNIX, SOCK_STREAM, 0);
    if (local < 0) { perror("AF_UNIX control failed"); return 1; }
    close(local);
    fprintf(stderr, "OFFLINE VERIFIED: kernel denies IPv4/IPv6 sockets; AF_UNIX available\n");
    execvp(argv[1], &argv[1]);
    perror("Cannot launch native app");
    return 1;
}
