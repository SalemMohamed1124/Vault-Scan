import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface ScriptResult {
  vulnerability: string;
  severity: string;
  location: string;
  evidence: string;
  category: string;
  cve_id: string | null;
  raw_details: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class ScriptRunnerService {
  private readonly logger = new Logger(ScriptRunnerService.name);
  private readonly activePids = new Map<string, number>();

  async runScript(
    scriptName: string,
    args: string[],
    scanId?: string,
    timeout: number = 120000,
  ): Promise<ScriptResult[]> {
    const scriptPromise = this._executeScript(scriptName, args, scanId);

    // Race between the script execution and a timeout
    return Promise.race([
      scriptPromise,
      new Promise<ScriptResult[]>((_, reject) =>
        setTimeout(() => {
          // Kill the process if it's still running
          if (scanId) {
            this.killScan(scanId);
          }
          reject(
            new Error(
              `Script ${scriptName} timed out after ${timeout / 1000}s`,
            ),
          );
        }, timeout),
      ),
    ]);
  }

  private _executeScript(
    scriptName: string,
    args: string[],
    scanId?: string,
  ): Promise<ScriptResult[]> {
    return new Promise((resolve, reject) => {
      const pythonPath = process.env['PYTHON_PATH'] || 'python3';
      // In Docker: scripts are at /app/scripts/. Locally: ../scripts/
      const localPath = path.join(process.cwd(), '..', 'scripts', scriptName);
      const dockerPath = path.join(process.cwd(), 'scripts', scriptName);
      const scriptPath = fs.existsSync(dockerPath) ? dockerPath : localPath;

      // Sanitize args: only allow specific patterns
      const sanitizedArgs = args.map((arg) => arg.replace(/[;&|`$]/g, ''));

      this.logger.log(
        `Running ${scriptName} with args: ${sanitizedArgs.join(' ')}`,
      );

      const proc: ChildProcess = spawn(pythonPath, [scriptPath, ...sanitizedArgs], {
        env: {
          ...process.env,
          SCAN_MOCK_MODE: process.env['SCAN_MOCK_MODE'] || 'false',
        },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        // Clean up PID tracking
        if (scanId) {
          this.activePids.delete(scanId);
        }

        if (code !== 0) {
          this.logger.error(
            `Script ${scriptName} exited with code ${code}: ${stderr}`,
          );
          reject(new Error(`Script ${scriptName} failed: ${stderr}`));
          return;
        }

        try {
          const result: unknown = JSON.parse(stdout);

          if (
            result !== null &&
            typeof result === 'object' &&
            !Array.isArray(result) &&
            'error' in result
          ) {
            // Log the error but resolve with empty findings
            // so one script failure doesn't break the entire scan
            this.logger.warn(
              `Script ${scriptName} reported error: ${(result as { error: string }).error}`,
            );
            resolve([]);
            return;
          }

          resolve(Array.isArray(result) ? (result as ScriptResult[]) : []);
        } catch {
          this.logger.error(
            `Invalid JSON from ${scriptName}: ${stdout.substring(0, 200)}`,
          );
          reject(new Error(`Invalid JSON from ${scriptName}: ${stdout}`));
        }
      });

      proc.on('error', (err: Error) => {
        if (scanId) {
          this.activePids.delete(scanId);
        }
        this.logger.error(`Failed to start ${scriptName}: ${err.message}`);
        reject(new Error(`Failed to start ${scriptName}: ${err.message}`));
      });

      // Store PID for cancellation support
      if (scanId && proc.pid !== undefined) {
        this.activePids.set(scanId, proc.pid);
      }
    });
  }

  async killScan(scanId: string): Promise<void> {
    const pid = this.activePids.get(scanId);
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
        this.logger.log(`Sent SIGTERM to PID ${pid} for scan ${scanId}`);
      } catch (error) {
        this.logger.warn(
          `Failed to kill PID ${pid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
      this.activePids.delete(scanId);
    }
  }

  isRunning(scanId: string): boolean {
    return this.activePids.has(scanId);
  }
}
