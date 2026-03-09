<template>
  <a-breadcrumb class="admin-breadcrumb">
    <a-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index">
      <router-link v-if="item.path && index < breadcrumbs.length - 1" :to="item.path">
        {{ item.title }}
      </router-link>
      <span v-else>{{ item.title }}</span>
    </a-breadcrumb-item>
  </a-breadcrumb>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { menuApi } from '@/api/menu'

interface BreadcrumbItem {
  title: string
  path?: string
}

interface MenuNode {
  id: string
  title: string
  path?: string
  children?: MenuNode[]
}

const route = useRoute()
// 缓存完整菜单树
const menuTreeCache = ref<MenuNode[]>([])
// 路径到标题的映射（支持动态路由模糊匹配）
const pathTitleMap = ref<Map<string, string>>(new Map())
// 是否已加载
let loaded = false

// 构建路径映射，处理动态路由
function buildPathMap(menus: MenuNode[], parentPath = '') {
  for (const menu of menus) {
    if (menu.path) {
      // 存储完整路径
      pathTitleMap.value.set(menu.path, menu.title)
      // 如果是动态路由（包含 :param），生成正则模式
      if (menu.path.includes(':')) {
        const pattern = menu.path.replace(/:[^/]+/g, '[^/]+')
        const regex = new RegExp(`^${pattern}$`)
        pathTitleMap.value.set(`regex:${menu.path}`, regex.source)
        pathTitleMap.value.set(`title:${regex.source}`, menu.title)
      }
    }
    if (menu.children?.length) {
      buildPathMap(menu.children, menu.path || parentPath)
    }
  }
}

// 根据路径查找标题（支持动态路由匹配）
function findTitleByPath(path: string): string | undefined {
  // 1. 精确匹配
  if (pathTitleMap.value.has(path)) {
    return pathTitleMap.value.get(path)
  }
  // 2. 动态路由模糊匹配
  for (const [key, value] of pathTitleMap.value) {
    if (key.startsWith('regex:')) {
      const pattern = value as string
      const regex = new RegExp(pattern)
      if (regex.test(path)) {
        return pathTitleMap.value.get(`title:${pattern}`)
      }
    }
  }
  return undefined
}

// 从后端获取菜单树（只加载一次）
async function loadMenuTree() {
  if (loaded) return
  try {
    const res = await menuApi.getFullMenuTree()
    if (res.success && res.data) {
      menuTreeCache.value = res.data
      buildPathMap(res.data)
      loaded = true
    }
  } catch (error) {
    console.error('获取菜单树失败:', error)
  }
}

// 组件挂载时加载
onMounted(() => {
  loadMenuTree()
})

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ title: '首页', path: '/dashboard' }]

  const matched = route.matched.filter((item) => item.meta?.title || item.path)

  matched.forEach((item) => {
    // 优先使用从数据库菜单获取的标题
    const dbTitle = item.path ? findTitleByPath(item.path) : undefined
    const title = dbTitle || (item.meta?.title as string)

    if (title && title !== '首页') {
      items.push({
        title,
        path: item.path,
      })
    }
  })

  return items
})
</script>

<style scoped>
.admin-breadcrumb {
  margin: 0;
}
</style>
