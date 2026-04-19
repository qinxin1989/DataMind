import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authApi, normalizeAuthUser, normalizePermissions } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { ensureModuleRoutesReady } from './moduleRoutes'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    name: 'AdminRoot',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/workbench',
    children: [
      {
        path: '/workbench',
        name: 'Workbench',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'DashboardOutlined' },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人设置', icon: 'UserOutlined' },
      },

      {
        path: 'ai',
        name: 'AIManagement',
        redirect: '/ai/chat',
        meta: { title: 'AI创新中心', icon: 'RobotOutlined' },
        children: [
          {
            path: '/ai/assistant',
            name: 'UnifiedAssistant',
            component: () => import('@/views/ai/assistant.vue'),
            meta: { title: '智能助手工作台' },
          },
          {
            path: '/ai/chat',
            name: 'AIChat',
            component: () => import('@/views/ai/chat.vue'),
            meta: { title: 'AI智能问答' },
          },
          {
            path: '/ai/knowledge',
            name: 'AIKnowledge',
            component: () => import('@/views/ai/knowledge.vue'),
            redirect: '/ai/knowledge/manage',
            meta: { title: '知识库' },
            children: [
              {
                path: 'manage',
                name: 'KnowledgeManage',
                component: () => import('@/views/ai/knowledge/ManageView.vue'),
                meta: { title: '知识管理' }
              },
              {
                path: 'qa',
                name: 'KnowledgeQA',
                component: () => import('@/views/ai/knowledge/QAView.vue'),
                meta: { title: '智能问答' }
              },
              {
                path: 'writer',
                name: 'KnowledgeWriter',
                component: () => import('@/views/ai/knowledge/WriterView.vue'),
                meta: { title: '长文写作' }
              },
              {
                path: 'graph',
                name: 'KnowledgeGraph',
                component: () => import('@/views/ai/knowledge/GraphView.vue'),
                meta: { title: '知识图谱' }
              }
            ]
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
        path: 'data',
        name: 'DataCenter',
        redirect: '/data/sources',
        meta: { title: '数据资源中心', icon: 'DatabaseOutlined' },
        children: [
          {
            path: 'sources',
            name: 'DatasourceManagement',
            component: () => import('@/views/datasource/index.vue'),
            meta: { title: '数据源管理', icon: 'DatabaseOutlined' },
          },
          {
            path: 'approval',
            name: 'DatasourceApproval',
            component: () => import('@/views/datasource/approval.vue'),
            meta: { title: '数据源审核', icon: 'AuditOutlined' },
          },
        ],
      },
      {
        path: 'collection',
        name: 'DataCollectionCenter',
        redirect: '/collection/assistant',
        meta: { title: '数据采集中心', icon: 'FileSearchOutlined' },
        children: [
          {
            path: 'assistant',
            name: 'AICrawlerAssistant',
            component: () => import('@/views/ai/crawler-assistant.vue'),
            meta: { title: 'AI爬虫助手' },
          },
          {
            path: 'templates',
            name: 'CrawlerTemplateConfig',
            component: () => import('@/views/ai/crawler-template-config.vue'),
            meta: { title: '采集模板配置' },
          },
          {
            path: 'crawlers',
            name: 'AICrawler',
            component: () => import('@/views/ai/crawler.vue'),
            meta: { title: '爬虫管理' },
          },
          {
            path: 'results',
            name: 'AICrawlerResults',
            component: () => import('@/views/ai/crawler-results.vue'),
            meta: { title: '采集结果库' },
          },
        ],
      },
      {
        path: 'tools',
        name: 'Tools',
        redirect: '/tools/file',
        meta: { title: '工具箱', icon: 'ToolOutlined' },
        children: []
      },
      {
        path: 'data-processing',
        name: 'DataProcessing',
        component: () => import('@/views/data-processing/index.vue'),
        meta: { title: '数据处理', icon: 'BarChartOutlined' },
      },
      {
        path: 'ops',
        name: 'OpsManagement',
        redirect: '/ops/monitoring',
        meta: { title: '运维管理', icon: 'DashboardOutlined' },
        children: [
          {
            path: 'monitoring',
            name: 'SystemMonitoring',
            component: () => import('@/views/system/monitoring.vue'),
            meta: { title: '系统监控' },
          },
        ],
      },
      {
        path: 'system',
        name: 'SystemManagement',
        redirect: '/system/users',
        meta: { title: '系统管理', icon: 'SettingOutlined' },
        children: [
          {
            path: 'users',
            name: 'UserManagement',
            component: () => import('@/views/user/index.vue'),
            meta: { title: '用户管理', icon: 'UserOutlined' },
          },
          {
            path: 'roles',
            name: 'RoleManagement',
            component: () => import('@/views/role/index.vue'),
            meta: { title: '角色管理', icon: 'TeamOutlined' },
          },
          {
            path: 'menus',
            name: 'MenuManagement',
            component: () => import('@/views/menu/index.vue'),
            meta: { title: '菜单管理', icon: 'MenuOutlined' },
          },
          {
            path: '/system/config',
            name: 'SystemConfig',
            component: () => import('@/views/system/config.vue'),
            meta: { title: '系统配置', permission: 'system-config:view' },
          },
          {
            path: '/system/status',
            name: 'SystemStatus',
            component: () => import('@/views/system/status.vue'),
            meta: { title: '系统状态', permission: 'system-config:view' },
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
            meta: { title: '备份恢复', permission: 'system-backup:view' },
          },
          {
            path: '/system/modules',
            name: 'ModuleManagement',
            component: () => import('@/views/system/modules.vue'),
            meta: { title: '模块管理', permission: 'system:module:view' },
          },
          {
            path: '/system/template-optimizer',
            name: 'TemplateOptimizer',
            component: () => import('@/views/system/templateOptimizer.vue'),
            meta: { title: '模板优化', permission: 'template:optimize' },
          },
          {
            path: 'notification',
            name: 'NotificationCenter',
            component: () => import('@/views/notification/index.vue'),
            meta: { title: '通知中心', icon: 'BellOutlined', permission: 'notification:view' },
          },
        ],
      },
      {
        path: '/notification',
        name: 'NotificationLegacyRedirect',
        redirect: '/system/notification',
      },
      {
        path: '/datasource',
        name: 'DatasourceLegacyRedirect',
        redirect: '/data/sources',
      },
      {
        path: '/datasource/approval',
        name: 'DatasourceApprovalLegacyRedirect',
        redirect: '/data/approval',
      },
      {
        path: '/ai/crawler-assistant',
        name: 'AICrawlerAssistantLegacyRedirect',
        redirect: '/collection/assistant',
      },
      {
        path: '/ai/crawler-template-config',
        name: 'CrawlerTemplateLegacyRedirect',
        redirect: '/collection/templates',
      },
      {
        path: '/ai/crawler',
        name: 'AICrawlerLegacyRedirect',
        redirect: '/collection/crawlers',
      },
      {
        path: '/ai/crawler-results',
        name: 'AICrawlerResultsLegacyRedirect',
        redirect: '/collection/results',
      },
      {
        path: '/system/monitoring',
        name: 'SystemMonitoringLegacyRedirect',
        redirect: '/ops/monitoring',
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

let sessionBootstrapPromise: Promise<boolean> | null = null

async function ensureSessionReady() {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  if (!userStore.token) {
    return false
  }

  if (userStore.currentUser && permissionStore.hydrated) {
    return true
  }

  if (!sessionBootstrapPromise) {
    sessionBootstrapPromise = authApi.getCurrentSession()
      .then((res: any) => {
        const payload = res?.data ?? res
        if (!payload?.user) {
          throw new Error('未获取到当前用户信息')
        }

        userStore.setUser(normalizeAuthUser(payload.user))
        return permissionStore.loadPermissions(normalizePermissions(payload.permissions))
          .then(() => true)
      })
      .catch(() => {
        permissionStore.reset()
        userStore.logout()
        return false
      })
      .finally(() => {
        sessionBootstrapPromise = null
      })
  }

  return sessionBootstrapPromise
}

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  // 设置页面标题
  document.title = `${to.meta.title || '管理后台'} - Admin`

  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const isNotFoundRoute = to.name === 'NotFound'

  if (isNotFoundRoute && userStore.token) {
    const sessionReady = await ensureSessionReady()
    if (sessionReady) {
      await ensureModuleRoutesReady(router)
      const resolved = router.resolve(to.fullPath)
      if (resolved.name && resolved.name !== 'NotFound') {
        next({ path: to.fullPath, replace: true })
        return
      }
    }
  }

  // 公开页面直接放行
  if (to.meta.public) {
    next()
    return
  }

  // 未登录跳转登录页
  if (!userStore.token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  const sessionReady = await ensureSessionReady()
  if (!sessionReady) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  await ensureModuleRoutesReady(router)

  // 检查权限
  const requiredPermission = to.meta.permission as string | undefined
  if (requiredPermission && !permissionStore.hasPermission(requiredPermission)) {
    next({ name: 'Workbench' })
    return
  }

  next()
})

export default router
