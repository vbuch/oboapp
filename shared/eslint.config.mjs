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
  // Allow 'any' in test files for testing flexibility
  {
    files: ["**/*.test.ts", "**/__tests__/**", "**/__mocks__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "**/*.mjs", // Config files not in tsconfig
    ],
  },
];

export default eslintConfig;
