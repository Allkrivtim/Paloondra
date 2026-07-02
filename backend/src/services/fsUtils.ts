/** Shared helpers used by both the plain-SFTP and sudo-exec file services. */

export function modeToPermissions(mode: number): string {
  const perms = mode & 0o777;
  const rwx = (bits: number) =>
    `${bits & 4 ? 'r' : '-'}${bits & 2 ? 'w' : '-'}${bits & 1 ? 'x' : '-'}`;
  return `${rwx((perms >> 6) & 7)}${rwx((perms >> 3) & 7)}${rwx(perms & 7)}`;
}

/**
 * Quotes a value for safe interpolation into a POSIX shell command run over
 * SSH exec. Every path that reaches a shell command built from user input
 * (SFTP tab paths, in sudo mode) MUST go through this - never concatenate
 * raw strings into a shell command.
 */
export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
