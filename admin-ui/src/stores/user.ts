import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'

const USER_STORAGE_KEY = 'currentUser'

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(readStoredUser())
  const token = ref<string | null>(localStorage.getItem('token'))

  const isLoggedIn = computed(() => !!token.value && !!currentUser.value)
  const username = computed(() => currentUser.value?.username || '')
  const userRole = computed(() => currentUser.value?.role || 'viewer')

  function setUser(user: User) {
    currentUser.value = user
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  }

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function logout() {
    currentUser.value = null
    token.value = null
    localStorage.removeItem('token')
    localStorage.removeItem(USER_STORAGE_KEY)
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
