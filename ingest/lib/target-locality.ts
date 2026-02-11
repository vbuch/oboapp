/**
 * Get the locality identifier from environment variable
 * @throws Error if LOCALITY is not set
 */
export function getLocality(): string {
  const locality = process.env.LOCALITY;
  if (!locality) {
    throw new Error("LOCALITY environment variable is required but not set");
  }
  return locality;
}
