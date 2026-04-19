/**
 * 公文写作模块前端路由
 */

export default [
  {
    path: '/tools/official-doc',
    name: 'OfficialDoc',
    component: () => import('./views/OfficialDoc.vue'),
    meta: {
      title: '公文写作',
      permission: 'official-doc:view',
    },
  },
];
