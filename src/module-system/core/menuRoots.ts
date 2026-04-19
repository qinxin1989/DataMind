export interface RootMenuDefinition {
  id: string;
  title: string;
  path: string;
  icon: string;
  sortOrder: number;
}

export const ROOT_MENU_DEFINITIONS: RootMenuDefinition[] = [
  { id: 'ai-center', title: 'AI创新中心', path: '/ai', icon: 'RobotOutlined', sortOrder: 100 },
  { id: 'data-center', title: '数据资源中心', path: '/data', icon: 'DatabaseOutlined', sortOrder: 200 },
  { id: 'data-collection', title: '数据采集中心', path: '/collection', icon: 'FileSearchOutlined', sortOrder: 300 },
  { id: 'tools-center', title: '工具箱', path: '/tools', icon: 'ToolOutlined', sortOrder: 500 },
  { id: 'ops-management', title: '运维管理', path: '/ops', icon: 'DashboardOutlined', sortOrder: 600 },
  { id: 'system-management', title: '系统基础管理', path: '/system', icon: 'SettingOutlined', sortOrder: 700 },
];

export const LEGACY_ROOT_MENU_MAPPINGS: Record<string, string> = {
  'ai-management': 'ai-center',
  'data-management': 'data-center',
  'toolbox-management': 'tools-center',
  'ai-menu': 'ai-center',
  'rag-knowledge': 'ai-center',
};
