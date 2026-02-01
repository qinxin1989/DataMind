/**
 * AI配置模块前端路由
 */

export default [
  {
    path: '/ai/config',
    name: 'AIConfig',
    component: () => import('./views/ConfigList.vue'),
    meta: {
      title: 'AI配置',
      permission: 'ai:view'
    }
  }
];
