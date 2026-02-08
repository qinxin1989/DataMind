# AI 数据问答平台 - 部署指南

**版本**: 1.0.0  
**日期**: 2026-02-01

---

## 目录

1. [部署前准备](#部署前准备)
2. [环境要求](#环境要求)
3. [部署步骤](#部署步骤)
4. [验证部署](#验证部署)
5. [常见问题](#常见问题)
6. [回滚方案](#回滚方案)

---

## 部署前准备

### 1. 检查清单

在开始部署前，请确认以下事项：

- [ ] 服务器环境已准备就绪
- [ ] 数据库已创建并配置
- [ ] Redis 已安装并运行
- [ ] 域名已配置并解析
- [ ] SSL 证书已准备（生产环境）
- [ ] 环境变量已配置
- [ ] 数据已备份
- [ ] 部署脚本已测试

### 2. 准备环境变量

复制环境变量模板并填写实际值：

```bash
# 生产环境
cp .env.production.example .env.production
vi .env.production

# 测试环境
cp .env.staging.example .env.staging
vi .env.staging
```

**重要配置项**:
- `JWT_SECRET`: 必须修改为随机字符串
- `ENCRYPTION_KEY`: 必须修改为32字符的随机字符串
- `ENCRYPTION_IV`: 必须修改为16字符的随机字符串
- `SESSION_SECRET`: 必须修改为随机字符串
- `DB_PASSWORD`: 数据库密码
- `REDIS_PASSWORD`: Redis密码

### 3. 准备数据库

```sql
-- 创建数据库
CREATE DATABASE ai_data_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并授权
CREATE USER 'ai_platform'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON ai_data_platform.* TO 'ai_platform'@'localhost';
FLUSH PRIVILEGES;
```

---

## 环境要求

### 硬件要求

**最低配置**:
- CPU: 2核
- 内存: 4GB
- 磁盘: 20GB

**推荐配置**:
- CPU: 4核+
- 内存: 8GB+
- 磁盘: 50GB+

### 软件要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+)
- **Node.js**: >= 18.x
- **npm**: >= 9.x
- **MySQL**: >= 8.0
- **Redis**: >= 6.0
- **Nginx**: >= 1.18 (可选，用于反向代理)
- **PM2**: >= 5.x (推荐)

### 安装依赖

```bash
# 安装 Node.js (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 安装 PM2
npm install -g pm2

# 安装 MySQL
sudo apt-get install mysql-server  # Ubuntu
sudo yum install mysql-server       # CentOS

# 安装 Redis
sudo apt-get install redis-server   # Ubuntu
sudo yum install redis               # CentOS
```

---

## 部署步骤

### 方式一: 使用部署脚本（推荐）

```bash
# 1. 克隆代码
git clone https://github.com/your-org/DataMind.git
cd datamind

# 2. 配置环境变量
cp .env.production.example .env.production
vi .env.production

# 3. 执行部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

部署脚本会自动执行以下步骤：
1. 环境检查
2. 备份当前版本
3. 安装依赖
4. 构建前端
5. 数据库迁移
6. 启动服务
7. 健康检查

### 方式二: 手动部署

```bash
# 1. 克隆代码
git clone https://github.com/your-org/DataMind.git
cd datamind

# 2. 配置环境变量
cp .env.production.example .env.production
vi .env.production

# 3. 安装后端依赖
npm ci --production

# 4. 构建前端
cd admin-ui
npm ci --production
npm run build
cd ..

# 5. 数据库迁移
npm run migrate

# 6. 启动服务
pm2 start pm2.config.js
pm2 save
```

---

## 验证部署

### 1. 检查服务状态

```bash
# 使用 PM2
pm2 list
pm2 logs datamind

# 检查进程
ps aux | grep node
```

### 2. 检查健康端点

```bash
# 健康检查
curl http://localhost:3000/health

# 预期响应
{
  "status": "ok",
  "timestamp": "2026-02-01T12:00:00.000Z"
}
```

### 3. 检查数据库连接

```bash
# 登录系统，检查数据库连接是否正常
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 4. 检查日志

```bash
# PM2 日志
pm2 logs ai-data-platform

# 应用日志
tail -f logs/app.log
tail -f logs/error.log
```

---

## 常见问题

### 1. 端口被占用

**问题**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 2. 数据库连接失败

**问题**: `Error: connect ECONNREFUSED 127.0.0.1:3306`

**解决**:
1. 检查 MySQL 是否运行: `systemctl status mysql`
2. 检查数据库配置: `.env.production`
3. 检查数据库用户权限

### 3. Redis 连接失败

**问题**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**解决**:
1. 检查 Redis 是否运行: `systemctl status redis`
2. 检查 Redis 配置: `.env.production`
3. 检查 Redis 密码

### 4. 前端构建失败

**问题**: `Error: ENOSPC: System limit for number of file watchers reached`

**解决**:
```bash
# 增加文件监视器限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 5. 内存不足

**问题**: `JavaScript heap out of memory`

**解决**:
```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## 回滚方案

### 使用回滚脚本

```bash
# 执行回滚
chmod +x scripts/rollback.sh
./scripts/rollback.sh
```

回滚脚本会自动执行以下步骤：
1. 停止服务
2. 恢复代码
3. 恢复数据库
4. 启动服务
5. 健康检查

### 手动回滚

```bash
# 1. 停止服务
pm2 stop DataMind
pm2 delete DataMind

# 2. 恢复代码
BACKUP_DIR=$(cat .last_backup)
rm -rf dist
cp -r $BACKUP_DIR/dist .

# 3. 恢复数据库
source .env.production
mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME < $BACKUP_DIR/database.sql

# 4. 启动服务
pm2 start pm2.config.js
pm2 save

# 5. 验证
pm2 logs DataMind
curl http://localhost:3000/health
```

---

## 配置 Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 证书
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # 反向代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静态文件
    location /uploads {
        alias /path/to/ai-data-platform/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 监控和维护

### 配置 PM2 监控

```bash
# 启用 PM2 监控
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### 配置自动启动

```bash
# 生成启动脚本
pm2 startup

# 保存当前进程列表
pm2 save
```

### 定期维护

```bash
# 每周执行
# 1. 检查日志
pm2 logs --lines 100

# 2. 检查内存使用
pm2 monit

# 3. 重启服务（如需要）
pm2 restart ai-data-platform

# 4. 清理日志
pm2 flush
```

---

## 安全建议

1. **修改默认密码**: 部署后立即修改所有默认密码
2. **配置防火墙**: 只开放必要的端口（80, 443）
3. **启用 HTTPS**: 生产环境必须使用 HTTPS
4. **定期更新**: 定期更新系统和依赖包
5. **备份数据**: 配置自动备份
6. **监控日志**: 定期检查错误日志
7. **限制访问**: 使用 IP 白名单限制管理后台访问

---

## 联系支持

如遇到问题，请联系：
- 技术支持: support@example.com
- 文档: https://docs.example.com
- GitHub: https://github.com/your-org/ai-data-platform

---

**最后更新**: 2026-02-01  
**版本**: 1.0.0
