import { delay } from "@/lib/delay";

/**
 * Rate limiter class to throttle requests
 */
export class RateLimiter {
  private lastRequest = 0;

  constructor(private readonly delayMs: number) {}

  /**
   * Throttle execution to ensure minimum delay between calls
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.delayMs) {
      await delay(this.delayMs - elapsed);
    }
    this.lastRequest = Date.now();
  }
}
