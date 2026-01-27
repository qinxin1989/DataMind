# Admin UI

AI 数据问答平台的前端管理界面，基于 Vue 3 + Ant Design Vue 开发。

## 🛠️ 技术栈

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **UI 组件库**: Ant Design Vue 4.x
- **状态管理**: Pinia
- **路由**: Vue Router 4.x
- **图表**: ECharts / G2Plot
- **语言**: TypeScript

## 🚀 快速开始

### 1. 安装依赖

```bash
cd admin-ui
npm install
```

### 2. 开发模式启动

```bash
npm run dev
```
服务默认运行在 `http://localhost:5173`。

### 3. 生产环境构建

```bash
npm run build
```
构建产物位于 `dist/` 目录。

## 📂 目录结构

```
src/
├── api/             # API 接口封装
├── assets/          # 静态资源
├── components/      # 公共组件
├── hooks/           # 组合式函数 (Hooks)
├── layouts/         # 布局组件
├── router/          # 路由配置
├── stores/          # Pinia 状态管理
├── utils/           # 工具函数
├── views/           # 页面视图
│   ├── dashboard/   # 仪表盘
│   ├── system/      # 系统管理
│   ├── ai/          # AI 管理
│   └── ...
├── App.vue          # 根组件
└── main.ts          # 入口文件
```

## 🔌 接口配置

在 `vite.config.ts` 中配置了 API 代理，默认将 `/api` 请求代理到后端服务器（通常是 `http://localhost:3000`）。

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```
