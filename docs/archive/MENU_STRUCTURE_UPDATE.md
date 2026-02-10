# 菜单结构更新说明

## 更新时间
2025-01-31

## 更新内容

### 1. 创建新的一级菜单
- 菜单名称：数据采集中心
- 菜单ID：`00000000-0000-0000-0000-000000000021`
- 图标：CloudDownloadOutlined
- 排序：4

### 2. 菜单层级调整
将所有爬虫相关功能从"高效办公工具"移至"数据采集中心"下：

```
数据采集中心 (sort_order: 4)
├── AI爬虫助手 (sort_order: 1)
│   ID: 00000000-0000-0000-0000-000000000022
│   路径: /ai/crawler-assistant
│   图标: RobotOutlined
│
├── 采集模板配置 (sort_order: 2)
│   ID: 00000000-0000-0000-0000-000000000023
│   路径: /ai/crawler-template-config
│   图标: SettingOutlined
│
└── 爬虫管理 (sort_order: 3)
    ID: 00000000-0000-0000-0000-000000000014
    路径: /ai/crawler
    图标: DatabaseOutlined
```

### 3. 其他顶级菜单排序调整
- 高效办公工具：sort_order = 5
- 基础系统管理：sort_order = 6

## 已更新的文件

### 数据库脚本
1. **init.sql** - 初始化脚本，包含完整的菜单结构定义
2. **fix-crawler-menu-location.sql** - 增量更新脚本，用于修复现有数据库
3. **sync_menus.sql** - 菜单同步脚本，添加了数据采集中心结构

### TypeScript 脚本（全部使用固定ID）
1. **scripts/create-crawler-menu-structure.ts** - 创建完整的数据采集中心菜单结构
2. **scripts/add-crawler-menus.ts** - 添加爬虫相关菜单到数据采集中心
3. **scripts/add-crawler-management-menu.ts** - 添加爬虫管理菜单
4. **scripts/fix-crawler-management-location.ts** - 修复菜单位置，清理重复菜单

### 统一的菜单ID定义
所有脚本都使用以下固定ID：
```typescript
const MENU_IDS = {
  DATA_CENTER: '00000000-0000-0000-0000-000000000021',      // 数据采集中心
  AI_ASSISTANT: '00000000-0000-0000-0000-000000000022',     // AI爬虫助手
  TEMPLATE_CONFIG: '00000000-0000-0000-0000-000000000023',  // 采集模板配置
  CRAWLER_MANAGEMENT: '00000000-0000-0000-0000-000000000014', // 爬虫管理
  OFFICE_TOOLS: '00000000-0000-0000-0000-000000000018'      // 高效办公工具（用于清理）
};
```

## 执行步骤

### 方式一：使用增量更新脚本（推荐用于现有数据库）
```bash
# 执行 SQL 脚本
mysql -u root -p your_database < fix-crawler-menu-location.sql
```

### 方式二：使用 TypeScript 脚本（推荐用于程序化管理）
```bash
# 创建完整的菜单结构（推荐）
npm run ts-node scripts/create-crawler-menu-structure.ts

# 或者使用其他脚本
npm run ts-node scripts/fix-crawler-management-location.ts
npm run ts-node scripts/add-crawler-menus.ts
```

### 方式三：使用同步脚本（用于批量更新）
```bash
mysql -u root -p your_database < sync_menus.sql
```

## 验证

执行后，在数据库中验证：

```sql
-- 查看数据采集中心及其子菜单
SELECT m.id, m.title, m.path, m.sort_order, p.title as parent_title
FROM sys_menus m
LEFT JOIN sys_menus p ON m.parent_id = p.id
WHERE m.id = '00000000-0000-0000-0000-000000000021'
   OR m.parent_id = '00000000-0000-0000-0000-000000000021'
ORDER BY m.sort_order;

-- 检查是否还有重复菜单
SELECT id, title, path, parent_id
FROM sys_menus
WHERE title IN ('爬虫管理', 'AI爬虫助手', '采集模板配置')
   OR path IN ('/ai/crawler', '/ai/crawler-assistant', '/ai/crawler-template-config');
```

## 注意事项

1. **固定ID**：所有菜单使用固定的UUID，确保在不同环境中的一致性
2. **自动清理**：脚本会自动删除重复菜单和错误位置的菜单
3. **权限迁移**：角色权限会自动迁移到新的菜单ID
4. **刷新浏览器**：执行后需要刷新浏览器才能看到新的菜单结构
5. **幂等性**：所有脚本都是幂等的，可以安全地重复执行

## 回滚方案

如果需要回滚，可以执行：

```sql
-- 删除数据采集中心及其子菜单
DELETE FROM sys_menus WHERE id IN (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000023'
);

-- 将爬虫管理移回高效办公工具（如果需要）
UPDATE sys_menus 
SET parent_id = '00000000-0000-0000-0000-000000000018', sort_order = 1
WHERE id = '00000000-0000-0000-0000-000000000014';

-- 恢复菜单排序
UPDATE sys_menus SET sort_order = 4 WHERE id = '00000000-0000-0000-0000-000000000018';
UPDATE sys_menus SET sort_order = 5 WHERE id = '00000000-0000-0000-0000-000000000010';
```

## 更新历史

- 2025-01-31：初始创建，定义数据采集中心菜单结构
- 2025-01-31：更新所有相关脚本文件，使用统一的固定ID
