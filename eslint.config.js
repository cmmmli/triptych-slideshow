import js from '@eslint/js';
import html from 'eslint-plugin-html';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', '.wrangler/', 'tests/', '*.ts'] },
  js.configs.recommended,
  // 失敗を意図的に無視する catch {} は許可する
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },
  {
    // index.html の <script> もチェックする
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
  { files: ['public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['eslint.config.js'], languageOptions: { globals: globals.node } },
];
