import type { RouteRecordRaw, Router } from 'vue-router'
import { moduleApi, type ModuleSummary } from '@/api/module'

type ModuleRouteExports = {
  default?: RouteRecordRaw[] | { routes?: RouteRecordRaw[] }
  routes?: RouteRecordRaw[]
}

type ModuleRouteLoader = () => Promise<ModuleRouteExports>

const moduleRouteLoaders: Record<string, ModuleRouteLoader> = {
  'efficiency-tools': () => import('../../../modules/efficiency-tools/frontend/routes.ts'),
  'file-tools': () => import('../../../modules/file-tools/frontend/routes.ts'),
  'official-doc': () => import('../../../modules/official-doc/frontend/routes.ts'),
  'universal-table': () => import('../../../modules/universal-table/frontend/routes.ts'),
}

const installedModuleRoutes = new Map<string, string[]>()
let ensurePromise: Promise<void> | null = null
let hydrated = false

function normalizeRoutes(moduleExports: ModuleRouteExports): RouteRecordRaw[] {
  if (Array.isArray(moduleExports.default)) {
    return moduleExports.default
  }

  if (Array.isArray(moduleExports.routes)) {
    return moduleExports.routes
  }

  if (Array.isArray(moduleExports.default?.routes)) {
    return moduleExports.default.routes
  }

  return []
}

function cloneRoute(route: RouteRecordRaw): RouteRecordRaw {
  return {
    ...route,
    children: route.children?.map(cloneRoute),
  } as RouteRecordRaw
}

function collectRouteNames(routes: RouteRecordRaw[], names: string[] = []): string[] {
  routes.forEach((route) => {
    if (typeof route.name === 'string') {
      names.push(route.name)
    }

    if (route.children?.length) {
      collectRouteNames(route.children, names)
    }
  })

  return names
}

function resolveRouteParent(route: RouteRecordRaw) {
  if (typeof route.path === 'string' && route.path.startsWith('/tools/')) {
    return {
      parentName: 'Tools',
      route: {
        ...route,
        path: route.path.replace(/^\/tools\//, ''),
      } as RouteRecordRaw,
    }
  }

  return {
    parentName: 'AdminRoot',
    route,
  }
}

async function importRoutesForModule(moduleName: string): Promise<RouteRecordRaw[]> {
  const loader = moduleRouteLoaders[moduleName]
  if (!loader) {
    return []
  }

  const moduleExports = await loader()
  return normalizeRoutes(moduleExports).map(cloneRoute)
}

function uninstallModuleRoutes(router: Router, moduleName: string) {
  const routeNames = installedModuleRoutes.get(moduleName) || []
  routeNames.forEach((routeName) => {
    if (router.hasRoute(routeName)) {
      router.removeRoute(routeName)
    }
  })
  installedModuleRoutes.delete(moduleName)
}

async function syncModuleRoutes(router: Router, modules: ModuleSummary[]) {
  const activeModuleNames = new Set(
    modules
      .filter((item) => item.status === 'enabled' && item.hasFrontend && item.frontendIntegration === 'module')
      .map((item) => item.name)
  )

  Array.from(installedModuleRoutes.keys()).forEach((moduleName) => {
    if (!activeModuleNames.has(moduleName)) {
      uninstallModuleRoutes(router, moduleName)
    }
  })

  for (const moduleName of activeModuleNames) {
    uninstallModuleRoutes(router, moduleName)

    const routes = await importRoutesForModule(moduleName)
    if (routes.length === 0) {
      console.warn(`[module-routes] 模块 ${moduleName} 未导出前端路由，已跳过`)
      continue
    }

    routes.forEach((route) => {
      const resolved = resolveRouteParent(route)
      router.addRoute(resolved.parentName, resolved.route)
    })

    installedModuleRoutes.set(moduleName, collectRouteNames(routes))
  }
}

export async function ensureModuleRoutesReady(router: Router) {
  if (hydrated) {
    return
  }

  if (!ensurePromise) {
    ensurePromise = moduleApi.getModules()
      .then(async (response) => {
        if (response.success && response.data) {
          await syncModuleRoutes(router, response.data)
          hydrated = true
        }
      })
      .catch((error) => {
        console.warn('[module-routes] 加载模块前端路由失败', error)
      })
      .finally(() => {
        ensurePromise = null
      })
  }

  return ensurePromise
}

export async function reloadModuleRoutes(router: Router) {
  const response = await moduleApi.getModules()
  if (response.success && response.data) {
    await syncModuleRoutes(router, response.data)
    hydrated = true
  }
}
