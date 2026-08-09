import js from '@eslint/js'
import react from 'eslint-plugin-react'

const browser = {
  window: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  createImageBitmap: 'readonly',
  FileReader: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
}

const node = {
  process: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
}

export default [
  { ignores: ['web/dist/**', 'node_modules/**', 'web/public/**', '.shoot.mjs'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: node,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['web/**/*.{js,jsx}'],
    languageOptions: { globals: browser },
    plugins: { react },
    rules: {
      // Without these, every component imported for use in JSX reads as unused.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
    },
  },
]
