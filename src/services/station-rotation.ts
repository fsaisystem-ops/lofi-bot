export const ROTATION_MS = 12 * 60 * 60 * 1000;

export interface StationClock {
  started(): void;
  stopped(): void;
}

export class StationRotation implements StationClock {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly intervalMs: number;
  private readonly onRotate: () => void;

  constructor(intervalMs: number, onRotate: () => void) {
    this.intervalMs = intervalMs;
    this.onRotate = onRotate;
  }

  started(): void {
    this.arm();
  }

  stopped(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(): void {
    this.stopped();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onRotate();
    }, this.intervalMs);
  }
}
