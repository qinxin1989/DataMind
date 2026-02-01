# Task 24.3 执行计划 - 优化前端性能

**任务编号**: Task 24.3  
**任务名称**: 优化前端性能  
**开始时间**: 2026-02-01  
**预计耗时**: 1-2天  
**优先级**: 中

---

## 执行摘要

前端性能优化主要关注组件渲染、资源加载和首屏加载时间。通过使用 Vue 3 的性能优化特性、实现虚拟滚动、优化资源加载策略,提升用户体验。

### 当前状态
- 前端使用 Vue 3 + Vite
- 使用 Ant Design Vue 组件库
- 已实现基本的代码分割

### 优化目标
- 首屏加载时间 < 2s
- 长列表渲染流畅 (60fps)
- 组件渲染性能提升 50%+
- 资源加载优化

---

## 实施步骤

### 步骤 1: 分析当前性能 (30分钟)

#### 1.1 使用 Lighthouse 分析

```bash
# 使用 Chrome DevTools Lighthouse
# 或使用 CLI
npm install -g lighthouse
lighthouse http://localhost:5173 --view
```

**关注指标**:
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- CLS (Cumulative Layout Shift)

#### 1.2 使用 Vue DevTools 分析

- 组件渲染时间
- 组件更新频率
- 内存使用情况

#### 1.3 使用 Vite 构建分析

```bash
# 分析打包体积
npm run build -- --report
```

---

### 步骤 2: 优化组件渲染 (2小时)

#### 2.1 使用 v-memo 缓存组件

**目标**: 减少不必要的组件重新渲染

**实施**:
```vue
<!-- 对于列表项使用 v-memo -->
<template>
  <div v-for="item in items" :key="item.id" v-memo="[item.id, item.status]">
    <!-- 只有 id 或 status 变化时才重新渲染 -->
    <ItemCard :item="item" />
  </div>
</template>
```

**适用场景**:
- 长列表渲染
- 复杂的列表项组件
- 频繁更新但大部分项不变的列表

#### 2.2 使用 v-once 优化静态内容

**目标**: 静态内容只渲染一次

**实施**:
```vue
<template>
  <div v-once>
    <!-- 静态内容,只渲染一次 -->
    <h1>{{ staticTitle }}</h1>
    <p>{{ staticDescription }}</p>
  </div>
</template>
```

**适用场景**:
- 页面标题
- 静态说明文本
- 不会变化的配置信息

#### 2.3 优化计算属性

**目标**: 避免不必要的计算

**实施**:
```typescript
// 不好的做法 - 每次都重新计算
const filteredItems = items.value.filter(item => item.status === 'active');

// 好的做法 - 使用计算属性缓存
const filteredItems = computed(() => {
  return items.value.filter(item => item.status === 'active');
});
```

#### 2.4 使用 shallowRef 和 shallowReactive

**目标**: 减少深度响应式开销

**实施**:
```typescript
// 对于大型对象,使用 shallowRef
const largeData = shallowRef({
  // 大量数据
});

// 对于只需要顶层响应式的对象
const config = shallowReactive({
  theme: 'dark',
  language: 'zh-CN'
});
```

---

### 步骤 3: 实现虚拟滚动 (3小时)

#### 3.1 选择虚拟滚动库

**推荐**: `vue-virtual-scroller`

```bash
npm install vue-virtual-scroller
```

#### 3.2 实现虚拟列表

**文件**: `admin-ui/src/components/common/VirtualList.vue`

```vue
<template>
  <RecycleScroller
    :items="items"
    :item-size="itemHeight"
    key-field="id"
    v-slot="{ item }"
  >
    <slot :item="item" />
  </RecycleScroller>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

interface Props {
  items: any[];
  itemHeight: number;
}

defineProps<Props>();
</script>
```

#### 3.3 应用到长列表场景

**场景**:
- 用户列表
- 角色列表
- 权限列表
- 菜单列表
- 审计日志列表
- 通知列表

**示例**: 优化用户列表

```vue
<template>
  <VirtualList :items="users" :item-height="60">
    <template #default="{ item }">
      <UserListItem :user="item" />
    </template>
  </VirtualList>
</template>
```

#### 3.4 实现虚拟表格

**文件**: `admin-ui/src/components/common/VirtualTable.vue`

使用 Ant Design Vue 的虚拟滚动表格:

```vue
<template>
  <a-table
    :columns="columns"
    :data-source="dataSource"
    :scroll="{ y: 400 }"
    :virtual="true"
  />
</template>
```

---

### 步骤 4: 优化资源加载 (2小时)

#### 4.1 图片优化

**实施**:
1. 使用 WebP 格式
2. 实现图片懒加载
3. 使用适当的图片尺寸

**文件**: `admin-ui/src/components/common/LazyImage.vue`

```vue
<template>
  <img
    :src="loaded ? src : placeholder"
    :alt="alt"
    @load="onLoad"
    loading="lazy"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  src: string;
  alt: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '/placeholder.png'
});

const loaded = ref(false);

const onLoad = () => {
  loaded.value = true;
};
</script>
```

#### 4.2 组件懒加载

**实施**: 使用动态 import

```typescript
// router/index.ts
const routes = [
  {
    path: '/users',
    component: () => import('@/views/users/UserList.vue')
  },
  {
    path: '/roles',
    component: () => import('@/views/roles/RoleList.vue')
  }
];
```

