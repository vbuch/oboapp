/**
 * Get the target city identifier from environment variable
 * Falls back to "bg.sofia" if not set
 */
export function getTargetCity(): string {
  return process.env.TARGET_CITY || "bg.sofia";
}
