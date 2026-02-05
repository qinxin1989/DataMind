/**
 * 角色管理模块路由配置
 */

import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/system/roles',
    name: 'RoleManagement',
    component: () => import('./views/RoleList.vue'),
    meta: {
      title: '角色管理',
      permission: 'role:view',
    },
  },
];

export default routes;
