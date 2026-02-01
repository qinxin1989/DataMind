# AI 数据问答平台 - 数据迁移指南

**版本**: 1.0.0  
**日期**: 2026-02-01  
**适用范围**: 从旧系统迁移到新的模块化架构系统

---

## 目录

1. [迁移概述](#迁移概述)
2. [迁移前准备](#迁移前准备)
3. [迁移步骤](#迁移步骤)
4. [验证迁移](#验证迁移)
5. [回滚方案](#回滚方案)
6. [常见问题](#常见问题)
7. [最佳实践](#最佳实践)

---

## 迁移概述

### 迁移目标

将数据从旧系统迁移到新的模块化架构系统，包括：

- ✅ 用户数据（账号、密码、个人信息）
- ✅ 角色数据（角色定义、权限配置）
- ✅ 权限数据（权限定义、资源配置）
- ✅ 菜单数据（菜单结构、路由配置）
- ✅ 模块数据（模块注册、配置信息）
- ✅ 配置数据（系统配置、业务配置）

### 迁移策略

- **增量迁移**: 支持多次迁移，不会重复迁移已存在的数据
- **数据验证**: 迁移后自动验证数据完整性和一致性
- **回滚支持**: 支持一键回滚到迁移前的状态
- **日志记录**: 详细记录迁移过程和结果

### 迁移工具

| 工具 | 用途 | 文件路径 |
|------|------|---------|
| 迁移脚本 | 执行数据迁移 | `scripts/migrate-data.ts` |
| 验证脚本 | 验证迁移结果 | `scripts/validate-migration.ts` |
| 回滚脚本 | 回滚迁移数据 | `scripts/rollback-migration.ts` |

---

## 迁移前准备

### 1. 环境检查

#### 检查清单

- [ ] Node.js >= 18.0.0
- [ ] npm >= 9.0.0
- [ ] MySQL >= 5.7 或 MariaDB >= 10.3
- [ ] 数据库连接正常
- [ ] 磁盘空间充足（至少 10GB）
- [ ] 数据库备份已完成

#### 检查命令

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 检查 MySQL 版本
mysql --version

# 检查磁盘空间
df -h
```

### 2. 备份数据库

**⚠️ 重要**: 迁移前必须备份数据库！

#### 使用 mysqldump 备份

```bash
# 备份整个数据库
mysqldump -u root -p ai_qa_platform > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份特定表
mysqldump -u root -p ai_qa_platform \
  sys_users sys_roles sys_permissions sys_menus sys_configs \
  > backup_tables_$(date +%Y%m%d_%H%M%S).sql
```

#### 验证备份

```bash
# 检查备份文件大小
ls -lh backup_*.sql

# 检查备份文件内容
head -n 20 backup_*.sql
```

### 3. 配置环境变量

#### 复制配置文件

```bash
# 复制生产环境配置
cp .env.production.example .env.production

# 编辑配置文件
vi .env.production
```

#### 必需配置项

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_qa_platform

# 应用配置
NODE_ENV=production
PORT=3000
```

### 4. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装 TypeScript 依赖
npm install -g ts-node typescript
```

### 5. 停止服务

```bash
# 停止 PM2 服务
pm2 stop all

# 或停止 npm 服务
# Ctrl+C 停止正在运行的服务
```

---

## 迁移步骤

### 方式一: 使用迁移脚本（推荐）

#### 1. 执行迁移

```bash
# 进入项目目录
cd /path/to/ai-qa-platform

# 执行迁移脚本
ts-node scripts/migrate-data.ts
```

#### 2. 查看迁移日志

```bash
# 查看迁移报告
cat logs/migration-report.json

# 查看详细日志
tail -f logs/migration.log
```

#### 3. 验证迁移

```bash
# 执行验证脚本
ts-node scripts/validate-migration.ts

# 查看验证报告
cat logs/validation-report.json
```

### 方式二: 手动迁移

#### 1. 创建模块系统表

```bash
# 执行建表脚本
mysql -u root -p ai_qa_platform < migrations/create-module-system-tables.sql
```

#### 2. 迁移用户数据

```sql
-- 检查用户数据
SELECT COUNT(*) FROM sys_users;

-- 验证用户数据完整性
SELECT * FROM sys_users WHERE username IS NULL OR password IS NULL;
```

#### 3. 迁移角色数据

```sql
-- 检查角色数据
SELECT COUNT(*) FROM sys_roles;

-- 验证角色数据完整性
SELECT * FROM sys_roles WHERE name IS NULL;
```

#### 4. 迁移权限数据

```sql
-- 检查权限数据
SELECT COUNT(*) FROM sys_permissions;

-- 验证权限数据完整性
SELECT * FROM sys_permissions WHERE code IS NULL;
```

#### 5. 迁移菜单数据

```sql
-- 检查菜单数据
SELECT COUNT(*) FROM sys_menus;

-- 验证菜单层级关系
SELECT m.id, m.name, m.parent_id, p.name as parent_name
FROM sys_menus m
LEFT JOIN sys_menus p ON m.parent_id = p.id
WHERE m.parent_id IS NOT NULL AND m.parent_id != 0;
```

#### 6. 注册模块

```sql
-- 插入模块数据
INSERT INTO sys_modules (name, version, description, author, status, enabled, installed_at, created_at, updated_at)
VALUES 
  ('ai-qa', '1.0.0', 'AI 问答模块', 'System', 'installed', 1, NOW(), NOW(), NOW()),
  ('dashboard', '1.0.0', '仪表盘模块', 'System', 'installed', 1, NOW(), NOW(), NOW()),
  ('notification', '1.0.0', '通知模块', 'System', 'installed', 1, NOW(), NOW(), NOW());

-- 验证模块数据
SELECT * FROM sys_modules;
```

---

## 验证迁移

### 自动验证

```bash
# 执行验证脚本
ts-node scripts/validate-migration.ts
```

### 验证项目

#### 1. 表结构验证

- [x] sys_users 表存在
- [x] sys_roles 表存在
- [x] sys_permissions 表存在
- [x] sys_menus 表存在
- [x] sys_modules 表存在
- [x] sys_configs 表存在

#### 2. 数据完整性验证

- [x] 用户数据完整（必填字段不为空）
- [x] 角色数据完整
- [x] 权限数据完整
- [x] 菜单数据完整
- [x] 模块数据完整

#### 3. 数据一致性验证

- [x] 用户-角色关联有效
- [x] 角色-权限关联有效
- [x] 菜单层级关系有效
- [x] 外键约束有效

#### 4. 索引验证

- [x] 主键索引存在
- [x] 外键索引存在
- [x] 性能索引存在

### 手动验证

#### 验证用户数据

```sql
-- 检查用户数量
SELECT COUNT(*) as user_count FROM sys_users;

-- 检查用户数据完整性
SELECT COUNT(*) as invalid_users 
FROM sys_users 
WHERE username IS NULL OR username = '' 
   OR password IS NULL OR password = '';

-- 检查用户-角色关联
SELECT u.username, r.name as role_name
FROM sys_users u
LEFT JOIN sys_user_roles ur ON u.id = ur.user_id
LEFT JOIN sys_roles r ON ur.role_id = r.id
LIMIT 10;
```

#### 验证角色数据

```sql
-- 检查角色数量
SELECT COUNT(*) as role_count FROM sys_roles;

-- 检查角色-权限关联
SELECT r.name as role_name, p.name as permission_name
FROM sys_roles r
LEFT JOIN sys_role_permissions rp ON r.id = rp.role_id
LEFT JOIN sys_permissions p ON rp.permission_id = p.id
LIMIT 10;
```

#### 验证菜单数据

```sql
-- 检查菜单数量
SELECT COUNT(*) as menu_count FROM sys_menus;

-- 检查菜单层级
SELECT 
  m.id,
  m.name,
  m.parent_id,
  p.name as parent_name,
  m.sort_order
FROM sys_menus m
LEFT JOIN sys_menus p ON m.parent_id = p.id
ORDER BY m.sort_order;
```

#### 验证模块数据

```sql
-- 检查模块数量
SELECT COUNT(*) as module_count FROM sys_modules;

-- 检查模块状态
SELECT name, version, status, enabled
FROM sys_modules
ORDER BY name;
```

---

## 回滚方案

### 方式一: 使用回滚脚本（推荐）

```bash
# 执行回滚脚本
ts-node scripts/rollback-migration.ts

# 按提示确认回滚操作
# 输入 yes 确认
```

### 方式二: 手动回滚

#### 1. 停止服务

```bash
pm2 stop all
```

#### 2. 恢复数据库

```bash
# 恢复数据库备份
mysql -u root -p ai_qa_platform < backup_20260201_120000.sql
```

#### 3. 清空迁移数据

```sql
-- 清空模块表
DELETE FROM sys_modules;
DELETE FROM sys_module_configs;
DELETE FROM sys_module_dependencies;

-- 重置自增 ID
ALTER TABLE sys_modules AUTO_INCREMENT = 1;
ALTER TABLE sys_module_configs AUTO_INCREMENT = 1;
ALTER TABLE sys_module_dependencies AUTO_INCREMENT = 1;
```

#### 4. 验证回滚

```sql
-- 检查数据
SELECT COUNT(*) FROM sys_users;
SELECT COUNT(*) FROM sys_roles;
SELECT COUNT(*) FROM sys_modules;
```

#### 5. 启动服务

```bash
pm2 start all
```

---

## 常见问题

### 1. 迁移脚本执行失败

**问题**: 执行迁移脚本时报错

**原因**:
- 数据库连接失败
- 环境变量配置错误
- 依赖包未安装

**解决方案**:

```bash
# 检查数据库连接
mysql -u root -p -e "SELECT 1"

# 检查环境变量
cat .env.production

# 安装依赖
npm install
npm install -g ts-node typescript
```

### 2. 数据验证失败

**问题**: 验证脚本报告数据不完整

**原因**:
- 数据迁移不完整
- 数据关联关系错误
- 外键约束冲突

**解决方案**:

```bash
# 查看验证报告
cat logs/validation-report.json

# 根据报告修复问题
# 例如：修复用户-角色关联
DELETE FROM sys_user_roles 
WHERE user_id NOT IN (SELECT id FROM sys_users)
   OR role_id NOT IN (SELECT id FROM sys_roles);

# 重新验证
ts-node scripts/validate-migration.ts
```

### 3. 模块注册失败

**问题**: 模块未正确注册

**原因**:
- modules 目录不存在
- module.json 文件格式错误
- 模块表未创建

**解决方案**:

```bash
# 检查 modules 目录
ls -la modules/

# 检查 module.json 文件
cat modules/ai-qa/module.json

# 手动创建模块表
mysql -u root -p ai_qa_platform < migrations/create-module-system-tables.sql

# 重新执行迁移
ts-node scripts/migrate-data.ts
```

### 4. 外键约束冲突

**问题**: 迁移时报外键约束错误

**原因**:
- 关联数据不存在
- 数据顺序错误

**解决方案**:

```sql
-- 临时禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 执行迁移操作
-- ...

-- 重新启用外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- 验证外键
SELECT * FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'ai_qa_platform'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

### 5. 迁移后服务无法启动

**问题**: 迁移后服务启动失败

**原因**:
- 数据库连接配置错误
- 模块加载失败
- 依赖包版本不兼容

**解决方案**:

```bash
# 检查服务日志
pm2 logs

# 检查数据库连接
mysql -u root -p ai_qa_platform -e "SELECT 1"

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 重新启动服务
pm2 restart all
```

---

## 最佳实践

### 1. 迁移前

- ✅ **完整备份**: 备份数据库和代码
- ✅ **测试环境**: 先在测试环境验证
- ✅ **停止服务**: 迁移前停止所有服务
- ✅ **检查依赖**: 确保所有依赖已安装
- ✅ **预留时间**: 预留足够的迁移时间

### 2. 迁移中

- ✅ **监控日志**: 实时监控迁移日志
- ✅ **记录问题**: 记录遇到的问题和解决方案
- ✅ **分步执行**: 分步执行，每步验证
- ✅ **保持冷静**: 遇到问题不要慌张
- ✅ **及时沟通**: 及时与团队沟通

### 3. 迁移后

- ✅ **全面验证**: 验证所有功能
- ✅ **性能测试**: 测试系统性能
- ✅ **监控告警**: 配置监控和告警
- ✅ **文档更新**: 更新相关文档
- ✅ **团队培训**: 培训团队成员

### 4. 回滚准备

- ✅ **回滚计划**: 准备详细的回滚计划
- ✅ **回滚测试**: 测试回滚流程
- ✅ **快速决策**: 出现问题快速决策是否回滚
- ✅ **通知机制**: 建立回滚通知机制

### 5. 持续改进

- ✅ **总结经验**: 总结迁移经验教训
- ✅ **优化流程**: 优化迁移流程
- ✅ **自动化**: 提高自动化程度
- ✅ **文档完善**: 完善迁移文档

---

## 迁移检查清单

### 迁移前检查

- [ ] 数据库已备份
- [ ] 代码已备份
- [ ] 环境变量已配置
- [ ] 依赖包已安装
- [ ] 服务已停止
- [ ] 磁盘空间充足
- [ ] 测试环境已验证

### 迁移执行

- [ ] 执行迁移脚本
- [ ] 查看迁移日志
- [ ] 检查错误信息
- [ ] 验证迁移结果
- [ ] 生成迁移报告

### 迁移后验证

- [ ] 表结构验证通过
- [ ] 数据完整性验证通过
- [ ] 数据一致性验证通过
- [ ] 外键约束验证通过
- [ ] 索引验证通过
- [ ] 服务启动成功
- [ ] 功能测试通过
- [ ] 性能测试通过

### 上线准备

- [ ] 迁移文档已更新
- [ ] 团队已培训
- [ ] 监控已配置
- [ ] 告警已配置
- [ ] 回滚方案已准备
- [ ] 应急预案已准备

---

## 附录

### A. 迁移脚本参数

```bash
# migrate-data.ts 参数
ts-node scripts/migrate-data.ts [options]

# 选项:
# --dry-run    # 模拟运行，不实际修改数据
# --verbose    # 详细输出
# --force      # 强制执行，跳过确认
```

### B. 验证脚本参数

```bash
# validate-migration.ts 参数
ts-node scripts/validate-migration.ts [options]

# 选项:
# --strict     # 严格模式，任何警告都视为失败
# --report     # 生成详细报告
```

### C. 回滚脚本参数

```bash
# rollback-migration.ts 参数
ts-node scripts/rollback-migration.ts [options]

# 选项:
# --backup     # 指定备份文件
# --force      # 强制回滚，跳过确认
```

### D. 相关文档

- [部署指南](./deployment-guide.md)
- [模块开发指南](../module-development-guide.md)
- [API 文档](../api/README.md)
- [故障排查指南](./troubleshooting.md)

---

## 支持

如有问题，请联系：

- **技术支持**: support@example.com
- **文档**: https://docs.example.com
- **问题反馈**: https://github.com/example/ai-qa-platform/issues

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-01  
**维护者**: AI QA Platform Team
