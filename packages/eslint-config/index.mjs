// Shared ESLint flat config for Hubble monorepo
import prettier from "eslint-config-prettier"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"

export default [
  // Enable TypeScript parsing for TS/TSX files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // Use project service when available to avoid per-package project config churn
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/.open-next/**",
      "**/.wrangler/**",
      "**/.turbo/**",
      "infra/**",
    ],
    rules: {
      // Prevent deep imports into internal package sources
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@hubble/*/src/*", "packages/*/src/*"],
        },
      ],
    },
  },
  prettier,
]
