# 使用 Node.js 18 LTS 版本
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖（PDF 解析需要）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# 复制 package.json 文件
COPY package*.json ./
COPY admin-ui/package*.json ./admin-ui/

# 安装依赖
RUN npm ci --only=production
RUN cd admin-ui && npm ci --only=production

# 复制源代码
COPY . .

# 构建前端
RUN cd admin-ui && npm run build

# 编译 TypeScript
RUN npm run build

# 创建必要的目录
RUN mkdir -p uploads data/audit-logs data/backups data/conversations data/notifications public/downloads

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动命令
CMD ["node", "dist/index.js"]