#### 4.3 第三方库优化

**实施**:
1. 按需引入 Ant Design Vue 组件
2. 使用 CDN 加载大型库

**文件**: `vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['vue', 'vue-router'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter'
        }
      }
    }
  }
});
```

---

### 步骤 5: 减少首屏加载时间 (2小时)

#### 5.1 代码分割优化

**实施**: 优化 chunk 分割策略

**文件**: `vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'antd': ['ant-design-vue'],
          'utils': ['axios', 'dayjs']
        }
      }
    }
  }
});
```

#### 5.2 实现骨架屏

**文件**: `admin-ui/src/components/common/Skeleton.vue`

```vue
<template>
  <div class="skeleton">
    <div class="skeleton-header" />
    <div class="skeleton-content">
      <div class="skeleton-line" v-for="i in lines" :key="i" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  lines?: number;
}

withDefaults(defineProps<Props>(), {
  lines: 3
});
</script>

<style scoped>
.skeleton-header {
  width: 100%;
  height: 40px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.skeleton-line {
  width: 100%;
  height: 20px;
  margin: 10px 0;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

#### 5.3 预加载关键资源

**文件**: `index.html`

```html
<head>
  <!-- 预加载关键字体 -->
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
  
  <!-- 预连接到 API 服务器 -->
  <link rel="preconnect" href="https://api.example.com">
  
  <!-- DNS 预解析 -->
  <link rel="dns-prefetch" href="https://cdn.example.com">
</head>
```

#### 5.4 优化关键 CSS

**实施**: 内联关键 CSS,延迟加载非关键 CSS

**文件**: `vite.config.ts`

```typescript
export default defineConfig({
  build: {
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

---

### 步骤 6: 创建性能测试 (1小时)

#### 6.1 创建性能测试脚本

**文件**: `tests/performance/frontend.perf.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import UserList from '@/views/users/UserList.vue';

describe('前端性能测试', () => {
  test('大列表渲染 < 100ms', async () => {
    const users = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      username: `user${i}`,
      email: `user${i}@example.com`
    }));

    const start = performance.now();
    const wrapper = mount(UserList, {
      props: { users }
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('组件更新 < 50ms', async () => {
    const wrapper = mount(UserList);
    
    const start = performance.now();
    await wrapper.setProps({ filter: 'active' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
```

#### 6.2 创建 Lighthouse CI 配置

**文件**: `lighthouserc.js`

```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5173'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }]
      }
    }
  }
};
```

---

## 验收标准

### 性能指标
- [ ] 首屏加载时间 < 2s
- [ ] FCP < 1.5s
- [ ] LCP < 2.5s
- [ ] TBT < 300ms
- [ ] CLS < 0.1

### 功能验收
- [ ] 虚拟滚动已实现
- [ ] 组件渲染优化已完成
- [ ] 资源加载已优化
- [ ] 骨架屏已实现
- [ ] 性能测试已通过

### 用户体验
- [ ] 长列表滚动流畅
- [ ] 页面切换快速
- [ ] 无明显卡顿
- [ ] 加载状态友好

---

## 优化清单

### 组件渲染优化
- [ ] 使用 v-memo 缓存列表项
- [ ] 使用 v-once 优化静态内容
- [ ] 优化计算属性
- [ ] 使用 shallowRef/shallowReactive

### 虚拟滚动
- [ ] 安装 vue-virtual-scroller
- [ ] 创建 VirtualList 组件
- [ ] 创建 VirtualTable 组件
- [ ] 应用到用户列表
- [ ] 应用到角色列表
- [ ] 应用到审计日志

### 资源加载
- [ ] 实现图片懒加载
- [ ] 优化图片格式
- [ ] 组件懒加载
- [ ] 第三方库按需引入
- [ ] 使用 CDN (可选)

### 首屏优化
- [ ] 优化代码分割
- [ ] 实现骨架屏
- [ ] 预加载关键资源
- [ ] 内联关键 CSS
- [ ] 压缩和混淆

### 性能监控
- [ ] 创建性能测试
- [ ] 配置 Lighthouse CI
- [ ] 添加性能监控埋点

---

## 风险和挑战

### 技术风险
1. **虚拟滚动兼容性** - 需要测试各种场景
2. **组件库限制** - Ant Design Vue 的某些组件可能不支持虚拟滚动
3. **SEO 影响** - 懒加载可能影响 SEO

### 缓解措施
1. 充分测试虚拟滚动功能
2. 对不支持的组件使用替代方案
3. 对关键页面使用 SSR

---

## 实施时间表

| 时间 | 任务 | 预计耗时 |
|------|------|---------|
| 09:00-09:30 | 分析当前性能 | 30分钟 |
| 09:30-11:30 | 优化组件渲染 | 2小时 |
| 11:30-12:00 | 午休 | 30分钟 |
| 12:00-15:00 | 实现虚拟滚动 | 3小时 |
| 15:00-17:00 | 优化资源加载 | 2小时 |
| 17:00-19:00 | 减少首屏时间 | 2小时 |
| 19:00-20:00 | 创建性能测试 | 1小时 |

**总计**: 约10小时 (1-2天)

---

**创建时间**: 2026-02-01  
**创建人**: Kiro AI Assistant  
**状态**: 待执行
