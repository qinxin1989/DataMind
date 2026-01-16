import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isLoggedIn = computed(() => !!token.value && !!currentUser.value)
  const username = computed(() => currentUser.value?.username || '')
  const userRole = computed(() => currentUser.value?.role || 'viewer')

  function setUser(user: User) {
    currentUser.value = user
  }

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function logout() {
    currentUser.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    currentUser,
    token,
    isLoggedIn,
    username,
    userRole,
    setUser,
    setToken,
    logout,
  }
})
