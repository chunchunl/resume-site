// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', '.astro/', '.wrangler/', 'node_modules/', 'tests/fixtures/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
);
