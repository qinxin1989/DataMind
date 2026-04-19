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
        <AppMenuNode
          v-for="item in menus"
          :key="item.id"
          :item="item"
          :get-icon="getIcon"
        />
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
            <a-breadcrumb-item href="/workbench">首页</a-breadcrumb-item>
            <a-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.title }}
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        
        <div class="header-right">
          <a-tooltip title="通知中心">
            <a-badge dot class="action-item" @click="router.push('/system/notification')">
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
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import AppMenuNode from '@/components/layout/AppMenuNode.vue'
import type { MenuItem } from '@/types'
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
  QuestionCircleOutlined,
  FileSearchOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  TableOutlined,
  FundOutlined
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
  QuestionCircleOutlined,
  FileSearchOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  TableOutlined,
  FundOutlined
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
  return permissionStore.menuTree
})

// 顶级子菜单 Key 列表，用于实现手风琴效果
const rootSubmenuKeys = computed(() => menus.value
  .filter(item => item.children && item.children.length > 0)
  .map(item => 'p_' + item.id)
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
  let targetOpenKeys: string[] = []
  let maxLen = -1

  const checkMatch = (itemPath: string, key: string, openKeyChain: string[]) => {
    if (path === itemPath || path.startsWith(itemPath + '/')) {
      if (itemPath.length > maxLen) {
        maxLen = itemPath.length
        targetKey = key
        targetOpenKeys = openKeyChain
      }
    }
  }

  const walkMenus = (items: MenuItem[], parentOpenKeys: string[] = []) => {
    for (const item of items) {
      if (item.path) {
        checkMatch(item.path, item.id, parentOpenKeys)
      }

      if (item.children?.length) {
        walkMenus(item.children, [...parentOpenKeys, `p_${item.id}`])
      }
    }
  }

  walkMenus(menus.value)

  if (targetKey) {
    selectedKeys.value = [targetKey]
    openKeys.value = targetOpenKeys
  }
}

function handleMenuClick({ key }: { key: string }) {
  const findItem = (items: MenuItem[]): MenuItem | null => {
    for (const item of items) {
      if (item.id === key) return item
      if (item.children) {
        const found = findItem(item.children)
        if (found) return found
      }
    }
    return null
  }
  
  const item = findItem(menus.value)
  if (!item) {
    return
  }

  if (item.menuType === 'external' || item.menuType === 'iframe') {
    const targetUrl = item.externalUrl || item.path
    if (!targetUrl) {
      message.warning('该菜单未配置可访问地址')
      return
    }

    if (item.openMode === 'blank') {
      window.open(targetUrl, '_blank', 'noopener')
    } else {
      window.open(targetUrl, '_self')
    }
    return
  }

  if (item.path) {
    router.push(item.path)
  }
}

function handleLogout() {
  permissionStore.reset()
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
