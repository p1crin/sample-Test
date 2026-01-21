import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginConfigPrettier from 'eslint-config-prettier';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginImport from 'eslint-plugin-import';
import pluginNext from '@next/eslint-plugin-next';
import typescriptEslint from 'typescript-eslint';
import typescriptEslintParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['**/.next/**/*'],
  },
  pluginJs.configs.recommended,
  ...typescriptEslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginConfigPrettier,
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: typescriptEslintParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'postcss.config.mjs', 'next.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
          modules: true,
        },
      },
    },
    plugins: {
      import: pluginImport,
      '@next/next': pluginNext,
      'jsx-a11y': pluginJsxA11y,
      'react-hooks': pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
