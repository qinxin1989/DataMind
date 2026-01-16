import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem } from '@/types'
import { menuApi } from '@/api/menu'

export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<string[]>([])
  const menuTree = ref<MenuItem[]>([])
  const loaded = ref(false)

  const hasPermission = computed(() => (code: string) => {
    if (!code) return true
    return permissions.value.includes(code) || permissions.value.includes('*')
  })

  const hasAnyPermission = computed(() => (codes: string[]) => {
    if (!codes.length) return true
    return codes.some(code => hasPermission.value(code))
  })

  async function loadPermissions(userPermissions: string[]) {
    permissions.value = userPermissions
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
  }

  return {
    permissions,
    menuTree,
    loaded,
    hasPermission,
    hasAnyPermission,
    loadPermissions,
    loadMenuTree,
    reset,
  }
})
