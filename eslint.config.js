// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-site/**',
      '**/dist-admin/**',
      '**/node_modules/**',
      '**/.vite/**',
      '**/coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- TypeScript / JS 源码 ----
  {
    files: ['packages/*/src/**/*.ts', 'scripts/**/*.ts', '*.ts', 'api/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // 空 catch 会静默吞掉真实故障，必须显式处理
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // 解构占位（const { ip: _ip, ua: _ua, ...rest }）不应报错
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      // 路由/组件处理的是后端任意 JSON 响应，收紧 any 收益低、噪音大
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ---- Vue SFC ----
  {
    files: ['packages/frontend/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: { vue: pluginVue },
    rules: {
      // vue3-essential 的几个核心规则，平铺写出来（不依赖 preset 对象结构）
      'vue/no-unused-components': 'error',
      'vue/no-dupe-keys': 'error',
      'vue/no-duplicate-attributes': 'error',
      'vue/no-mutating-props': 'error',
      'vue/no-reserved-keys': 'error',
      'vue/valid-template-root': 'error',
      'vue/valid-v-for': 'error',
      'vue/multi-word-component-names': 'off',
      // 评论渲染依赖 v-html，安全性由 sanitizeHtml 的白名单保证（有 15 个单测兜底）
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/require-explicit-emits': 'off',
      'vue/attributes-order': 'off',
      'no-console': 'off',
      // 扁平配置是分层覆盖：TS 段的 this 规则不会自动带进来，
      // Vue 段需重复声明。理由同 TS 段：组件消费的是后端任意 JSON 响应。
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
