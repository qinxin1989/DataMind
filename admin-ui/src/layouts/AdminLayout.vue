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
        <div class="logo-mark">S</div>
        <div v-if="!collapsed" class="logo-text">
          <div class="logo-text-main">AI 数据平台</div>
          <div class="logo-text-sub">AI Data Studio</div>
        </div>
      </div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        v-model:openKeys="openKeys"
        theme="light"
        mode="inline"
        @click="handleMenuClick"
      >
        <template v-for="menu in menuItems" :key="menu.key">
          <a-sub-menu v-if="menu.children?.length" :key="menu.key">
            <template #icon>
              <component :is="menu.icon" />
            </template>
            <template #title>{{ menu.label }}</template>
            <a-menu-item v-for="child in menu.children" :key="child.key">
              {{ child.label }}
            </a-menu-item>
          </a-sub-menu>
          <a-menu-item v-else :key="menu.key">
            <template #icon>
              <component :is="menu.icon" />
            </template>
            {{ menu.label }}
          </a-menu-item>
        </template>
      </a-menu>
    </a-layout-sider>

    <a-layout :style="{ marginLeft: collapsed ? '80px' : '220px', transition: 'margin-left 0.2s' }">
      <!-- 顶部导航 -->
      <a-layout-header class="admin-header">
        <div class="admin-header-left">
          <a-button type="text" @click="collapsed = !collapsed">
            <template #icon>
              <MenuUnfoldOutlined v-if="collapsed" />
              <MenuFoldOutlined v-else />
            </template>
          </a-button>
          <Breadcrumb />
        </div>
        <div class="admin-header-right">
          <NotificationCenter />
          <a-dropdown>
            <a-space class="user-dropdown">
              <a-avatar :size="32">
                <template #icon><UserOutlined /></template>
              </a-avatar>
              <span>{{ userStore.username || 'Admin' }}</span>
            </a-space>
            <template #overlay>
              <a-menu @click="handleMenuClick">
                <a-menu-item key="profile">
                  <UserOutlined /> 个人设置
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout">
                  <LogoutOutlined /> 退出登录
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  TeamOutlined,
  MenuOutlined,
  RobotOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import Breadcrumb from '@/components/Breadcrumb.vue'
import NotificationCenter from '@/components/NotificationCenter.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

// 从 localStorage 读取菜单折叠状态，默认为 false（展开）
const savedCollapsed = localStorage.getItem('menuCollapsed')
console.log('Saved menuCollapsed:', savedCollapsed)
const collapsed = ref(savedCollapsed === 'true')
console.log('Initial collapsed state:', collapsed.value)

// 监听折叠状态变化，保存到 localStorage
watch(collapsed, (newValue) => {
  console.log('Menu collapsed changed to:', newValue)
  localStorage.setItem('menuCollapsed', String(newValue))
})

const selectedKeys = ref<string[]>([])
const openKeys = ref<string[]>([])

// 图标映射
const iconMap: Record<string, any> = {
  'DashboardOutlined': DashboardOutlined,
  'RobotOutlined': RobotOutlined,
  'TeamOutlined': TeamOutlined,
  'SettingOutlined': SettingOutlined,
  'DatabaseOutlined': DatabaseOutlined,
  'BellOutlined': BellOutlined,
  'MenuOutlined': MenuOutlined,
}

// 全部菜单配置（用于匹配图标）
const allMenuConfig: Record<string, { icon: any; children?: Record<string, string> }> = {
  '/dashboard': { icon: DashboardOutlined },
  'ai-service': { icon: RobotOutlined, children: { '/ai/chat': 'AI问答', '/ai/knowledge': '知识库', '/ai/history': '对话历史' } },
  'permission': { icon: TeamOutlined, children: { '/user': '用户管理', '/role': '角色管理', '/menu': '菜单管理' } },
  'ai-config': { icon: SettingOutlined, children: { '/ai/config': 'AI管理', '/ai/stats': '使用统计' } },
  'system-config': { icon: DatabaseOutlined, children: { '/datasource': '数据源管理', '/datasource/approval': '数据源审核', '/system/config': '系统管理' } },
  '/notification': { icon: BellOutlined },
}

// 根据用户权限过滤菜单
const menuItems = computed(() => {
  const userMenus = permissionStore.menuTree
  
  // 如果没有加载到菜单权限，显示空
  if (!userMenus || userMenus.length === 0) {
    return []
  }
  
  // 将后端菜单树转换为前端格式
  return userMenus.map((menu: any) => {
    const icon = iconMap[menu.icon] || DashboardOutlined
    
    if (menu.children && menu.children.length > 0) {
      return {
        key: menu.path || menu.id,
        label: menu.title || menu.name,
        icon,
        children: menu.children.map((child: any) => ({
          key: child.path,
          label: child.title || child.name,
        })),
      }
    }
    
    return {
      key: menu.path,
      label: menu.title || menu.name,
      icon,
    }
  })
})

// 监听路由变化更新选中菜单
watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [path]
    // 展开父菜单
    const parentMenu = menuItems.value.find(
      (item) => item.children?.some((child) => child.key === path)
    )
    if (parentMenu) {
      // 保持已展开的菜单，添加当前父菜单
      if (!openKeys.value.includes(parentMenu.key)) {
        openKeys.value = [...openKeys.value, parentMenu.key]
      }
    }
  },
  { immediate: true }
)

// 页面加载时获取菜单数据
onMounted(async () => {
  await permissionStore.loadMenuTree()
})

function handleMenuClick({ key }: { key: string }) {
  if (key === 'profile') {
    router.push('/profile')
  } else if (key === 'logout') {
    handleLogout()
  } else {
    router.push(key)
  }
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.admin-sider {
  overflow: auto;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 10;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
  border-right: 1px solid #e2e8f0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.03);
}

.admin-sider :deep(.ant-layout-sider-children) {
  background: transparent;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 16px;
  color: #1e293b;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}

.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin-right: 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.logo-text-main {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-text-sub {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

/* 菜单样式 */
.admin-sider :deep(.ant-menu-light) {
  background: transparent;
  border-right: none;
}

.admin-sider :deep(.ant-menu-item) {
  margin: 4px 8px;
  border-radius: 8px;
  color: #475569;
  font-weight: 500;
  transition: all 0.2s;
}

.admin-sider :deep(.ant-menu-item:hover) {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  color: #667eea;
}

.admin-sider :deep(.ant-menu-item-selected) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: #ffffff !important;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.admin-sider :deep(.ant-menu-item-selected .anticon) {
  color: #ffffff !important;
}

.admin-sider :deep(.ant-menu-item-selected::after) {
  display: none;
}

.admin-sider :deep(.ant-menu-submenu-title) {
  margin: 4px 8px;
  border-radius: 8px;
  color: #475569;
  font-weight: 500;
}

.admin-sider :deep(.ant-menu-submenu-title:hover) {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  color: #667eea;
}

.admin-sider :deep(.ant-menu-submenu-open > .ant-menu-submenu-title) {
  color: #667eea;
}

.admin-sider :deep(.ant-menu-sub) {
  background: rgba(241, 245, 249, 0.5) !important;
}

.admin-sider :deep(.ant-menu-item .anticon),
.admin-sider :deep(.ant-menu-submenu-title .anticon) {
  font-size: 16px;
}

.admin-header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  position: sticky;
  top: 0;
  z-index: 9;
}

.admin-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-dropdown {
  cursor: pointer;
}

.admin-content {
  margin: 24px;
  padding: 24px;
  background: #fff;
  border-radius: 14px;
  min-height: calc(100vh - 64px - 48px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
