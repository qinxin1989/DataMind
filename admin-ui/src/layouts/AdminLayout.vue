<template>
  <a-layout class="admin-layout">
    <!-- 侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      class="admin-sider"
      :width="220"
    >
      <div class="logo">
        <RobotOutlined v-if="!collapsed" style="font-size: 24px; margin-right: 12px; color: #fff;" />
        <span v-if="!collapsed">AI Data Platform</span>
        <RobotOutlined v-else style="font-size: 24px; color: #fff;" />
      </div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        :open-keys="openKeys"
        theme="light"
        mode="inline"
        @click="handleMenuClick"
        @open-change="onOpenChange"
      >
        <template v-for="item in menus">
          <!-- SubMenu -->
          <a-sub-menu v-if="item.children && item.children.length > 0" :key="'p_' + item.key">
            <template #title>
              <span>
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
              </span>
            </template>
            <a-menu-item v-for="child in item.children" :key="child.key">
              {{ child.label }}
            </a-menu-item>
          </a-sub-menu>

          <!-- Standard Menu Item -->
          <a-menu-item v-else :key="item.key">
            <component :is="item.icon" />
            <span>{{ item.label }}</span>
          </a-menu-item>
        </template>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <!-- 顶部导航 -->
      <a-layout-header class="admin-header">
        <div class="header-left">
          <menu-unfold-outlined
            v-if="collapsed"
            class="trigger"
            @click="() => (collapsed = !collapsed)"
          />
          <menu-fold-outlined v-else class="trigger" @click="() => (collapsed = !collapsed)" />
          
          <a-breadcrumb>
            <a-breadcrumb-item href="/dashboard">首页</a-breadcrumb-item>
            <a-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.title }}
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        
        <div class="header-right">
          <a-tooltip title="通知中心">
            <a-badge dot class="action-item">
              <BellOutlined />
            </a-badge>
          </a-tooltip>
          
          <a-dropdown>
            <div class="user-info-dropdown action-item">
              <a-avatar size="small">
                <template #icon><UserOutlined /></template>
              </a-avatar>
              <span class="username">{{ userStore.currentUser?.fullName || userStore.username }}</span>
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item key="profile" @click="router.push('/profile')">
                  <UserOutlined />
                  个人设置
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" @click="handleLogout">
                  <LogoutOutlined />
                  退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- 内容区域 -->
      <a-layout-content class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { message } from 'ant-design-vue'
