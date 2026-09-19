import js from "@eslint/js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "**/*.generated.ts",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "prefer-const": "warn",
      "no-console": "off",
    },
  },
];
