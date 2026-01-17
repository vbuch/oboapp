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
        },
      ],

      // TODO: Custom rules needed for React cleanup patterns:
      // - Detect useMemo/useCallback creating functions with .cancel() method
      // - Require cleanup in useEffect for such functions
      // - Flag missing cleanup for debounce, throttle, setTimeout, setInterval
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
    ],
  },
];

export default eslintConfig;
