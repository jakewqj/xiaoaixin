// ESLint flat config。2026-08-03 从 oxlint 换过来(用户要求)。
//
// TS 走类型感知规则(recommendedTypeChecked)—— 不接 tsconfig 的话
// 「类型相关的问题」一条都查不出来,那就只剩语法检查了,意义不大。

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'wiki/**', 'skills/**', 'scripts/**'],
  },

  // ---- 应用源码(TypeScript,类型感知)----
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 常量和组件同文件导出只是热更新会整页刷新,不是错误
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 下划线开头的参数是「我知道它没用」的约定写法,别报
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // ---- 以下两条降为 warn,是有意欠着的债,不是「修好了」----
      //
      // react-hooks v7 带来的 React Compiler 规则,默认是 error。它们对新代码是对的,
      // 但对这个已经在跑的代码库全是既有写法,而「改对」= 重构对话触发状态机和面板
      // 滑出动画 —— 那是游戏逻辑,REFACTOR_PLAN §四闸 4 明说渲染重构期间不碰。
      // 为一条 lint 意见去动能跑的对话系统,风险远大于收益。
      //
      // purity: 命中的两处是 handleNpcTapSprite / handleNpcGift 里的 Math.random()。
      //   它们是事件处理器,不在渲染期间执行;规则只是无法证明这一点。
      // set-state-in-effect: 命中的是「跟着 props 同步状态」和定时器收气泡。
      //   其中 usePetSwim 那处会随 REFACTOR_PLAN 阶段 2 一起删掉。
      //
      // 想真的清掉:单开一轮「按 React 19 惯例重构状态派生」,别混在别的任务里。
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // ---- 素材生成脚本(Node,不做类型感知)----
  {
    files: ['*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // ---- Service Worker(浏览器 + SW 专有全局)----
  {
    files: ['public/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
)
