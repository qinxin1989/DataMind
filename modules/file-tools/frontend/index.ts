/**
 * 文件工具模块前端入口
 */

export const routes = [
  {
    path: '/tools/file',
    name: 'FileTools',
    component: () => import('./views/FileTools.vue'),
    meta: {
      title: '文件工具',
      permission: 'file-tools:view'
    }
  }
];

export default {
  install(app: any) {
    console.log('[file-tools] 前端模块已加载');
  }
};
