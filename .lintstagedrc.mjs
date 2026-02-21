/**
 * Creates a lint-staged task for a specific package directory
 * @param {string} dir - The package directory (e.g., 'web', 'ingest', 'shared')
 * @param {string[]} filenames - Array of staged file paths
 * @returns {string} Shell command to run eslint
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

  // Escape filenames for shell using double quotes (safe inside the single-quoted bash -c string)
  // Replace any double quotes and dollar signs that could break the quoting
  const escapedFiles = files
    .map(
      (f) =>
        `"${f.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`")}"`,
    )
    .join(" ");

  // Wrap in bash -c to execute cd and eslint as shell commands
  // dir is validated and shell-escaped for defense in depth
  // Filenames are double-quoted inside the single-quoted bash -c string to avoid
  // inner single quotes breaking out of the outer single-quoted argument
  return `bash -c 'cd ${dir} && eslint --no-warn-ignored ${escapedFiles}'`;
}

export default {
  "web/**/*.{js,jsx,ts,tsx}": (filenames) => createLintTask("web", filenames),
  "ingest/**/*.{js,ts}": (filenames) => createLintTask("ingest", filenames),
  "shared/**/*.{js,ts}": (filenames) => createLintTask("shared", filenames),
};
