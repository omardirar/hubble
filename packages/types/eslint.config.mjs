import baseConfig from "@hubble/eslint-config"

export default [
  ...baseConfig,
  {
    ignores: ["dist/**/*"],
  },
]
