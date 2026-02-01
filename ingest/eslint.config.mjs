import tseslint from "typescript-eslint";

const eslintConfig = [
  ...tseslint.configs.recommended,
  {
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
  // Allow 'any' in test files, mocks, and scripts for testing/utility purposes
  {
    files: [
      "**/*.test.ts",
      "**/__tests__/**",
      "**/__mocks__/**",
      "**/scripts/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "**/*.d.ts", // Type declaration files
      "emulator-data/**",
      "terraform/**/.terraform/**",
    ],
  },
];

export default eslintConfig;
