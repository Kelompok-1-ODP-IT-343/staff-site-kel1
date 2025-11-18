import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}", "**/*.ts", "**/*.tsx"],
    rules: {
      // Re-enable stricter rules to find real issues.
      // Keep `no-explicit-any` as a warning to make fixes incremental.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "error",
      "prefer-const": "error",
      "react/no-unescaped-entities": "error",
      // Re-enable unused checks so we can remove dead code.
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-unused-expressions": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Note: eslint-comments plugin not available in this repo; skip its rules.
    },
  },
  {
    rules: {
      // Disable image warning to avoid noise for plain <img>
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
