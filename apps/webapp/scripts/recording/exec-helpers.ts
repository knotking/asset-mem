/**
 * Execution helpers for running shell commands
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

/**
 * Execute command with arguments array (avoids shell quoting issues)
 */
export function spawnAsync(
  command: string,
  args: string[],
  options: { maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const process = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error: any = new Error(`Command failed with exit code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}
