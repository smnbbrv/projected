import pluginJs from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default [
  // global ignores
  { ignores: ['dist/*', 'node_modules/*'] },

  // standard js rules
  pluginJs.configs.recommended,

  // override js rules
  {
    rules: {
      semi: [2, 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      quotes: ['error', 'single'],
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
    },
  },

  // standard typescript rules
  ...tseslint.configs.recommended,

  // override typescript rules
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // prettier rules
  prettierRecommended,

  // import rules
  {
    ...importPlugin.flatConfigs.recommended,
    rules: {
      'import/no-extraneous-dependencies': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
];
