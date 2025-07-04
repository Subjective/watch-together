module.exports = {
  env: {
    node: true,
    browser: true,
    es2020: true,
  },
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  plugins: ["@typescript-eslint"],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2020,
  },
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "warn", // TODO: Change back to "error" after implementing real functionality
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }], // Allow unused params prefixed with _
    "prefer-const": "error",
    "no-var": "error",
  },
  overrides: [
    {
      files: ["*.tsx", "*.jsx"],
      extends: [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
      ],
      plugins: ["react", "react-hooks"],
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
  ],
};