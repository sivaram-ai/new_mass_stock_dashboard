import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      /*
       * Not enabled by next/core-web-vitals, and worth an error here: a local
       * `function saveItem` inside a component silently shadowed an
       * `import { saveItem }`, so the call recursed into the form handler with
       * the wrong arguments. It parsed, linted and built cleanly, and only
       * failed when someone clicked Save.
       */
      'no-shadow': 'error',
    },
  },
];

export default eslintConfig;
