import js from "@eslint/js";
import ts from "typescript-eslint";
export default [
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  {
    plugins: { "unused-imports": require("eslint-plugin-unused-imports") },
    rules: {
      "unused-imports/no-unused-imports": "error"
    }
  },
  { ignores: ["node_modules/**", ".next/**", "out/**"] }
];
