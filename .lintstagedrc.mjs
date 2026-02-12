/**
 * Creates a lint-staged task for a specific package directory using oxlint.
 * oxlint is a Rust-based linter that runs 50-100x faster than ESLint,
 * making it ideal for pre-commit hooks. Comprehensive, type-aware linting
 * (e.g., rules like react-hooks/exhaustive-deps) should be enforced in CI.
 *
 * @param {string} dir - The package directory (e.g., 'web', 'ingest', 'shared')
 * @param {string[]} filenames - Array of staged file paths
 * @returns {string} Shell command to run oxlint
 */
function createLintTask(dir, filenames) {
  // Validate directory to prevent injection - only allow alphanumeric chars and underscores
  const validDirs = ["web", "ingest", "shared"];
  if (!validDirs.includes(dir) || !/^[a-z_]+$/.test(dir)) {
    throw new Error(`Invalid directory: ${dir}`);
  }

  // Escape special regex characters for safety, even though dir is validated
  const escapedDir = dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dirPattern = new RegExp(`^.*/${escapedDir}/(.+)$`);

  const files = filenames
    .map((f) => {
      const match = f.match(dirPattern);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  if (files.length === 0) return "";

  // Escape filenames for shell using single quotes
  // Replace any single quotes in the filename with '\''
  // This is the standard POSIX shell escaping method that handles all special characters
  const escapedFiles = files
    .map((f) => `'${f.replace(/'/g, "'\\''")}'`)
    .join(" ");

  // Use oxlint for fast pre-commit linting (no type-checking overhead)
  return `bash -c 'cd ${dir} && pnpm exec oxlint ${escapedFiles}'`;
}

export default {
  "web/**/*.{js,jsx,ts,tsx}": (filenames) => createLintTask("web", filenames),
  "ingest/**/*.{js,ts}": (filenames) => createLintTask("ingest", filenames),
  "shared/**/*.{js,ts}": (filenames) => createLintTask("shared", filenames),
};
