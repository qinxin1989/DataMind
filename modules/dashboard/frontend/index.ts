/**
 * Dashboard Module Frontend Entry
 * 大屏管理模块前端入口
 */

import Dashboard from './views/Dashboard.vue';

export default {
  routes: [
    {
      path: '/system/dashboard',
      name: 'Dashboard',
      component: Dashboard,
      meta: {
        title: '大屏管理',
        permission: 'dashboard:view',
      },
    },
  ],
};
