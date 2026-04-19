import type { User, UserRole, UserStatus } from '@/types'
import { get } from './request'

export interface AuthUserPayload {
  id: string
  username: string
  email?: string
  fullName?: string
  role: UserRole | string
  status: UserStatus | string
  roleIds?: string[]
  createdAt?: number
  updatedAt?: number
  lastLoginAt?: number
  lastLoginIp?: string
}

export interface AuthSessionPayload {
  user: AuthUserPayload
  permissions?: string[]
}

export const authApi = {
  getCurrentSession: () => get<AuthSessionPayload>('/auth/me'),
}

export function normalizeAuthUser(user: AuthUserPayload): User {
  const now = Date.now()

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    roleIds: user.roleIds?.length ? user.roleIds : [String(user.role)],
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    createdAt: user.createdAt ?? now,
    updatedAt: user.updatedAt ?? now,
  }
}

export function normalizePermissions(permissions?: string[]): string[] {
  if (!Array.isArray(permissions)) {
    return []
  }

  return Array.from(new Set(permissions.filter(Boolean)))
}
