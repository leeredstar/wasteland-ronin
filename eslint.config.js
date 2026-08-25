/* 荒原浪人 ESLint 平面配置（轻量）
 * 启用方式：npm i -D eslint@9 然后 npm run lint
 * 原则：不强制风格化规则（保持迁移期低噪音），只抓真问题。
 */
module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'outputs/**']
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        window: 'readonly',
        self: 'readonly',
        document: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Math: 'readonly',
        JSON: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-constant-condition': 'warn'
    }
  }
];
