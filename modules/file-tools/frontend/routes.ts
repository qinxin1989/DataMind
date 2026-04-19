/**
 * 文件工具模块前端路由
 */

export default [
  {
    path: '/tools/file',
    name: 'FileTools',
    component: () => import('./views/FileTools.vue'),
    meta: {
      title: '文件工具',
      permission: 'file-tools:view',
    },
  },
];
