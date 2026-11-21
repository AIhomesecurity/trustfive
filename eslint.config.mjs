import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FlatCompat} from '@eslint/eslintrc';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({baseDirectory});

/**
 * TrustFive ESLint flat configuration.
 *
 * `eslint-config-next` 15.x still publishes legacy eslintrc presets, so we
 * convert the official `next/core-web-vitals` and `next/typescript` presets
 * with FlatCompat. Those presets already bring React, React Hooks, Next.js
 * and TypeScript rules. We add a focused JSX accessibility layer on top and
 * keep an explicit, file-scoped baseline for pre-existing violations (see
 * `eslint-baseline.mjs`) so CI can still fail on new problems.
 */
import {legacyViolations} from './eslint-baseline.mjs';

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'supabase/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {'jsx-a11y': jsxA11y},
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
    },
  },
  {
    files: ['tests/**/*.{js,mjs,cjs,ts,tsx}', 'scripts/**/*.{js,mjs,cjs,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  ...legacyViolations.map(({files, rules}) => ({files, rules})),
];

export default eslintConfig;
