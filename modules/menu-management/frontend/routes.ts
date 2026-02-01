/**
 * 菜单管理模块前端路由
 */

export default [
  {
    path: '/system/menus',
    name: 'MenuManagement',
    component: () => import('./views/MenuList.vue'),
    meta: {
      title: '菜单管理',
      requiresAuth: true,
      permission: 'menu:view',
    },
  },
];
