# 前端开发规范

## 技术栈
- Vue 3 (Composition API + `<script setup lang="ts">`)
- Ant Design Vue 4 (组件库)
- Pinia (状态管理，`admin-ui/src/stores/`)
- Vue Router 4 (`admin-ui/src/router/`)
- Axios (HTTP 请求，`admin-ui/src/api/`)
- ECharts 6 + AntV G2Plot (图表)
- dayjs (日期处理)
- Vite 7 (构建工具)

## 目录结构
```
admin-ui/src/
├── api/           → API 请求封装（按业务模块拆分）
├── assets/        → 静态资源
├── components/    → 通用组件
├── directives/    → 自定义指令
├── layouts/       → 布局组件
├── router/        → 路由配置
├── stores/        → Pinia 状态管理
├── types/         → TypeScript 类型
├── utils/         → 工具函数
├── views/         → 页面视图组件
├── App.vue        → 根组件
└── main.ts        → 应用入口
```

## 组件规范
- 单文件组件使用 `<script setup lang="ts">` 语法
- 组件名使用 PascalCase
- Props 使用 `defineProps<{}>()` 类型化定义
- Emits 使用 `defineEmits<{}>()` 类型化定义
- 优先使用 Ant Design Vue 组件（a-table, a-form, a-modal, a-button 等）
- 表单使用 `a-form` + `a-form-item`，配合 `rules` 做校验

## API 调用规范
- API 封装在 `admin-ui/src/api/` 目录下
- 使用 Axios 实例，基础 URL 由 Vite proxy 处理（开发环境 `/api` → `localhost:3000`）
- 请求携带 JWT Token（存储在 localStorage）

## 样式规范
- 使用 `<style scoped>` 防止样式污染
- 全局样式在 `style.css` 中
- 响应式设计优先考虑 Ant Design Vue 的 Grid 系统

## 开发服务器
- 端口 3001，通过 proxy 转发 `/api` 到后端 3000 端口
- 启动命令: `cd admin-ui && npm run dev`
