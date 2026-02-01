/**
 * 示例模块前端路由
 */

import type { RouteRecordRaw } from 'vue-router';

export const exampleRoutes: RouteRecordRaw[] = [
  {
    path: '/example',
    name: 'Example',
    component: () => import('./views/ExampleList.vue'),
    meta: {
      title: '示例模块',
      permission: 'example:view',
      icon: 'ExperimentOutlined'
    }
  }
];
