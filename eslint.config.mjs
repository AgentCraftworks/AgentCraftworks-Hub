import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

export default [
  {
    ignores: ['dist/', 'out/', 'node_modules/', 'vendor/', 'packages/', '*.js', '*.mjs'],
  },
  js.configs.recommended,
  {
    files: ['src/main/**/*.{ts,tsx}', 'src/preload/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.node, NodeJS: 'readonly', Electron: 'readonly' },
    },
    rules: { 'no-unused-vars': 'off', 'no-control-regex': 'off' },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, React: 'readonly', JSX: 'readonly' },
    },
    rules: { 'no-unused-vars': 'off' },
  },
]
