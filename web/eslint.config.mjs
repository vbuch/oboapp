import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextVitals,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Memory leak prevention rules
      "react-hooks/exhaustive-deps": "error",
      "prefer-const": "error",
      "no-var": "error",

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
      // Allow empty object types for generic type parameters (used in analytics)
      "@typescript-eslint/no-empty-object-type": "off",

      // Prefer early returns over else-if-return chains
      "no-else-return": ["error", { allowElseIf: false }],

      // React/JSX rules
      "react/button-has-type": [
        "error",
        {
          button: true,
          submit: true,
          reset: true,
        },
      ],
    },
  },
  // Allow 'any' in test files for mocking purposes
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "node_modules/**",
      "coverage/**",
      "**/*.d.ts", // Type declaration files
    ],
  },
];

export default eslintConfig;
