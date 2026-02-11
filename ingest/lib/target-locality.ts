/**
 * Get the target locality identifier from environment variable
 * @throws Error if TARGET_LOCALITY is not set
 */
export function getTargetLocality(): string {
  const target = process.env.TARGET_LOCALITY;
  if (!target) {
    throw new Error("TARGET_LOCALITY environment variable is required but not set");
  }
  return target;
}
