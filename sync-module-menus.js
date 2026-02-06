/**
 * 同步模块菜单配置，使其与 init.sql 保持一致
 */
const fs = require('fs');
const path = require('path');

// init.sql 中的菜单配置（标准配置）
const standardMenus = {
  'user-management-menu': {
    id: 'user-management-menu',
    title: '用户管理',
    path: '/system/users',
    icon: 'UserOutlined',
    parentId: 'system-management',
    sortOrder: 1,
    permission: 'user:view'
  },
  'role-management-menu': {
    id: 'role-management-menu',
    title: '角色管理',
    path: '/system/roles',
    icon: 'TeamOutlined',
    parentId: 'system-management',
    sortOrder: 2,
    permission: 'role:view'
  },
  'menu-management-menu': {
    id: 'menu-management-menu',
    title: '菜单管理',
    path: '/system/menus',
    icon: 'MenuOutlined',
    parentId: 'system-management',
    sortOrder: 3,
    permission: 'menu:view'
  },
  'ai-config-main': {
    id: 'ai-config-main',
    title: 'AI 模型配置',
    path: '/ai/config',
    icon: 'SettingOutlined',
    parentId: 'system-management',
    sortOrder: 4,
    permission: 'ai:view'
  },
  'system-config-main': {
    id: 'system-config-main',
    title: '系统配置',
    path: '/system/config',
    icon: 'SettingOutlined',
    parentId: 'system-management',
    sortOrder: 900,
    permission: 'system-config:view'
  },
  'system-status': {
    id: 'system-status',
    title: '系统状态',
    path: '/system/status',
    icon: 'DashboardOutlined',
    parentId: 'system-management',
    sortOrder: 901,
    permission: 'system-config:view'
  },
  'audit-log-main': {
    id: 'audit-log-main',
    title: '审计日志',
    path: '/system/audit',
    icon: 'FileSearchOutlined',
    parentId: 'system-management',
    sortOrder: 902,
    permission: 'audit:view'
  },
  'system-backup-main': {
    id: 'system-backup-main',
    title: '备份恢复',
    path: '/system/backup',
    icon: 'CloudServerOutlined',
    parentId: 'system-management',
    sortOrder: 903,
    permission: 'system-backup:view'
  },
  'notification-main': {
    id: 'notification-main',
    title: '通知中心',
    path: '/notification',
    icon: 'BellOutlined',
    parentId: 'system-management',
    sortOrder: 904,
    permission: 'notification:view'
  },
  'dashboard-main': {
    id: 'dashboard-main',
    title: '大屏管理',
    path: '/dashboard/list',
    icon: 'FundOutlined',
    parentId: 'system-management',
    sortOrder: 905,
    permission: 'dashboard:view'
  },
  'ai-stats-menu': {
    id: 'ai-stats-menu',
    title: 'AI统计',
    path: '/ai/stats',
    icon: 'BarChartOutlined',
    parentId: 'ai-center',
    sortOrder: 1,
    permission: 'ai:view'
  },
  'ai-qa-main': {
    id: 'ai-qa-main',
    title: 'AI智能问答',
    path: '/ai/chat',
    icon: 'QuestionCircleOutlined',
    parentId: 'ai-center',
    sortOrder: 30,
    permission: 'ai-qa:view'
  },
  'knowledge-base': {
    id: 'knowledge-base',
    title: '知识库管理',
    path: '/ai/knowledge',
    icon: 'BookOutlined',
    parentId: 'ai-center',
    sortOrder: 31,
    permission: 'ai-qa:knowledge:view'
  },
  'ai-history': {
    id: 'ai-history',
    title: '对话历史',
    path: '/ai/history',
    icon: 'HistoryOutlined',
    parentId: 'ai-center',
    sortOrder: 32,
    permission: 'ai:view'
  },
  'datasource-management-menu': {
    id: 'datasource-management-menu',
    title: '数据源管理',
    path: '/datasource',
    icon: 'DatabaseOutlined',
    parentId: 'data-center',
    sortOrder: 1,
    permission: 'datasource:view'
  },
  'datasource-approval-menu': {
    id: 'datasource-approval-menu',
    title: '数据源审核',
    path: '/datasource/approval',
    icon: 'AuditOutlined',
    parentId: 'data-center',
    sortOrder: 2,
    permission: 'datasource:approve'
  },
  'ai-crawler-assistant': {
    id: 'ai-crawler-assistant',
    title: 'AI 爬虫助手',
    path: '/ai/crawler-assistant',
    icon: 'RobotOutlined',
    parentId: 'data-collection',
    sortOrder: 1,
    permission: 'ai:view'
  },
  'crawler-template-config': {
    id: 'crawler-template-config',
    title: '采集模板配置',
    path: '/ai/crawler-template-config',
    icon: 'SettingOutlined',
    parentId: 'data-collection',
    sortOrder: 2,
    permission: 'crawler_template_view'
  },
  'crawler-management-main': {
    id: 'crawler-management-main',
    title: '爬虫管理',
    path: '/ai/crawler',
    icon: 'DatabaseOutlined',
    parentId: 'data-collection',
    sortOrder: 3,
    permission: 'crawler:view'
  },
  'file-tools-main': {
    id: 'file-tools-main',
    title: '文件工具',
    path: '/tools/file',
    icon: 'FileTextOutlined',
    parentId: 'tools-center',
    sortOrder: 100,
    permission: 'file-tools:view'
  },
  'efficiency-tools-main': {
    id: 'efficiency-tools-main',
    title: '效率工具',
    path: '/tools/efficiency',
    icon: 'ThunderboltOutlined',
    parentId: 'tools-center',
    sortOrder: 110,
    permission: 'efficiency-tools:view'
  },
  'official-doc-main': {
    id: 'official-doc-main',
    title: '公文写作',
    path: '/tools/official-doc',
    icon: 'FileTextOutlined',
    parentId: 'tools-center',
    sortOrder: 120,
    permission: 'official-doc:view'
  },
  'ocr-service-main': {
    id: 'ocr-service-main',
    title: 'OCR 识别',
    path: '/ai/ocr',
    icon: 'ScanOutlined',
    parentId: 'tools-center',
    sortOrder: 130,
    permission: 'ocr:view'
  }
};

