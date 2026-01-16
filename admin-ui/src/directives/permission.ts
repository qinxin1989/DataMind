import type { App, Directive, DirectiveBinding } from 'vue'
import { usePermissionStore } from '@/stores/permission'

const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const { value } = binding
    const permissionStore = usePermissionStore()

    if (value) {
      const hasPermission = Array.isArray(value)
        ? permissionStore.hasAnyPermission(value)
        : permissionStore.hasPermission(value)

      if (!hasPermission) {
        el.parentNode?.removeChild(el)
      }
    }
  },
}

export function setupPermissionDirective(app: App) {
  app.directive('permission', permissionDirective)
}

export default permissionDirective
