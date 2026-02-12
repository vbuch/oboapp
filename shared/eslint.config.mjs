import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const eslintConfig = [
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Code quality rules - TypeScript-aware unused vars detection
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          args: "none",
        },
      ],

      // Memory leak prevention rules
      "prefer-const": "error",
      "no-var": "error",

      // Prefer early returns over else-if-return chains
      "no-else-return": ["error", { allowElseIf: false }],
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "**/*.d.ts", // Type declaration files
      "eslint.config.mjs", // Config file itself (not in tsconfig)
    ],
  },
];

export default eslintConfig;
