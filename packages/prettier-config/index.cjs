module.exports = {
  semi: false,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  arrowParens: "always",
  proseWrap: "preserve",
  overrides: [
    {
      files: "*.md",
      options: {
        proseWrap: "preserve",
        tabWidth: 2,
        useTabs: false,
      },
    },
  ],
}
