/**
 * Simple in-memory store for scan progress.
 * Used to bridge between the scan orchestrator (which emits progress)
 * and the SSE controller (which streams it to clients).
 *
 * EventEmitter2 events are unreliable across NestJS modules in some setups,
 * so this provides a simple polling-based alternative.
 */

export interface ScanProgressData {
  progress: number;
  phase: string;
  updatedAt: number;
}

class ScanProgressStore {
  private readonly store = new Map<string, ScanProgressData>();

  set(scanId: string, progress: number, phase: string): void {
    this.store.set(scanId, { progress, phase, updatedAt: Date.now() });
  }

  get(scanId: string): ScanProgressData | undefined {
    return this.store.get(scanId);
  }

  delete(scanId: string): void {
    this.store.delete(scanId);
  }

  /** Clean up entries older than 10 minutes */
  cleanup(): void {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of this.store) {
      if (value.updatedAt < cutoff) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton instance shared across the application
export const scanProgressStore = new ScanProgressStore();
