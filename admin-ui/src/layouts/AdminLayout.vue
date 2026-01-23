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
        v-model:openKeys="openKeys"
        theme="light"
        mode="inline"
        @click="handleMenuClick"
      >
        <template v-for="item in menus" :key="item.key">
          <!-- SubMenu -->
          <a-sub-menu v-if="item.children && item.children.length > 0" :key="item.key">
            <template #title>
              <span>
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
              </span>
            </template>
            <a-menu-item v-for="child in item.children" :key="child.key" @click="handleMenuClick(child)">
              {{ child.label }}
            </a-menu-item>
          </a-sub-menu>

          <!-- Standard Menu Item -->
          <a-menu-item v-else :key="item.key" @click="handleMenuClick(item)">
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
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  RobotOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
  ToolOutlined,
  BarChartOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { message } from 'ant-design-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

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

const menuConfig = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: DashboardOutlined,
    path: '/dashboard'
  },
  {
    key: 'ai',
    label: 'AI 助手',
    icon: RobotOutlined,
    children: [
      { key: 'ai-chat', label: '智能问答', path: '/ai/chat' },
      { key: 'ai-knowledge', label: '知识中心', path: '/ai/knowledge' },
      { key: 'ai-ocr', label: 'OCR 识别', path: '/ai/ocr' },
      { key: 'ai-config', label: 'AI 配置', path: '/ai/config' },
      { key: 'ai-stats', label: '使用统计', path: '/ai/stats' },
    ]
  },
  {
    key: 'tools',
    label: '效率工具',
    icon: ToolOutlined,
    children: [
      { key: 'file-tools', label: '文件工具', path: '/tools/file' },
      { key: 'official-doc', label: '公文写作', path: '/tools/official-doc' },
    ]
  },
  {
    key: 'data',
    label: '数据处理',
    icon: BarChartOutlined,
    path: '/data-processing'
  },
  {
    key: 'datasource',
    label: '数据源管理',
    icon: DatabaseOutlined,
    path: '/datasource'
  },
  {
    key: 'system',
    label: '系统管理',
    icon: SettingOutlined,
    children: [
      { key: 'system-user', label: '用户管理', path: '/user', permission: 'user:view' },
      { key: 'system-role', label: '角色管理', path: '/role', permission: 'role:view' },
      { key: 'system-menu', label: '菜单管理', path: '/menu', permission: 'menu:view' },
      { key: 'system-config', label: '系统配置', path: '/system/config', permission: 'system:config:view' },
    ]
  }
]

const menus = computed(() => {
  // 简单权限过滤
  return menuConfig.filter(item => {
    if (item.children) {
      item.children = item.children.filter((child: any) => {
        return !child.permission || permissionStore.hasPermission(child.permission)
      })
      if (item.children.length === 0) return false
      return true
    }
    return true
  })
})

const breadcrumbs = computed(() => {
  return route.matched
    .filter(r => r.meta && r.meta.title)
    .map(r => ({
      path: r.path,
      title: r.meta.title
    }))
})

// 监听路由变化
watch(
  () => route.path,
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
  { immediate: true }
)

function updateMenuSelection() {
  const path = route.path
  
  // 查找匹配的菜单
  for (const item of menus.value) {
    if (item.path === path) {
      selectedKeys.value = [item.key]
      return
    }
    if (item.children) {
      for (const child of item.children) {
        // 部分匹配，处理子路由情况 (如 /ai/knowledge/manage => /ai/knowledge)
        if (path.startsWith(String(child.path))) { // child.path might be undefined in strict typing
          selectedKeys.value = [child.key]
          if (!openKeys.value.includes(item.key)) {
            openKeys.value.push(item.key)
          }
          return
        }
      }
    }
  }
}

function handleMenuClick(item: any) {
  // 如果是 SubMenu 点击，不做处理
  if (item.children) return

  if (item.path) {
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
