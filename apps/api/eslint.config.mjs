import base from "@hubble/eslint-config"

export default [
  ...base,
  {
    files: ["**/*.ts"],
    ignores: ["node_modules/**", "dist/**", ".wrangler/**"],
  },
]
