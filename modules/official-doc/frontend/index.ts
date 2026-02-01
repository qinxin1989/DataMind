/**
 * 公文写作模块前端入口
 */

import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/tools/official-doc',
    name: 'OfficialDoc',
    component: () => import('./views/OfficialDoc.vue'),
    meta: {
      title: '公文写作',
      permission: 'official-doc:view'
    }
  }
];

export * from './api';
