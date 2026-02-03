import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Custom rule overrides
  {
    rules: {
      // Downgrade to warning - external API responses often need any
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars with underscore prefix are intentional
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Images - allow for external URLs and legacy code
      '@next/next/no-img-element': 'warn',
    },
  },
  // Override default ignores
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),
]);

export default eslintConfig;
