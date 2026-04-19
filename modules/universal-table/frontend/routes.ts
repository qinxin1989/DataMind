export default [
  {
    path: '/collection/universal-table',
    name: 'UniversalTable',
    component: () => import('./views/UniversalTable.vue'),
    meta: {
      title: '万表归一',
      permission: 'universal-table:view',
    },
  },
];
