/**
 * 效率工具模块前端路由
 */

export default [
  {
    path: '/tools/efficiency',
    name: 'EfficiencyTools',
    component: () => import('./views/EfficiencyTools.vue'),
    meta: {
      title: '效率工具',
      permission: 'efficiency-tools:view',
    },
  },
];