import { 
  RobotOutlined, 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  BellOutlined, 
  UserOutlined, 
  LogoutOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  SettingOutlined,
  ToolOutlined,
  BarChartOutlined,
  TeamOutlined,
  MenuOutlined,
  MessageOutlined,
  BookOutlined,
  HistoryOutlined,
  GlobalOutlined,
  AuditOutlined,
  ScanOutlined,
  FileTextOutlined,
  EditOutlined,
  QuestionOutlined,
  FileSearchOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

// 图标映射 - 导入所有可能用到的图标
const iconMap: Record<string, any> = {
  DashboardOutlined,
  RobotOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
  ToolOutlined,
  BarChartOutlined,
  UserOutlined,
  TeamOutlined,
  MenuOutlined,
  MessageOutlined,
  BookOutlined,
  HistoryOutlined,
  GlobalOutlined,
  AuditOutlined,
  ScanOutlined,
  FileTextOutlined,
  EditOutlined,
  QuestionOutlined,
  FileSearchOutlined,
  CloudDownloadOutlined
}

const getIcon = (iconName: string | undefined) => {
  if (!iconName) {
    return MenuOutlined
  }
  const icon = iconMap[iconName]
  if (!icon) {
    console.warn(`Icon not found in map: ${iconName}, available icons:`, Object.keys(iconMap))
    return QuestionOutlined
  }
  return icon
}

const collapsed = ref(false)
// 从 localStorage 读取菜单折叠状态
const savedCollapsed = localStorage.getItem('menuCollapsed')
if (savedCollapsed) {
  collapsed.value = savedCollapsed === 'true'
}

watch(collapsed, (val) => {
  localStorage.setItem('menuCollapsed', String(val))
})

const selectedKeys = ref<string[]>([])
const openKeys = ref<string[]>([])

async function fetchMenus() {
  if (permissionStore.loaded) return
  await permissionStore.loadMenuTree()
  nextTick(() => {
    updateMenuSelection()
  })
}

const menus = computed(() => {
  const mapItem = (item: any) => ({
    key: item.id,
    label: item.title,
    icon: h(getIcon(item.icon)), // 使用 h 函数确保图标正确渲染
    path: item.path,
    children: item.children ? item.children.map(mapItem) : undefined
  })
  return permissionStore.menuTree.map(mapItem)
})

// 顶级子菜单 Key 列表，用于实现手风琴效果
const rootSubmenuKeys = computed(() => menus.value
  .filter(item => item.children && item.children.length > 0)
  .map(item => 'p_' + item.key)
)

const onOpenChange = (keys: string[]) => {
  console.log('[Accordion] openChange triggered, new keys:', keys, 'current openKeys:', openKeys.value)
  
  // 找出最新打开的那一项（在原 openKeys 中不存在的）
  const latestOpenKey = keys.find(key => !openKeys.value.includes(key))
  console.log('[Accordion] latestOpenKey:', latestOpenKey, 'rootSubmenuKeys:', rootSubmenuKeys.value)
  
  if (latestOpenKey && rootSubmenuKeys.value.includes(latestOpenKey)) {
    // 如果最新打开的是顶级菜单，则只保留这一项（手风琴效果）
    console.log('[Accordion] Applying accordion effect, keeping only:', latestOpenKey)
    openKeys.value = [latestOpenKey]
  } else if (latestOpenKey) {
    // 如果打开的不是顶级菜单（可能是嵌套菜单），保留原有顶级菜单 + 新打开的
    openKeys.value = keys
  } else {
    // 关闭菜单时，直接采用组件传入的 keys
    openKeys.value = keys
  }
}

onMounted(() => {
  fetchMenus()
})

const breadcrumbs = computed(() => {
  return route.matched
    .filter(r => r.meta && r.meta.title)
    .map(r => ({
      path: r.path,
      title: r.meta.title
    }))
})

// 监听路由和菜单变化
watch(
  [() => route.path, () => menus.value],
  () => {
    updateMenuSelection()
    // 路由切换时滚动到顶部
    nextTick(() => {
      const content = document.querySelector('.admin-content')
      if (content) {
        content.scrollTop = 0
      }
    })
  },
  { immediate: true, deep: true }
)

function updateMenuSelection() {
  const path = route.path
  
  let targetKey: string | null = null
  let targetOpenKey: string | null = null
  let maxLen = -1

  // Helper to check match and update if better
  const checkMatch = (itemPath: string, key: string, openKey: string | null) => {
    // 匹配规则: 精确匹配 OR 路径前缀匹配(需以/结尾防止部分字符匹配)
    if (path === itemPath || path.startsWith(itemPath + '/')) {
      if (itemPath.length > maxLen) {
        maxLen = itemPath.length
        targetKey = key
        targetOpenKey = openKey
      }
    }
  }

  // 遍历菜单寻找最佳匹配
  for (const item of menus.value) {
    // 1. 检查顶级菜单
    if (item.path) {
      checkMatch(item.path, item.key, null)
    }

    // 2. 检查子菜单
    if (item.children) {
      for (const child of item.children) {
        if (child.path) {
          // 子菜单匹配时，需要展开对应的父菜单(key前缀p_)
          checkMatch(child.path, child.key, 'p_' + item.key)
        }
      }
    }
  }

  // 应用最佳匹配
  if (targetKey) {
    selectedKeys.value = [targetKey]
    // 设置展开项 (手风琴效果)
    if (targetOpenKey) {
      openKeys.value = [targetOpenKey]
    } else {
      openKeys.value = []
    }
  }
}

function handleMenuClick({ key }: { key: string }) {
  const findItem = (items: any[]): any => {
    for (const item of items) {
      if (item.key === key) return item
      if (item.children) {
        const found = findItem(item.children)
        if (found) return found
      }
    }
    return null
  }
  
  const item = findItem(menus.value)
  if (item && item.path) {
    router.push(item.path)
  }
}

function handleLogout() {
  userStore.logout()
  message.success('已退出登录')
  router.push('/login')
}
</script>

<style scoped>
/* 
  大部分样式已移至 src/assets/styles/index.css 以实现统一主题管理 
  此处仅保留组件特定的必要布局微调
*/
.admin-layout {
  min-height: 100vh;
}

.logo-small {
  margin-right: 0 !important;
}
</style>
