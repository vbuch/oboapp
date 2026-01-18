import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      // Memory leak prevention rules
      "react-hooks/exhaustive-deps": "error",
      "prefer-const": "error",
      "no-var": "error",

      // Code quality rules
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          args: "none", // Don't check function arguments - TypeScript handles this
        },
      ],

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
