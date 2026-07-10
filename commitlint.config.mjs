const scopes = ["api", "db", "docs", "e2e", "ingest", "shared", "web", "repo"];

/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // A scope is mandatory for every commit message.
    "scope-empty": [2, "never"],
    // Scope must be one of the repository subprojects.
    "scope-enum": [2, "always", scopes],
  },
};

export default config;