// 模块名称到菜单ID的映射
const moduleMenuMap = {
  'user-management': ['user-management-menu'],
  'role-management': ['role-management-menu'],
  'menu-management': ['menu-management-menu'],
  'ai-config': ['ai-config-main'],
  'system-config': ['system-config-main', 'system-status'],
  'audit-log': ['audit-log-main'],
  'system-backup': ['system-backup-main'],
  'notification': ['notification-main'],
  'dashboard': ['dashboard-main'],
  'ai-stats': ['ai-stats-menu'],
  'ai-qa': ['ai-qa-main', 'knowledge-base', 'ai-history'],
  'datasource-management': ['datasource-management-menu', 'datasource-approval-menu'],
  'ai-crawler-assistant': ['ai-crawler-assistant'],
  'crawler-template-config': ['crawler-template-config'],
  'crawler-management': ['crawler-management-main'],
  'file-tools': ['file-tools-main'],
  'efficiency-tools': ['efficiency-tools-main'],
  'official-doc': ['official-doc-main'],
  'ocr-service': ['ocr-service-main']
};

function updateModuleMenus() {
  console.log('开始同步模块菜单配置...\n');

  for (const [moduleName, menuIds] of Object.entries(moduleMenuMap)) {
    const moduleJsonPath = path.join(__dirname, 'modules', moduleName, 'module.json');
    
    if (!fs.existsSync(moduleJsonPath)) {
      console.log(`⚠️  模块 ${moduleName} 不存在，跳过`);
      continue;
    }

    try {
      const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
      
      // 更新菜单配置
      moduleJson.menus = menuIds.map(menuId => {
        const menu = standardMenus[menuId];
        if (!menu) {
          console.log(`⚠️  菜单 ${menuId} 配置不存在`);
          return null;
        }
        return menu;
      }).filter(Boolean);

      // 写回文件
      fs.writeFileSync(moduleJsonPath, JSON.stringify(moduleJson, null, 2), 'utf8');
      console.log(`✅ ${moduleName}: 已更新 ${menuIds.length} 个菜单`);
    } catch (error) {
      console.error(`❌ ${moduleName}: 更新失败 - ${error.message}`);
    }
  }

  console.log('\n✨ 菜单配置同步完成！');
}

updateModuleMenus();
