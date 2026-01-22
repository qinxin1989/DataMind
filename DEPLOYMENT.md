# AI 数据问答平台 - 部署指南

## 系统要求

- Linux 服务器（Ubuntu 20.04+ 推荐）
- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB RAM
- 至少 20GB 磁盘空间

## 快速部署

### 1. 安装 Docker 和 Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 克隆项目

```bash
git clone <your-repo-url>
cd ai-data-platform
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production .env

# 编辑配置文件
nano .env
```

**重要配置项：**
- `JWT_SECRET`: 设置强密码
- `DB_PASSWORD`: 设置数据库密码
- `QWEN_API_KEY`: 配置 AI 服务密钥
- 其他 AI 服务配置

### 4. 运行部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

### 5. 配置域名和 SSL（可选）

```bash
# 修改 nginx.conf 中的域名
nano nginx.conf

# 获取 SSL 证书（Let's Encrypt）
sudo apt install certbot
sudo certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/
sudo chown $USER:$USER ./ssl/*.pem

# 重启 Nginx
docker-compose restart nginx
```

## 手动部署步骤

### 1. 构建前端

```bash
cd admin-ui
npm ci
npm run build
cd ..
```

### 2. 编译后端

```bash
npm ci
npm run build
```

### 3. 启动服务

```bash
# 使用 Docker Compose
docker-compose up -d

# 或者直接运行（需要先启动 MySQL）
npm start
```

## 服务管理

### 查看服务状态

```bash
docker-compose ps
```

### 查看日志

```bash
# 查看应用日志
docker-compose logs -f app

# 查看数据库日志
docker-compose logs -f mysql

# 查看 Nginx 日志
docker-compose logs -f nginx
```

### 重启服务

```bash
# 重启应用
docker-compose restart app

# 重启所有服务
docker-compose restart
```

### 停止服务

```bash
docker-compose down
```

### 更新代码

```bash
git pull
./deploy.sh
```

## 数据备份

### 数据库备份

```bash
# 创建备份
docker-compose exec mysql mysqldump -u ai_platform -p ai_platform > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复备份
docker-compose exec -i mysql mysql -u ai_platform -p ai_platform < backup_file.sql
```

### 文件备份

```bash
# 备份上传文件和数据
tar -czf backup_files_$(date +%Y%m%d_%H%M%S).tar.gz uploads/ data/
```

## 监控和维护

### 系统监控

```bash
# 查看资源使用
docker stats

# 查看磁盘使用
df -h
du -sh uploads/ data/
```

### 日志轮转

```bash
# 配置 logrotate
sudo nano /etc/logrotate.d/ai-platform
```

### 性能优化

1. **数据库优化**
   - 定期清理日志表
   - 优化查询索引
   - 调整 MySQL 配置

2. **文件清理**
   - 定期清理临时文件
   - 压缩旧的上传文件
   - 清理过期的会话数据

3. **缓存配置**
   - 配置 Nginx 静态文件缓存
   - 启用 Gzip 压缩
   - 使用 CDN（可选）

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   sudo netstat -tlnp | grep :3000
   sudo kill -9 <PID>
   ```

2. **权限问题**
   ```bash
   sudo chown -R $USER:$USER uploads/ data/
   chmod -R 755 uploads/ data/
   ```

3. **内存不足**
   ```bash
   # 增加 swap
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **数据库连接失败**
   - 检查 MySQL 容器状态
   - 验证数据库配置
   - 查看数据库日志

### 日志位置

- 应用日志: `docker-compose logs app`
- 数据库日志: `docker-compose logs mysql`
- Nginx 日志: `docker-compose logs nginx`
- 系统日志: `/var/log/syslog`

## 安全建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

2. **定期更新**
   ```bash
   # 更新系统
   sudo apt update && sudo apt upgrade

   # 更新 Docker 镜像
   docker-compose pull
   docker-compose up -d
   ```

3. **备份策略**
   - 每日自动备份数据库
   - 每周备份文件数据
   - 异地备份重要数据

4. **监控告警**
   - 配置服务监控
   - 设置磁盘空间告警
   - 监控应用性能指标