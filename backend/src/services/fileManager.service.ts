import { env } from '../config/env';
import { sftpService } from './sftp.service';
import { sudoFsService } from './sudoFs.service';
import { FileManagerService } from '../types';

/**
 * The SFTP tab talks to this facade only - which implementation actually
 * moves the bytes (raw SFTP vs. sudo-prefixed SSH exec) is decided once
 * here from SFTP_USE_SUDO.
 */
export const fileManagerService: FileManagerService = env.sftp.useSudo ? sudoFsService : sftpService;

/**
 * Resolves the directory the file manager should open on load:
 * SFTP_DEFAULT_PATH if it's set and turns out to be a real directory,
 * otherwise the SSH user's home directory, otherwise "/".
 */
export async function resolveDefaultPath(): Promise<string> {
  const configured = env.sftp.defaultPath;
  if (configured) {
    try {
      const info = await fileManagerService.stat(configured);
      if (info.type === 'directory') return configured;
    } catch {
      // configured path doesn't exist or isn't reachable - fall back below
    }
  }

  try {
    return await fileManagerService.resolveHome();
  } catch {
    return '/';
  }
}
