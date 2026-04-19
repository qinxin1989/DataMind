import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem } from '@/types'
import { menuApi } from '@/api/menu'

const PERMISSIONS_STORAGE_KEY = 'permissions'

function readStoredPermissions(): string[] {
  const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
    return []
  }
}

export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<string[]>(readStoredPermissions())
  const menuTree = ref<MenuItem[]>([])
  const loaded = ref(false)
  const hydrated = ref(localStorage.getItem(PERMISSIONS_STORAGE_KEY) !== null)

  const hasPermission = computed(() => (code: string) => {
    if (!code) return true
    return permissions.value.includes(code) || permissions.value.includes('*')
  })

  const hasAnyPermission = computed(() => (codes: string[]) => {
    if (!codes.length) return true
    return codes.some(code => hasPermission.value(code))
  })

  async function loadPermissions(userPermissions: string[]) {
    permissions.value = Array.from(new Set(userPermissions))
    hydrated.value = true
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(permissions.value))
  }

  async function loadMenuTree() {
    try {
      const res = await menuApi.getUserMenuTree()
      if (res.success && res.data) {
        menuTree.value = res.data
      }
    } catch (error) {
      console.error('Failed to load menu tree:', error)
    }
    loaded.value = true
  }

  function reset() {
    permissions.value = []
    menuTree.value = []
    loaded.value = false
    hydrated.value = false
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
  }

  return {
    permissions,
    menuTree,
    loaded,
    hydrated,
    hasPermission,
    hasAnyPermission,
    loadPermissions,
    loadMenuTree,
    reset,
  }
})
