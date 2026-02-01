# AI 数据问答平台 - 备份恢复指南

**版本**: 1.0.0  
**日期**: 2026-02-01

---

## 目录

1. [备份概述](#备份概述)
2. [备份策略](#备份策略)
3. [备份配置](#备份配置)
4. [执行备份](#执行备份)
5. [恢复备份](#恢复备份)
6. [自动化备份](#自动化备份)
7. [应急预案](#应急预案)
8. [常见问题](#常见问题)
9. [最佳实践](#最佳实践)

---

## 备份概述

### 备份目标

- 保护数据安全，防止数据丢失
- 支持快速恢复，减少停机时间
- 满足合规要求，保留历史数据
- 支持灾难恢复，确保业务连续性

### 备份范围

**数据库备份**:
- 数据库结构 (schema)
- 数据库数据 (data)
- 存储过程、触发器、事件

**文件备份**:
- 上传文件 (uploads/)
- 日志文件 (logs/)
- 配置文件 (.env, pm2.config.js)
- 模块文件 (modules/)
- 数据文件 (data/)

### 备份工具

- `scripts/backup-database.sh` - 数据库备份脚本
- `scripts/backup-files.sh` - 文件备份脚本
- `scripts/restore-backup.sh` - 恢复脚本

---

## 备份策略

### 备份类型

**完整备份**:
- 频率: 每天一次
- 时间: 凌晨 2:00
- 保留: 7 天

**增量备份**:
- 频率: 每 6 小时一次
- 时间: 02:00, 08:00, 14:00, 20:00
- 保留: 3 天

**归档备份**:
- 频率: 每月一次
- 时间: 每月 1 日凌晨 2:00
- 保留: 12 个月

### 备份存储

**本地存储**:
- 位置: `backups/` 目录
- 用途: 快速恢复
- 保留: 7 天

**远程存储** (推荐):
- 位置: 云存储 (OSS/S3)
- 用途: 灾难恢复
- 保留: 30 天

**离线存储** (可选):
- 位置: 磁带/移动硬盘
- 用途: 长期归档
- 保留: 永久

### 备份验证

- 每次备份后自动验证文件完整性
- 每周执行一次恢复测试
- 每月生成备份报告

---

## 备份配置

### 环境变量

在 `.env.production` 中配置备份参数:

```bash
# 备份配置
BACKUP_RETENTION_DAYS=7        # 本地备份保留天数
BACKUP_COMPRESS=true           # 是否压缩备份
BACKUP_REMOTE_ENABLED=false    # 是否启用远程备份
BACKUP_REMOTE_TYPE=oss         # 远程存储类型: oss, s3
BACKUP_REMOTE_BUCKET=backups   # 远程存储桶名称
```

### 创建备份目录

```bash
# 创建备份目录结构
mkdir -p backups/database
mkdir -p backups/files
mkdir -p backups/archive
mkdir -p logs
```

### 配置权限

```bash
# 设置脚本执行权限
chmod +x scripts/backup-database.sh
chmod +x scripts/backup-files.sh
chmod +x scripts/restore-backup.sh

# 设置备份目录权限
chmod 700 backups
```

---

## 执行备份

### 手动备份

#### 备份数据库

```bash
# 执行数据库备份
./scripts/backup-database.sh

# 查看备份结果
ls -lh backups/database/

# 查看备份报告
cat logs/backup-report-*.txt
```

**输出示例**:
```
[INFO] 数据库备份开始
[INFO] 加载环境变量...
[INFO] 已加载 .env.production ✓
[INFO] 检查备份环境...
[INFO] mysqldump 已安装 ✓
[INFO] gzip 已安装 ✓
[INFO] 环境检查完成 ✓
[INFO] 创建备份目录...
[INFO] 备份目录: backups/database/20260201_120000 ✓
[INFO] 备份数据库结构...
[INFO] 数据库结构备份完成 ✓
[INFO] 备份数据库数据...
[INFO] 数据库数据备份完成 ✓
[INFO] 备份完整数据库...
[INFO] 完整数据库备份完成 ✓
[INFO] 压缩备份文件...
[INFO] 备份文件压缩完成 ✓
[INFO] 生成备份信息...
[INFO] 备份信息生成完成 ✓
[INFO] 验证备份...
[INFO] 备份文件大小: 15M ✓
[INFO] 备份验证完成 ✓
[INFO] 清理旧备份...
[INFO] 旧备份清理完成 (保留 7 天) ✓
[INFO] 生成备份报告...
[INFO] 备份报告: logs/backup-report-20260201_120000.txt ✓
[INFO] 数据库备份完成 ✓
[INFO] 备份位置: backups/database/20260201_120000
```

#### 备份文件

```bash
# 执行文件备份
./scripts/backup-files.sh

# 查看备份结果
ls -lh backups/files/

# 查看备份报告
cat logs/file-backup-report-*.txt
```

**输出示例**:
```
[INFO] 文件备份开始
[INFO] 检查备份环境...
[INFO] tar 已安装 ✓
[INFO] gzip 已安装 ✓
[INFO] 环境检查完成 ✓
[INFO] 创建备份目录...
[INFO] 备份目录: backups/files/20260201_120000 ✓
[INFO] 备份上传文件...
[INFO] 发现 1234 个上传文件
[INFO] 上传文件备份完成 (压缩) ✓
[INFO] 备份日志文件...
[INFO] 发现 56 个日志文件
[INFO] 日志文件备份完成 (压缩) ✓
[INFO] 备份配置文件...
[INFO] 配置文件备份完成 (压缩) ✓
[INFO] 备份模块文件...
[INFO] 发现 18 个模块
[INFO] 模块文件备份完成 (压缩) ✓
[INFO] 备份数据文件...
[INFO] 发现 89 个数据文件
[INFO] 数据文件备份完成 (压缩) ✓
[INFO] 生成备份信息...
[INFO] 备份信息生成完成 ✓
[INFO] 验证备份...
[INFO] 发现 5 个备份文件 ✓
[INFO] 备份验证完成 ✓
[INFO] 清理旧备份...
[INFO] 旧备份清理完成 (保留 7 天) ✓
[INFO] 生成备份报告...
[INFO] 备份报告: logs/file-backup-report-20260201_120000.txt ✓
[INFO] 文件备份完成 ✓
[INFO] 备份位置: backups/files/20260201_120000
```

#### 完整备份

```bash
# 同时备份数据库和文件
./scripts/backup-database.sh && ./scripts/backup-files.sh
```

### 验证备份

#### 检查备份文件

```bash
# 查看数据库备份
ls -lh backups/database/

# 查看文件备份
ls -lh backups/files/

# 查看备份信息
cat backups/database/*/backup.info
cat backups/files/*/backup.info
```

#### 测试备份完整性

```bash
# 测试数据库备份
gunzip -t backups/database/*/full.sql.gz

# 测试文件备份
tar -tzf backups/files/*/uploads.tar.gz > /dev/null
```

---

## 恢复备份

### 恢复前准备

**重要提示**: 恢复操作将覆盖当前数据，请务必谨慎操作！

#### 检查清单

- [ ] 确认需要恢复的备份
- [ ] 备份当前数据（以防万一）
- [ ] 停止应用服务
- [ ] 通知相关人员
- [ ] 准备回滚方案

#### 备份当前数据

```bash
# 在恢复前先备份当前数据
./scripts/backup-database.sh
./scripts/backup-files.sh
```

### 使用恢复脚本

#### 恢复所有数据（推荐）

```bash
# 恢复最新的数据库和文件备份
./scripts/restore-backup.sh

# 按提示确认恢复
```

**输出示例**:
```
[INFO] 备份恢复开始
[INFO] 加载环境变量...
[INFO] 已加载 .env.production ✓
[INFO] 检查恢复环境...
[INFO] mysql 客户端已安装 ✓
[INFO] tar 已安装 ✓
[INFO] 环境检查完成 ✓
[INFO] 数据库备份: backups/database/20260201_120000
[INFO] 文件备份: backups/files/20260201_120000
[WARN] 警告: 恢复操作将覆盖当前数据!
确认恢复? (yes/no): yes
[INFO] 停止服务...
[INFO] PM2 服务已停止 ✓
[INFO] 恢复数据库...
[INFO] 使用备份文件: full.sql.gz
[INFO] 数据库恢复完成 ✓
[INFO] 恢复文件...
[INFO] 恢复上传文件...
[INFO] 上传文件恢复完成 ✓
[INFO] 恢复日志文件...
[INFO] 日志文件恢复完成 ✓
[INFO] 发现配置文件备份，是否恢复? (可能覆盖当前配置)
恢复配置文件? (yes/no): no
[INFO] 跳过配置文件恢复
[INFO] 恢复模块文件...
[INFO] 模块文件恢复完成 ✓
[INFO] 恢复数据文件...
[INFO] 数据文件恢复完成 ✓
[INFO] 启动服务...
[INFO] PM2 服务已启动 ✓
[INFO] 验证恢复...
[INFO] 服务运行正常 ✓
[INFO] 恢复验证完成 ✓
[INFO] 生成恢复报告...
[INFO] 恢复报告: logs/restore-report-20260201_130000.txt ✓
[INFO] 备份恢复完成 ✓
```

#### 仅恢复数据库

```bash
# 恢复最新的数据库备份
./scripts/restore-backup.sh -t database
```

#### 仅恢复文件

```bash
# 恢复最新的文件备份
./scripts/restore-backup.sh -t files
```

#### 恢复指定备份

```bash
# 恢复指定日期的备份
./scripts/restore-backup.sh -d backups/database/20260201_120000
```

### 手动恢复

#### 手动恢复数据库

```bash
# 1. 停止服务
pm2 stop all

# 2. 恢复数据库
source .env.production
gunzip -c backups/database/20260201_120000/full.sql.gz | \
  mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME

# 3. 启动服务
pm2 start pm2.config.js

# 4. 验证
pm2 logs
curl http://localhost:3000/health
```

#### 手动恢复文件

```bash
# 1. 停止服务
pm2 stop all

# 2. 恢复上传文件
tar -xzf backups/files/20260201_120000/uploads.tar.gz

# 3. 恢复日志文件
tar -xzf backups/files/20260201_120000/logs.tar.gz

# 4. 恢复模块文件
tar -xzf backups/files/20260201_120000/modules.tar.gz

# 5. 恢复数据文件
tar -xzf backups/files/20260201_120000/data.tar.gz

# 6. 启动服务
pm2 start pm2.config.js

# 7. 验证
pm2 logs
```

### 验证恢复

#### 检查服务状态

```bash
# 检查 PM2 进程
pm2 list

# 检查服务日志
pm2 logs --lines 50

# 检查健康端点
curl http://localhost:3000/health
```

#### 检查数据完整性

```sql
-- 检查数据库表
SHOW TABLES;

-- 检查数据量
SELECT COUNT(*) FROM sys_users;
SELECT COUNT(*) FROM sys_modules;
SELECT COUNT(*) FROM sys_menus;

-- 检查最新数据
SELECT * FROM sys_users ORDER BY created_at DESC LIMIT 5;
```

#### 检查文件完整性

```bash
# 检查上传文件
ls -lh uploads/

# 检查模块文件
ls -lh modules/

# 检查日志文件
ls -lh logs/
```

---

## 自动化备份

### 使用 Cron 定时任务

#### 配置 Cron

```bash
# 编辑 crontab
crontab -e

# 添加以下任务
# 每天凌晨 2:00 执行完整备份
0 2 * * * cd /path/to/ai-data-platform && ./scripts/backup-database.sh && ./scripts/backup-files.sh

# 每 6 小时执行数据库备份
0 */6 * * * cd /path/to/ai-data-platform && ./scripts/backup-database.sh

# 每月 1 日凌晨 2:00 执行归档备份
0 2 1 * * cd /path/to/ai-data-platform && ./scripts/backup-database.sh && ./scripts/backup-files.sh && cp -r backups/database/$(ls -t backups/database | head -1) backups/archive/
```

#### 查看 Cron 任务

```bash
# 查看当前用户的 crontab
crontab -l

# 查看 cron 日志
tail -f /var/log/cron
```

### 使用 PM2 定时任务

#### 创建备份脚本

创建 `scripts/scheduled-backup.sh`:

```bash
#!/bin/bash
cd /path/to/ai-data-platform
./scripts/backup-database.sh
./scripts/backup-files.sh
```

#### 配置 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动定时任务
pm2 start scripts/scheduled-backup.sh --cron "0 2 * * *" --no-autorestart

# 查看任务
pm2 list

# 保存配置
pm2 save
```

### 备份到远程存储

#### 配置阿里云 OSS

```bash
# 安装 ossutil
wget http://gosspublic.alicdn.com/ossutil/1.7.0/ossutil64
chmod +x ossutil64
sudo mv ossutil64 /usr/local/bin/ossutil

# 配置 OSS
ossutil config

# 上传备份
ossutil cp -r backups/database/20260201_120000 oss://your-bucket/backups/database/
```

#### 配置 AWS S3

```bash
# 安装 AWS CLI
pip install awscli

# 配置 AWS
aws configure

# 上传备份
aws s3 sync backups/database/20260201_120000 s3://your-bucket/backups/database/
```

#### 自动上传脚本

创建 `scripts/upload-backup.sh`:

```bash
#!/bin/bash

# 获取最新备份
LATEST_DB=$(ls -t backups/database | head -1)
LATEST_FILES=$(ls -t backups/files | head -1)

# 上传到 OSS
ossutil cp -r backups/database/$LATEST_DB oss://your-bucket/backups/database/
ossutil cp -r backups/files/$LATEST_FILES oss://your-bucket/backups/files/

echo "备份上传完成"
```

---

## 应急预案

### 数据库故障

#### 症状
- 数据库连接失败
- 数据损坏
- 数据丢失

#### 应急步骤

1. **立即停止服务**
```bash
pm2 stop all
```

2. **评估损坏程度**
```bash
# 尝试连接数据库
mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME

# 检查表状态
CHECK TABLE sys_users;
CHECK TABLE sys_modules;
```

3. **选择恢复方案**

**方案 A: 修复数据库** (如果损坏较轻)
```bash
# 修复表
REPAIR TABLE sys_users;
```

**方案 B: 恢复最新备份** (推荐)
```bash
./scripts/restore-backup.sh -t database
```

**方案 C: 恢复指定备份**
```bash
./scripts/restore-backup.sh -d backups/database/20260201_120000
```

4. **验证恢复**
```bash
# 检查数据完整性
mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT COUNT(*) FROM sys_users;"

# 启动服务
pm2 start pm2.config.js

# 检查服务
curl http://localhost:3000/health
```

5. **通知相关人员**
- 通知运维团队
- 通知开发团队
- 通知业务团队

### 文件丢失

#### 症状
- 上传文件无法访问
- 模块文件丢失
- 配置文件损坏

#### 应急步骤

1. **立即停止服务**
```bash
pm2 stop all
```

2. **评估丢失范围**
```bash
# 检查上传文件
ls -lh uploads/

# 检查模块文件
ls -lh modules/

# 检查配置文件
ls -lh .env* pm2.config.js
```

3. **恢复文件**
```bash
# 恢复最新文件备份
./scripts/restore-backup.sh -t files
```

4. **验证恢复**
```bash
# 检查文件完整性
ls -lh uploads/
ls -lh modules/

# 启动服务
pm2 start pm2.config.js

# 检查服务
pm2 logs
```

### 完全灾难

#### 症状
- 服务器完全损坏
- 数据全部丢失
- 需要重新部署

#### 应急步骤

1. **准备新服务器**
- 安装操作系统
- 安装必要软件 (Node.js, MySQL, Redis)
- 配置网络和防火墙

2. **部署应用**
```bash
# 克隆代码
git clone https://github.com/your-org/ai-data-platform.git
cd ai-data-platform

# 配置环境变量
cp .env.production.example .env.production
vi .env.production

# 安装依赖
npm ci --production
cd admin-ui && npm ci --production && npm run build && cd ..
```

3. **恢复备份**

**从远程存储恢复**:
```bash
# 下载备份
ossutil cp -r oss://your-bucket/backups/database/20260201_120000 backups/database/
ossutil cp -r oss://your-bucket/backups/files/20260201_120000 backups/files/

# 恢复数据
./scripts/restore-backup.sh
```

**从离线存储恢复**:
```bash
# 挂载备份介质
mount /dev/sdb1 /mnt/backup

# 复制备份
cp -r /mnt/backup/database/20260201_120000 backups/database/
cp -r /mnt/backup/files/20260201_120000 backups/files/

# 恢复数据
./scripts/restore-backup.sh
```

4. **启动服务**
```bash
pm2 start pm2.config.js
pm2 save
pm2 startup
```

5. **验证系统**
```bash
# 检查服务
pm2 list
pm2 logs

# 检查健康
curl http://localhost:3000/health

# 检查数据
mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT COUNT(*) FROM sys_users;"
```

### 应急联系人

| 角色 | 姓名 | 电话 | 邮箱 |
|------|------|------|------|
| 运维负责人 | [姓名] | [电话] | [邮箱] |
| 开发负责人 | [姓名] | [电话] | [邮箱] |
| 数据库管理员 | [姓名] | [电话] | [邮箱] |
| 业务负责人 | [姓名] | [电话] | [邮箱] |

---

## 常见问题

### 1. 备份失败

**问题**: 备份脚本执行失败

**原因**:
- 磁盘空间不足
- 数据库连接失败
- 权限不足

**解决**:
```bash
# 检查磁盘空间
df -h

# 检查数据库连接
mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT 1;"

# 检查权限
ls -lh scripts/backup-*.sh
chmod +x scripts/backup-*.sh
```

### 2. 备份文件过大

**问题**: 备份文件占用大量磁盘空间

**解决**:
```bash
# 启用压缩
export COMPRESS=true

# 减少保留天数
export BACKUP_RETENTION_DAYS=3

# 清理旧备份
find backups -type d -mtime +7 -exec rm -rf {} +
```

### 3. 恢复速度慢

**问题**: 恢复备份耗时过长

**解决**:
```bash
# 使用并行恢复
gunzip -c full.sql.gz | mysql --max_allowed_packet=1G $DB_NAME

# 临时禁用索引
mysql $DB_NAME -e "SET FOREIGN_KEY_CHECKS=0;"
# 恢复数据
mysql $DB_NAME -e "SET FOREIGN_KEY_CHECKS=1;"
```

### 4. 恢复后数据不一致

**问题**: 恢复后发现数据不完整或不一致

**原因**:
- 备份时数据库正在写入
- 备份文件损坏
- 恢复过程中断

**解决**:
```bash
# 使用一致性备份
mysqldump --single-transaction ...

# 验证备份完整性
gunzip -t full.sql.gz

# 重新恢复
./scripts/restore-backup.sh -d backups/database/20260201_120000
```

### 5. 配置文件冲突

**问题**: 恢复配置文件后服务无法启动

**原因**:
- 环境变量不匹配
- 配置文件版本不兼容

**解决**:
```bash
# 不恢复配置文件，手动合并
tar -xzf configs.tar.gz --exclude=.env*

# 或者恢复后手动调整
vi .env.production
```

---

## 最佳实践

### 备份策略

1. **3-2-1 原则**
   - 保留 3 份备份
   - 使用 2 种不同的存储介质
   - 至少 1 份异地备份

2. **定期测试**
   - 每周执行一次恢复测试
   - 每月执行一次完整恢复演练
   - 记录恢复时间和问题

3. **监控告警**
   - 监控备份任务执行状态
   - 监控备份文件大小变化
   - 备份失败时立即告警

### 备份安全

1. **加密备份**
```bash
# 加密备份文件
openssl enc -aes-256-cbc -salt -in full.sql.gz -out full.sql.gz.enc

# 解密备份文件
openssl enc -d -aes-256-cbc -in full.sql.gz.enc -out full.sql.gz
```

2. **访问控制**
```bash
# 限制备份目录权限
chmod 700 backups
chown -R app:app backups

# 限制脚本权限
chmod 700 scripts/backup-*.sh
chmod 700 scripts/restore-*.sh
```

3. **审计日志**
```bash
# 记录备份操作
echo "$(date) - Backup started by $(whoami)" >> logs/backup-audit.log

# 记录恢复操作
echo "$(date) - Restore started by $(whoami)" >> logs/restore-audit.log
```

### 备份优化

1. **增量备份**
```bash
# 使用 mysqlbinlog 实现增量备份
mysqlbinlog --start-datetime="2026-02-01 00:00:00" \
            --stop-datetime="2026-02-01 23:59:59" \
            /var/log/mysql/mysql-bin.000001 > incremental.sql
```

2. **并行备份**
```bash
# 并行备份多个表
mysqldump --single-transaction --tables sys_users > users.sql &
mysqldump --single-transaction --tables sys_modules > modules.sql &
wait
```

3. **压缩优化**
```bash
# 使用更高的压缩率
gzip -9 full.sql

# 使用更快的压缩工具
pigz -9 full.sql  # 并行 gzip
```

### 恢复优化

1. **快速恢复**
```bash
# 禁用约束检查
mysql $DB_NAME -e "SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0;"

# 恢复数据
gunzip -c full.sql.gz | mysql $DB_NAME

# 启用约束检查
mysql $DB_NAME -e "SET FOREIGN_KEY_CHECKS=1; SET UNIQUE_CHECKS=1;"
```

2. **部分恢复**
```bash
# 只恢复特定表
gunzip -c full.sql.gz | grep -A 1000 "CREATE TABLE sys_users" | mysql $DB_NAME
```

3. **验证恢复**
```bash
# 使用 checksum 验证
mysql $DB_NAME -e "CHECKSUM TABLE sys_users;"
```

### 备份检查清单

#### 每日检查
- [ ] 备份任务是否执行成功
- [ ] 备份文件是否生成
- [ ] 备份文件大小是否正常
- [ ] 备份日志是否有错误

#### 每周检查
- [ ] 执行一次恢复测试
- [ ] 检查备份文件完整性
- [ ] 清理过期备份
- [ ] 更新备份文档

#### 每月检查
- [ ] 执行完整恢复演练
- [ ] 生成备份报告
- [ ] 归档月度备份
- [ ] 审查备份策略

---

## 附录

### 备份脚本参数

#### backup-database.sh

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| DB_HOST | 数据库主机 | localhost |
| DB_USER | 数据库用户 | root |
| DB_PASSWORD | 数据库密码 | - |
| DB_NAME | 数据库名称 | ai_data_platform |
| BACKUP_RETENTION_DAYS | 保留天数 | 7 |

#### backup-files.sh

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| BACKUP_RETENTION_DAYS | 保留天数 | 7 |
| COMPRESS | 是否压缩 | true |

#### restore-backup.sh

| 参数 | 说明 | 示例 |
|------|------|------|
| -t, --type | 恢复类型 | database, files, all |
| -d, --dir | 备份目录 | backups/database/20260201_120000 |
| -h, --help | 帮助信息 | - |

### 相关文档

- [部署指南](deployment-guide.md)
- [迁移指南](migration-guide.md)
- [监控指南](monitoring-guide.md)

---

**最后更新**: 2026-02-01  
**版本**: 1.0.0
