import base from "@hubble/eslint-config"

export default [
  ...base,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
]
