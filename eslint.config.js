import js from '@eslint/js';
import globals from 'globals';

/* App-specific globals provided at runtime by classic <script> tags loaded
   before the module entry (CDN libs + portable-handler.js + data.js). */
const appGlobals = {
  Fuse: 'readonly',
  Chart: 'readonly',
  pdfjsLib: 'readonly',
  JSZip: 'readonly',
  PREBAKED_LIVE: 'readonly',
  buildMovies: 'readonly',
  launchPortable: 'readonly',
  downloadPortableReg: 'readonly',
  downloadPortableBat: 'readonly',
  portableMpcPath: 'writable',
  portableVlcPath: 'writable'
};

export default [
  {
    ignores: ['node_modules/**', 'build/**', 'android*/**', 'desktop/node_modules/**', 'data.json', 'data*.json']
  },
  js.configs.recommended,

  /* Pure, tested helper modules — strict. */
  {
    files: ['src/lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...appGlobals }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': 'off',
      'no-control-regex': 'off'
    }
  },

  /* Split application modules (auto-split from app.js, legacy code on S
     namespace). no-undef stays the net proving every reference resolves. */
  {
    files: ['src/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...appGlobals }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-redeclare': 'off',
      'no-func-assign': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-irregular-whitespace': 'off',
      'no-prototype-builtins': 'off',
      'no-constant-condition': 'off',
      'no-fallthrough': 'off',
      'no-misleading-character-class': 'off'
    }
  },

  /* Unit tests (Vitest + Node). */
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': 'warn'
    }
  },

  /* Vercel serverless functions (Node ESM). */
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': 'warn'
    }
  },

  /* Electron desktop main process (Node CommonJS). */
  {
    files: ['desktop/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': 'warn'
    }
  },

  /* Legacy classic scripts (service worker + global helpers). */
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker, ...globals.browser }
    },
    rules: { 'no-unused-vars': 'off', 'no-empty': 'off' }
  },
  {
    files: ['portable-handler.js', 'data.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser }
    },
    rules: { 'no-unused-vars': 'off', 'no-empty': 'off' }
  }
];
