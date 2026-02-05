/**
 * 用户管理模块前端路由
 */

import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/system/users',
    name: 'UserManagement',
    component: () => import('./views/UserList.vue'),
    meta: {
      title: '用户管理',
      icon: 'UserOutlined',
      permission: 'user:view',
    },
  },
];

export default routes;
