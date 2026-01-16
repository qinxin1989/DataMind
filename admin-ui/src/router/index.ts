import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'DashboardOutlined' },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人设置', icon: 'UserOutlined' },
      },
      {
        path: 'user',
        name: 'UserManagement',
        component: () => import('@/views/user/index.vue'),
        meta: { title: '用户管理', icon: 'UserOutlined', permission: 'user:view' },
      },
      {
        path: 'role',
        name: 'RoleManagement',
        component: () => import('@/views/role/index.vue'),
        meta: { title: '角色管理', icon: 'TeamOutlined', permission: 'role:view' },
      },
      {
        path: 'menu',
        name: 'MenuManagement',
        component: () => import('@/views/menu/index.vue'),
        meta: { title: '菜单管理', icon: 'MenuOutlined', permission: 'menu:view' },
      },
      {
        path: 'ai',
        name: 'AIManagement',
        meta: { title: 'AI管理', icon: 'RobotOutlined' },
        children: [
          {
            path: '/ai/chat',
            name: 'AIChat',
            component: () => import('@/views/ai/chat.vue'),
            meta: { title: 'AI问答' },
          },
          {
            path: '/ai/knowledge',
            name: 'AIKnowledge',
            component: () => import('@/views/ai/knowledge.vue'),
            meta: { title: '知识库' },
          },
          {
            path: '/ai/config',
            name: 'AIConfig',
            component: () => import('@/views/ai/config.vue'),
            meta: { title: 'AI配置' },
          },
          {
            path: '/ai/stats',
            name: 'AIStats',
            component: () => import('@/views/ai/stats.vue'),
            meta: { title: '使用统计' },
          },
          {
            path: '/ai/history',
            name: 'AIHistory',
            component: () => import('@/views/ai/history.vue'),
            meta: { title: '对话历史' },
          },
          {
            path: '/ai/ocr',
            name: 'AIOCR',
            component: () => import('@/views/ai/ocr.vue'),
            meta: { title: 'OCR识别' },
          },
        ],
      },
      {
        path: 'datasource',
        name: 'DatasourceManagement',
        component: () => import('@/views/datasource/index.vue'),
        meta: { title: '数据源管理', icon: 'DatabaseOutlined' },
      },
      {
        path: 'datasource/approval',
        name: 'DatasourceApproval',
        component: () => import('@/views/datasource/approval.vue'),
        meta: { title: '数据源审核', icon: 'AuditOutlined', permission: 'datasource:approve' },
      },
      {
        path: 'system',
        name: 'SystemManagement',
        meta: { title: '系统管理', icon: 'SettingOutlined' },
        children: [
          {
            path: '/system/config',
            name: 'SystemConfig',
            component: () => import('@/views/system/config.vue'),
            meta: { title: '系统配置', permission: 'system:config:view' },
          },
          {
            path: '/system/status',
            name: 'SystemStatus',
            component: () => import('@/views/system/status.vue'),
            meta: { title: '系统状态', permission: 'system:status:view' },
          },
          {
            path: '/system/audit',
            name: 'AuditLog',
            component: () => import('@/views/system/audit.vue'),
            meta: { title: '审计日志', permission: 'audit:view' },
          },
          {
            path: '/system/backup',
            name: 'SystemBackup',
            component: () => import('@/views/system/backup.vue'),
            meta: { title: '备份恢复', permission: 'system:backup:view' },
          },
        ],
      },
      {
        path: 'notification',
        name: 'NotificationCenter',
        component: () => import('@/views/notification/index.vue'),
        meta: { title: '通知中心', icon: 'BellOutlined' },
      },
      {
        path: 'dashboard/list',
        name: 'DashboardList',
        component: () => import('@/views/dashboard/list.vue'),
        meta: { title: '大屏管理', icon: 'FundOutlined' },
      },
      {
        path: 'dashboard/editor/:id',
        name: 'DashboardEditor',
        component: () => import('@/views/dashboard/editor.vue'),
        meta: { title: '大屏编辑器' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  document.title = `${to.meta.title || '管理后台'} - Admin`

  // 公开页面直接放行
  if (to.meta.public) {
    next()
    return
  }

  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  // 未登录跳转登录页
  if (!userStore.token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // 检查权限
  const requiredPermission = to.meta.permission as string | undefined
  if (requiredPermission && !permissionStore.hasPermission(requiredPermission)) {
    next({ name: 'Dashboard' })
    return
  }

  next()
})

export default router
