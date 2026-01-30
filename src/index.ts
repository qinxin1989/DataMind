import express from 'express';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import multer from 'multer';
import * as fs from 'fs';
import { createDataSource, BaseDataSource } from './datasource';
import { AIAgent, skillsRegistry, mcpRegistry, AnalysisStep } from './agent';
import { DataSourceConfig, FileConfig } from './types';
import { ConfigStore, ChatSession } from './store/configStore';
import { AuthService } from './services/authService';
import { createAuthMiddleware, requireAdmin } from './middleware/auth';
import { fileEncryption } from './services/fileEncryption';
import { dataMasking } from './services/dataMasking';
import { RAGEngine } from './rag';
import { initAdminTables } from './admin/core/database';
import { aiConfigService } from './admin/modules/ai/aiConfigService';
import { approvalService } from './admin/modules/approval/approvalService';
import { aiQAService } from './admin/modules/ai-qa/aiQAService';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 创建上传目录
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 使用 UUID 作为文件名，避免中文编码问题
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 静态文件服务 - 使用 admin-ui 构建文件
const adminUiPath = path.join(process.cwd(), 'admin-ui', 'dist');
app.use(express.static(adminUiPath));
console.log('前端路径:', adminUiPath);

// 配置存储（MySQL持久化）
const configStore = new ConfigStore();

// 认证服务
const authService = new AuthService({
  pool: configStore.pool,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

// 认证中间件
const authMiddleware = createAuthMiddleware(authService);

// 存储数据源连接
const dataSources = new Map<string, { config: DataSourceConfig; instance: BaseDataSource }>();

// 检查用户是否可以访问数据源
function canAccessDataSource(config: DataSourceConfig, userId: string): boolean {
  // 用户自己的数据源
  if (config.userId === userId) return true;
  // 公共且已审核通过的数据源
  if (config.visibility === 'public' && config.approvalStatus === 'approved') return true;
  return false;
}

// 检查用户是否可以修改数据源
function canModifyDataSource(config: DataSourceConfig, userId: string): boolean {
  // 只有数据源所有者可以修改
  return config.userId === userId;
}

// AI Agent（从数据库动态获取配置）
const aiAgent = new AIAgent();

// 初始化：加载已保存的数据源
async function initDataSources() {
  await configStore.init();
  await configStore.initChatTable();
  await configStore.initSchemaAnalysisTable();
  // 初始化 Admin 框架数据库表
  await initAdminTables();
  // 初始化审批服务表
  await approvalService.init();
  // 初始化 AI Q&A 服务（包括知识库分类表）
  await aiQAService.init();
  // 初始化默认管理员账户
  await authService.initDefaultAdmin();

  // 设置 AI Agent 从数据库获取配置（返回所有可用配置，支持自动故障转移）
  aiAgent.setConfigGetter(async () => {
    const configs = await aiConfigService.getActiveConfigsByPriority();
    console.log('=== AI 配置列表（按优先级排序）===');
    configs.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (${c.provider}/${c.model}) - priority: ${c.priority}, baseUrl: ${c.baseUrl || '未设置'}`);
    });
    if (!configs || configs.length === 0) {
      console.log('没有可用的 AI 配置！');
      return [];
    }
    // 返回所有配置，AI Agent 会按顺序尝试
    return configs.map(c => ({
      apiKey: c.apiKey,
      baseURL: c.baseUrl,
      model: c.model,
      name: c.name
    }));
  });
  console.log('AI Agent 已配置为从数据库读取配置（支持自动故障转移）');

  const configs = await configStore.getAll();
  for (const config of configs) {
    try {
      const instance = createDataSource(config);
      dataSources.set(config.id, { config, instance });
      console.log(`已加载数据源: ${config.name}`);
    } catch (e: any) {
      console.error(`加载数据源失败 ${config.name}:`, e.message);
    }
  }
}

// ========== 认证 API ==========

// 用户注册（待审核）
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, fullName } = req.body;
    const result = await authService.register(username, password, email, fullName);
    res.json({ user: result.user, message: result.message });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { user, token } = await authService.login(username, password);
    res.json({ user, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 修改密码
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!req.user) return res.status(401).json({ error: '未认证' });

    await authService.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ message: '密码修改成功' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 获取所有用户（仅管理员）
app.get('/api/auth/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取待审核用户（仅管理员）
app.get('/api/auth/users/pending', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await authService.getPendingUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 管理员创建用户（直接激活）
app.post('/api/auth/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, email, fullName } = req.body;
    const user = await authService.createUser(username, password, role, email, fullName);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 审核通过用户（仅管理员）
app.post('/api/auth/users/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await authService.approveUser(req.params.id);
    res.json({ message: '审核通过', user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 拒绝用户注册（仅管理员）
app.post('/api/auth/users/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await authService.rejectUser(req.params.id);
    res.json({ message: '已拒绝' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 更新用户信息（仅管理员）
app.put('/api/auth/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { email, fullName, role, status } = req.body;
    const user = await authService.updateUser(req.params.id, { email, fullName, role, status });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 删除用户（仅管理员）
app.delete('/api/auth/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await authService.deleteUser(req.params.id);
    res.json({ message: '用户已删除' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 文件上传 API ==========

// 上传文件并创建数据源（支持多文件合并到同一数据源，自动加密）
app.post('/api/upload', authMiddleware, upload.array('file', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择文件' });
    }

    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    // 检查是否要添加到已有数据源
    const datasourceId = req.body.datasourceId;
    const datasourceName = req.body.name || '文件数据源';
    const datasourceType = req.body.type || 'structured'; // structured 或 document

    const uploadedFiles: any[] = [];
    const errors: any[] = [];

    // 处理每个文件
    for (const file of files) {
      try {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName).toLowerCase();

        // 根据扩展名检测文件类型
        let detectedType = 'unknown';
        if (['.csv'].includes(ext)) detectedType = 'csv';
        else if (['.json'].includes(ext)) detectedType = 'json';
        else if (['.xlsx', '.xls'].includes(ext)) detectedType = 'xlsx';
        else if (['.txt'].includes(ext)) detectedType = 'txt';
        else if (['.doc', '.docx'].includes(ext)) detectedType = 'word';
        else if (['.pdf'].includes(ext)) detectedType = 'pdf';
        else if (['.md'].includes(ext)) detectedType = 'markdown';

        // 加密文件
        const encryptedPath = await fileEncryption.encryptFile(file.path);
        console.log(`文件已加密: ${originalName} -> ${encryptedPath}`);

        uploadedFiles.push({
          path: encryptedPath,
          fileType: detectedType,
          originalName: originalName,
          encrypted: true
        });
      } catch (err: any) {
        try { fs.unlinkSync(file.path); } catch (e) { }
        try { fs.unlinkSync(file.path + '.enc'); } catch (e) { }
        errors.push({
          file: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          error: err.message
        });
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: '所有文件上传失败', errors });
    }

    let config: DataSourceConfig;
    let isNew = true;

    // 如果指定了数据源ID，添加到已有数据源
    if (datasourceId && dataSources.has(datasourceId)) {
      const existing = dataSources.get(datasourceId)!;
      if (existing.config.userId !== req.user.id) {
        return res.status(403).json({ error: '无权修改此数据源' });
      }

      const existingConfig = existing.config.config as FileConfig;
      // 合并文件列表
      const existingFiles = existingConfig.files || [{
        path: existingConfig.path,
        fileType: existingConfig.fileType,
        originalName: existingConfig.originalName,
        encrypted: existingConfig.encrypted
      }];

      const fileConfig: FileConfig = {
        path: existingFiles[0].path,
        fileType: existingFiles[0].fileType,
        originalName: existingFiles[0].originalName,
        encrypted: existingFiles[0].encrypted,
        files: [...existingFiles, ...uploadedFiles]
      };

      config = {
        ...existing.config,
        config: fileConfig
      };
      isNew = false;

      // 断开旧连接
      await existing.instance.disconnect();
    } else {
      // 创建新数据源
      const fileConfig: FileConfig = {
        path: uploadedFiles[0].path,
        fileType: uploadedFiles[0].fileType,
        originalName: uploadedFiles[0].originalName,
        encrypted: uploadedFiles[0].encrypted,
        files: uploadedFiles.length > 1 ? uploadedFiles : undefined
      };

      config = {
        id: uuidv4(),
        userId: req.user.id,
        name: datasourceName,
        type: 'file',
        config: fileConfig
      };
    }

    // 测试连接
    const instance = createDataSource(config);
    await instance.testConnection();

    // 保存到MySQL
    await configStore.save(config);
    dataSources.set(config.id, { config, instance });

    res.json({
      id: config.id,
      name: config.name,
      isNew,
      filesAdded: uploadedFiles.length,
      totalFiles: (config.config as FileConfig).files?.length || 1,
      errors: errors.length > 0 ? errors : undefined,
      message: isNew
        ? `创建数据源成功，包含 ${uploadedFiles.length} 个文件`
        : `已添加 ${uploadedFiles.length} 个文件到数据源`
    });
  } catch (error: any) {
    const files = req.files as Express.Multer.File[];
    if (files) {
      for (const file of files) {
        try { fs.unlinkSync(file.path); } catch (e) { }
      }
    }
    console.error('文件上传失败:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// 添加数据源
app.post('/api/datasource', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const config: DataSourceConfig = { ...req.body, id: uuidv4(), userId: req.user.id };
    const instance = createDataSource(config);

    await instance.testConnection();

    // 保存到MySQL
    await configStore.save(config);
    dataSources.set(config.id, { config, instance });
    res.json({ id: config.id, message: '数据源添加成功' });
  } catch (error: any) {
    console.error('添加数据源失败:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// 获取数据源列表
app.get('/api/datasource', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  // 返回用户自己的数据源 + 公共且已审核通过的数据源
  const list = Array.from(dataSources.entries())
    .filter(([, { config }]) => {
      // 调试日志
      if (config.name === 'sakila') {
        console.log('=== sakila 数据源信息 ===');
        console.log('userId:', config.userId);
        console.log('visibility:', config.visibility);
        console.log('approvalStatus:', config.approvalStatus);
        console.log('当前用户ID:', req.user!.id);
      }

      // 用户自己的数据源
      if (config.userId === req.user!.id) return true;
      // 公共且已审核通过的数据源
      if (config.visibility === 'public' && config.approvalStatus === 'approved') return true;
      return false;
    })
    .map(([id, { config }]) => ({
      id,
      name: config.name,
      type: config.type,
      host: (config.config as any).host || (config.config as any).url || (config.config as any).path,
      visibility: config.visibility || 'private',
      approvalStatus: config.approvalStatus,
      ownerId: config.userId,
    }));
  res.json(list);
});

// 获取单个数据源详情
app.get('/api/datasource/:id/detail', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  res.json(ds.config);
});

// 测试连接（不保存）
app.post('/api/datasource/test', authMiddleware, async (req, res) => {
  try {
    const config: DataSourceConfig = { ...req.body, id: 'test', userId: req.user?.id || 'test' };
    const instance = createDataSource(config);
    await instance.testConnection();
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// 测试已有数据源连接
app.get('/api/datasource/:id/test', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ success: false, error: '数据源不存在' });

  if (!canAccessDataSource(ds.config, req.user.id)) {
    return res.status(403).json({ success: false, error: '无权访问此数据源' });
  }

  try {
    await ds.instance.testConnection();
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// 更新数据源
app.put('/api/datasource/:id', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const id = req.params.id;
  const ds = dataSources.get(id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权修改此数据源' });
  }

  try {
    const newConfig: DataSourceConfig = { ...req.body, id, userId: req.user.id };
    const instance = createDataSource(newConfig);
    await instance.testConnection();

    // 断开旧连接
    await ds.instance.disconnect();

    // 更新存储
    await configStore.save(newConfig);
    dataSources.set(id, { config: newConfig, instance });

    res.json({ message: '更新成功' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 格式化数据库连接错误信息
function formatDatabaseError(error: any): string {
  const message = error.message || '未知错误';
  const code = error.code || '';

  // PostgreSQL 错误代码
  if (code === '28P01' || message.includes('password authentication failed')) {
    return '数据库连接失败：用户名或密码错误';
  }
  if (code === '28000' || message.includes('authentication failed')) {
    return '数据库连接失败：认证失败';
  }
  if (code === '3D000' || message.includes('does not exist')) {
    return '数据库连接失败：数据库不存在';
  }
  if (message.includes('ECONNREFUSED')) {
    return '数据库连接失败：无法连接到服务器，请检查主机和端口';
  }
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return '数据库连接失败：连接超时';
  }
  if (message.includes('ENOTFOUND')) {
    return '数据库连接失败：无法解析主机名';
  }

  // MySQL 错误
  if (code === 'ER_ACCESS_DENIED_ERROR' || message.includes('Access denied')) {
    return '数据库连接失败：用户名或密码错误';
  }
  if (code === 'ER_BAD_DB_ERROR') {
    return '数据库连接失败：数据库不存在';
  }

  return `数据库连接失败：${message}`;
}

// 获取数据源schema（带AI分析）
app.get('/api/datasource/:id/schema', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (!canAccessDataSource(ds.config, req.user.id)) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const schema = await ds.instance.getSchema();
    res.json(schema);
  } catch (error: any) {
    console.error(`获取数据源 ${ds.config.name} schema 失败:`, error.message);
    const friendlyError = formatDatabaseError(error);
    res.status(500).json({ error: friendlyError });
  }
});

// 获取AI分析的schema（带中文名和推荐问题）- 优先从缓存读取
app.get('/api/datasource/:id/schema/analyze', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (!canAccessDataSource(ds.config, req.user.id)) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  const forceRefresh = req.query.refresh === 'true';

  try {
    // 优先从数据库读取已保存的分析结果
    if (!forceRefresh) {
      const cached = await configStore.getSchemaAnalysis(req.params.id, req.user.id);
      if (cached) {
        return res.json({
          tables: cached.tables,
          suggestedQuestions: cached.suggestedQuestions,
          cached: true,
          isUserEdited: cached.isUserEdited,
          analyzedAt: cached.analyzedAt,
          updatedAt: cached.updatedAt
        });
      }
    }

    // 没有缓存或强制刷新，调用 AI 分析
    const schema = await ds.instance.getSchema();
    const analysis = await aiAgent.analyzeSchema(schema);

    // 保存分析结果
    await configStore.saveSchemaAnalysis({
      datasourceId: req.params.id,
      tables: analysis.tables,
      suggestedQuestions: analysis.suggestedQuestions,
      analyzedAt: Date.now(),
      updatedAt: Date.now(),
      isUserEdited: false
    }, req.user.id);

    res.json({
      ...analysis,
      cached: false,
      isUserEdited: false,
      analyzedAt: Date.now()
    });
  } catch (error: any) {
    console.error(`分析数据源 ${ds.config.name} schema 失败:`, error.message);
    const friendlyError = formatDatabaseError(error);
    res.status(500).json({ error: friendlyError });
  }
});

// 更新表的分析信息（用户编辑）
app.put('/api/datasource/:id/schema/table/:tableName', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { id, tableName } = req.params;
  const updates = req.body;

  // 检查权限
  const ds = dataSources.get(id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });
  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权修改此数据源' });
  }

  try {
    const success = await configStore.updateTableAnalysis(id, tableName, updates, req.user.id);
    if (!success) {
      return res.status(404).json({ error: '表不存在或未分析' });
    }
    res.json({ message: '更新成功' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 更新字段的分析信息（用户编辑）
app.put('/api/datasource/:id/schema/table/:tableName/column/:columnName', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { id, tableName, columnName } = req.params;
  const updates = req.body;

  // 检查权限
  const ds = dataSources.get(id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });
  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权修改此数据源' });
  }

  try {
    const success = await configStore.updateColumnAnalysis(id, tableName, columnName, updates, req.user.id);
    if (!success) {
      return res.status(404).json({ error: '字段不存在或未分析' });
    }
    res.json({ message: '更新成功' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 批量保存字段映射分析结果（用户编辑）
app.post('/api/datasource/:id/schema/analysis/save', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { tables, suggestedQuestions } = req.body;

  // 检查权限
  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });
  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权修改此数据源' });
  }

  try {
    // 保存完整的分析结果
    await configStore.saveSchemaAnalysis({
      datasourceId: req.params.id,
      tables,
      suggestedQuestions: suggestedQuestions || [],
      analyzedAt: Date.now(),
      updatedAt: Date.now(),
      isUserEdited: true
    }, req.user.id);

    res.json({ message: '字段映射保存成功' });
  } catch (error: any) {
    console.error('保存字段映射失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新推荐问题（用户编辑）
app.put('/api/datasource/:id/schema/questions', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { questions } = req.body;

  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: 'questions 必须是数组' });
  }

  // 检查权限
  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });
  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权修改此数据源' });
  }

  try {
    const success = await configStore.updateSuggestedQuestions(req.params.id, questions, req.user.id);
    if (!success) {
      return res.status(404).json({ error: '数据源未分析' });
    }
    res.json({ message: '更新成功' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 刷新推荐问题（基于当前中文名重新生成）
app.post('/api/datasource/:id/schema/questions/refresh', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });
  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    // 获取当前分析数据（包含用户编辑的中文名）
    const cached = await configStore.getSchemaAnalysis(req.params.id, req.user.id);
    if (!cached || !cached.tables) {
      return res.status(404).json({ error: '请先进行AI分析' });
    }

    // 基于中文名生成新的推荐问题
    const questions = generateQuestionsFromAnalysis(cached.tables);

    // 保存新问题
    await configStore.updateSuggestedQuestions(req.params.id, questions, req.user.id);

    res.json({ suggestedQuestions: questions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 基于分析数据生成推荐问题
function generateQuestionsFromAnalysis(tables: any[]): string[] {
  const questions: string[] = [];

  for (const table of tables) {
    const tableCn = table.tableNameCn || table.tableName;

    // 基础统计
    questions.push(`${tableCn}共有多少条记录？`);

    // 找分类字段
    const categoryFields = table.columns?.filter((c: any) =>
      c.name.includes('代码') || c.name.includes('类型') || c.name.includes('性别') ||
      c.name.includes('状态') || c.nameCn?.includes('类型') || c.nameCn?.includes('性别')
    ) || [];

    for (const field of categoryFields.slice(0, 2)) {
      const fieldCn = field.nameCn || field.name;
      questions.push(`按${fieldCn}统计${tableCn}的分布情况`);
    }

    // 日期字段
    const dateFields = table.columns?.filter((c: any) =>
      c.type?.toLowerCase().includes('date') || c.name.includes('日期') || c.nameCn?.includes('日期')
    ) || [];
    if (dateFields.length > 0) {
      questions.push(`按月份统计${tableCn}的时间趋势`);
    }

    // 数值字段
    const numericFields = table.columns?.filter((c: any) =>
      c.name.includes('年龄') || c.name.includes('金额') || c.nameCn?.includes('年龄') || c.nameCn?.includes('金额')
    ) || [];
    if (numericFields.length > 0) {
      const fieldCn = numericFields[0].nameCn || numericFields[0].name;
      questions.push(`${tableCn}中${fieldCn}的统计情况`);
    }
  }

  // 综合分析
  const allTablesCn = tables.map(t => t.tableNameCn || t.tableName).join('和');
  questions.push(`对${allTablesCn}进行全面分析`);

  // 随机打乱并限制数量
  return questions.sort(() => Math.random() - 0.5).slice(0, 15);
}

// 更新数据源可见性
app.put('/api/datasource/:id/visibility', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { visibility, reason } = req.body;
  if (!visibility || !['private', 'public'].includes(visibility)) {
    return res.status(400).json({ error: '可见性参数无效' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权修改此数据源' });
  }

  try {
    const oldVisibility = ds.config.visibility || 'private';

    // 如果是设为公共
    if (visibility === 'public' && oldVisibility !== 'public') {
      // 检查用户是否是管理员
      const isAdmin = req.user.role === 'admin';

      if (isAdmin) {
        // 管理员直接审核通过
        ds.config.visibility = 'public';
        ds.config.approvalStatus = 'approved';
      } else {
        // 普通用户需要创建审批申请
        await approvalService.create({
          type: 'datasource_visibility',
          applicantId: req.user.id,
          applicantName: req.user.username,
          resourceId: ds.config.id,
          resourceName: ds.config.name,
          oldValue: oldVisibility,
          newValue: visibility,
          reason: reason || '申请将数据源设为公共可见',
        });

        // 更新状态为待审批
        ds.config.visibility = 'public';
        ds.config.approvalStatus = 'pending';
      }
    } else {
      // 设为私有，直接生效
      ds.config.visibility = visibility;
      ds.config.approvalStatus = undefined;
    }

    // 保存到数据库
    await configStore.save(ds.config);

    res.json({
      success: true,
      data: {
        id: ds.config.id,
        visibility: ds.config.visibility,
        approvalStatus: ds.config.approvalStatus
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取待审核的数据源列表（管理员）
app.get('/api/datasource/pending-approvals', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pendingList = Array.from(dataSources.values())
      .filter(({ config }) => config.visibility === 'public' && config.approvalStatus === 'pending')
      .map(({ config }) => ({
        id: config.id,
        name: config.name,
        type: config.type,
        host: (config.config as any).host || (config.config as any).path,
        port: (config.config as any).port,
        database: (config.config as any).database,
        ownerId: config.userId,
        visibility: config.visibility,
        approvalStatus: config.approvalStatus,
        createdAt: config.createdAt || Date.now(),
      }));

    res.json({
      success: true,
      data: {
        list: pendingList,
        total: pendingList.length,
        page: 1,
        pageSize: 20
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 审核通过数据源（管理员）
app.post('/api/datasource/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  const ds = dataSources.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.visibility !== 'public' || ds.config.approvalStatus !== 'pending') {
    return res.status(400).json({ error: '该数据源不在待审核状态' });
  }

  try {
    ds.config.approvalStatus = 'approved';
    await configStore.save(ds.config);

    res.json({ success: true, data: { id: ds.config.id, approvalStatus: 'approved' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 审核拒绝数据源（管理员）
app.post('/api/datasource/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
  const { comment } = req.body;
  if (!comment) {
    return res.status(400).json({ error: '拒绝时必须填写原因' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.visibility !== 'public' || ds.config.approvalStatus !== 'pending') {
    return res.status(400).json({ error: '该数据源不在待审核状态' });
  }

  try {
    ds.config.approvalStatus = 'rejected';
    await configStore.save(ds.config);

    res.json({ success: true, data: { id: ds.config.id, approvalStatus: 'rejected' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 临时修复接口：修复公共数据源的审核状态
app.post('/api/datasource/:id/fix-approval', authMiddleware, requireAdmin, async (req, res) => {
  const ds = dataSources.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  try {
    // 如果是公共数据源但没有审核状态，自动设为已审核
    if (ds.config.visibility === 'public' && !ds.config.approvalStatus) {
      ds.config.approvalStatus = 'approved';
      await configStore.save(ds.config);
      res.json({ success: true, message: '已修复审核状态', data: { id: ds.config.id, approvalStatus: 'approved' } });
    } else {
      res.json({ success: true, message: '无需修复', data: { id: ds.config.id, approvalStatus: ds.config.approvalStatus } });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除数据源
app.delete('/api/datasource/:id', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (ds && ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权删除此数据源' });
  }

  if (ds) {
    await ds.instance.disconnect();
    await configStore.delete(req.params.id);
    await configStore.deleteSchemaAnalysis(req.params.id, req.user.id);
    dataSources.delete(req.params.id);
  }
  res.json({ message: '已删除' });
});

// AI 翻译 API (大模型模式)
app.post('/api/ai/translate', authMiddleware, async (req, res) => {
  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts must be an array' });
    }
    console.log(`>>> 收到 AI 翻译请求: ${texts.length} 条文本`);
    const mapping = await aiAgent.translate(texts);
    console.log(`>>> AI 翻译完成，映射数量: ${Object.keys(mapping).length}`);
    res.json(mapping);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 直接翻译 API (Python 包模式)
app.post('/api/ai/translate/direct', authMiddleware, async (req, res) => {
  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts must be an array' });
    }
    console.log(`>>> 收到直接翻译请求: ${texts.length} 条文本`);
    const mapping = await aiAgent.directTranslate(texts);
    console.log(`>>> 直接翻译完成，映射数量: ${Object.keys(mapping).length}`);
    res.json(mapping);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 自然语言问答（带会话上下文）
app.post('/api/ask', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, question, sessionId, noChart } = req.body;
  console.log(`\n[${new Date().toLocaleTimeString()}] >>> 收到问答请求: "${question?.substring(0, 50)}" (数据源: ${datasourceId})`);

  if (!question) {
    return res.status(400).json({ error: '请提供问题' });
  }

  const ds = dataSources.get(datasourceId);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (!canAccessDataSource(ds.config, req.user.id)) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  const startTime = Date.now();

  try {
    // 获取或创建会话
    let session: ChatSession;
    if (sessionId) {
      const existing = await configStore.getChatSession(sessionId, req.user.id);
      session = existing || { id: sessionId, datasourceId, messages: [], createdAt: Date.now() };
    } else {
      session = { id: uuidv4(), datasourceId, messages: [], createdAt: Date.now() };
    }

    // 调用AI Agent（传入历史消息）
    const response = await aiAgent.answer(question, ds.instance, ds.config.type, session.messages, noChart);

    console.log('=== AI Response ===');
    console.log('answer:', response.answer);
    console.log('sql:', response.sql);
    console.log('data length:', response.data?.length);
    console.log('tokensUsed:', response.tokensUsed);
    console.log('modelName:', response.modelName);

    const responseTime = Date.now() - startTime;

    // 对返回数据进行脱敏处理
    let maskedData = response.data;
    let maskedAnswer = response.answer;
    if (response.data && Array.isArray(response.data)) {
      maskedData = dataMasking.maskData(response.data);
    }
    if (response.answer) {
      maskedAnswer = dataMasking.maskText(response.answer);
      console.log('Original answer:', response.answer.substring(0, 100));
      console.log('Masked answer:', maskedAnswer.substring(0, 100));
    } else {
      console.log('WARNING: response.answer is empty or undefined!');
    }

    // 保存对话记录（包含响应时间、token 信息、图表数据）
    session.messages.push({ role: 'user', content: question, timestamp: Date.now() });
    session.messages.push({
      role: 'assistant',
      content: maskedAnswer,
      sql: response.sql,
      chart: response.chart,  // 保存图表配置
      data: maskedData,       // 保存数据（用于图表渲染）
      timestamp: Date.now(),
      responseTime,
      tokensUsed: response.tokensUsed || 0,
      modelName: response.modelName
    });
    await configStore.saveChatSession(session, req.user.id);


    const responseData = {
      ...response,
      answer: maskedAnswer,
      data: maskedData,
      sessionId: session.id,
      responseTime,
      meta: {
        skillUsed: response.skillUsed,
        toolUsed: response.toolUsed,
        visualization: response.visualization
      }
    };

    console.log('=== Final Response to Frontend ===');
    console.log('Full response:', JSON.stringify(responseData).substring(0, 300));
    console.log('answer field:', responseData.answer?.substring(0, 100));
    console.log('sql field:', responseData.sql?.substring(0, 100));
    console.log('data field length:', responseData.data?.length);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    console.error(`问答失败 (数据源: ${ds.config.name}):`, error.message);
    const friendlyError = formatDatabaseError(error);
    res.status(500).json({ error: friendlyError });
  }
});

// 获取会话列表
app.get('/api/chat/sessions/:datasourceId', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  // 检查权限
  const ds = dataSources.get(req.params.datasourceId);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });
  if (!canAccessDataSource(ds.config, req.user.id)) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const sessions = await configStore.getChatSessions(req.params.datasourceId, req.user.id);

    // 如果没有会话，返回一个欢迎会话（仅前端展示，不存库）
    if (sessions.length === 0) {
      const welcomeSession = {
        id: 'welcome-' + Date.now(),
        preview: '欢迎使用智能数据分析助手！请问有什么可以帮您？',
        messageCount: 1,
        createdAt: Date.now()
      };
      return res.json([welcomeSession]);
    }

    res.json(sessions.map(s => ({
      id: s.id,
      preview: s.messages[0]?.content?.slice(0, 50) || '新对话',
      messageCount: s.messages.length,
      createdAt: s.createdAt
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个会话详情
app.get('/api/chat/session/:id', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  try {
    if (req.params.id.startsWith('welcome-')) {
      return res.json({
        id: req.params.id,
        datasourceId: '',
        messages: [{
          role: 'assistant',
          content: '欢迎使用智能数据分析助手！请问有什么可以帮您？',
          timestamp: Date.now()
        }],
        createdAt: Date.now()
      });
    }

    const session = await configStore.getChatSession(req.params.id, req.user.id);
    if (!session) return res.status(404).json({ error: '会话不存在' });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除会话
app.delete('/api/chat/session/:id', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  try {
    await configStore.deleteChatSession(req.params.id, req.user.id);
    res.json({ message: '已删除' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 直接执行SQL
app.post('/api/query', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, sql } = req.body;

  const ds = dataSources.get(datasourceId);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  if (!sql.toLowerCase().trim().startsWith('select')) {
    return res.status(400).json({ error: '只允许SELECT查询' });
  }

  try {
    const result = await ds.instance.executeQuery(sql);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Agent Skills API ==========

// 获取所有可用技能
app.get('/api/agent/skills', authMiddleware, (req, res) => {
  const skills = skillsRegistry.getAll().map(s => ({
    name: s.name,
    description: s.description,
    parameters: s.parameters
  }));
  res.json(skills);
});

// 直接调用技能
app.post('/api/agent/skills/:name/execute', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, params } = req.body;
  const skillName = req.params.name;

  const skill = skillsRegistry.get(skillName);
  if (!skill) {
    return res.status(404).json({ error: '技能不存在' });
  }

  const ds = dataSources.get(datasourceId);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const schemas = await ds.instance.getSchema();
    const result = await skill.execute(params, {
      dataSource: ds.instance,
      schemas,
      dbType: ds.config.type
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MCP Tools API ==========

// 获取所有可用MCP工具
app.get('/api/agent/mcp/tools', authMiddleware, (req, res) => {
  const tools = mcpRegistry.getAllTools().map(({ serverName, tool }) => ({
    server: serverName,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
  res.json(tools);
});

// 调用MCP工具
app.post('/api/agent/mcp/:server/:tool', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { server, tool } = req.params;
  const input = req.body;

  try {
    const result = await mcpRegistry.callTool(server, tool, input);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取Agent能力概览
app.get('/api/agent/capabilities', authMiddleware, (req, res) => {
  res.json({
    skills: skillsRegistry.getAll().map(s => ({
      name: s.name,
      description: s.description
    })),
    mcpTools: mcpRegistry.getAllTools().map(({ serverName, tool }) => ({
      server: serverName,
      name: tool.name,
      description: tool.description
    })),
    features: [
      '自然语言转SQL查询',
      '智能意图识别',
      '数据统计分析',
      '趋势分析',
      'Top N排名',
      '数据对比',
      '异常检测',
      '数据导出',
      '数学计算',
      '日期处理',
      '数据格式化',
      '自动数据分析'
    ]
  });
});

// ========== 自动分析 API ==========

// 自动分析（AI自主规划并执行）
app.post('/api/agent/analyze', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: '请提供分析主题' });
  }

  const ds = dataSources.get(datasourceId);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const report = await aiAgent.autoAnalyze(topic, ds.instance, ds.config.type);
    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 自动分析（SSE流式输出，实时展示进度）
app.get('/api/agent/analyze/stream', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, topic } = req.query;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: '请提供分析主题' });
  }

  const ds = dataSources.get(datasourceId as string);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const report = await aiAgent.autoAnalyze(
      topic,
      ds.instance,
      ds.config.type,
      (step: AnalysisStep) => {
        // 实时推送每个步骤
        res.write(`data: ${JSON.stringify({ type: 'step', data: step })}\n\n`);
      }
    );

    // 推送最终报告
    res.write(`data: ${JSON.stringify({ type: 'complete', data: report })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// ========== BI 大屏 API ==========

// 生成大屏（返回配置和预览HTML）
app.post('/api/agent/dashboard', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, topic, theme = 'dark' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: '请提供大屏主题' });
  }

  const ds = dataSources.get(datasourceId);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const result = await aiAgent.generateDashboard(topic, ds.instance, ds.config.type, theme);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 大屏预览页面（直接返回HTML）
app.get('/api/agent/dashboard/preview', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).send('未认证');
  }

  const { datasourceId, topic, theme = 'dark' } = req.query;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).send('请提供大屏主题');
  }

  const ds = dataSources.get(datasourceId as string);
  if (!ds) {
    return res.status(404).send('数据源不存在');
  }

  // 检查权限：数据源所有者或公共数据源
  if (!canAccessDataSource(ds.config, req.user.id)) {
    return res.status(403).send('无权访问此数据源');
  }

  try {
    const result = await aiAgent.generateDashboard(
      topic,
      ds.instance,
      ds.config.type,
      (theme as 'light' | 'dark' | 'tech') || 'dark'
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(result.previewHtml);
  } catch (error: any) {
    res.status(500).send(`生成失败: ${error.message}`);
  }
});

// ========== 内容编排 + PPT 生成 API ==========

// 内容编排（调用 MCP text_formatter 工具）
app.post('/api/agent/format', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { content, style = 'report' } = req.body;

  if (!content) {
    return res.status(400).json({ error: '请提供要编排的内容' });
  }

  try {
    const result = await mcpRegistry.callTool('text_formatter', 'format_report', {
      content,
      style
    });

    if (result.isError) {
      return res.status(500).json({ error: result.content[0]?.text || '编排失败' });
    }

    res.json({
      formatted: result.content[0]?.text,
      style
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 内容编排 + 生成 PPT（通过 MCP 调度）
app.post('/api/agent/format-and-ppt', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { content, title, theme = 'default', style = 'report' } = req.body;

  if (!content) {
    return res.status(400).json({ error: '请提供要处理的内容' });
  }

  try {
    // 步骤1: 通过 MCP text_formatter 编排内容
    let formattedContent = content;
    try {
      const formatResult = await mcpRegistry.callTool('text_formatter', 'format_report', {
        content,
        style
      });
      if (!formatResult.isError && formatResult.content[0]?.text) {
        formattedContent = formatResult.content[0].text;
      }
    } catch (e) {
      console.log('Text formatting skipped:', e);
    }

    // 步骤2: 通过 MCP ppt_generator 生成 PPT
    const pptResult = await mcpRegistry.callTool('ppt_generator', 'create_ppt_from_text', {
      title: title || '分析报告',
      content: formattedContent,
      theme: theme
    });

    if (pptResult.isError) {
      return res.status(500).json({ error: pptResult.content[0]?.text || 'PPT生成失败' });
    }

    res.json({
      ppt: pptResult.content[0]?.text,
      formatted: formattedContent
    });
  } catch (error: any) {
    console.error('PPT generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 静态文件服务 - downloads 目录
const downloadsPath = path.join(process.cwd(), 'public', 'downloads');
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath, { recursive: true });
}
app.use('/downloads', express.static(downloadsPath));

// ========== RAG 知识库 API ==========

// RAG 引擎实例（按用户隔离）
const ragEngines = new Map<string, RAGEngine>();

// 获取或创建用户的 RAG 引擎
function getRAGEngine(userId: string): RAGEngine {
  if (!ragEngines.has(userId)) {
    const ragEngine = new RAGEngine(
      process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY || '',
      process.env.QWEN_BASE_URL || process.env.OPENAI_BASE_URL,
      process.env.QWEN_API_KEY ? 'qwen-plus' : 'gpt-4o',
      process.env.QWEN_API_KEY ? 'text-embedding-v2' : 'text-embedding-ada-002'
    );
    ragEngines.set(userId, ragEngine);
  }
  return ragEngines.get(userId)!;
}

// 获取知识库统计信息
app.get('/api/rag/stats', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const ragEngine = getRAGEngine(req.user.id);
  res.json(ragEngine.getStats());
});

// 获取知识库文档列表
app.get('/api/rag/documents', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const ragEngine = getRAGEngine(req.user.id);
  const docs = ragEngine.getKnowledgeBase().getAllDocuments();

  res.json(docs.map((d: any) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    chunks: d.chunks?.length || 0,
    createdAt: d.metadata?.createdAt,
    tags: d.metadata?.tags,
  })));
});

// 添加文档到知识库
app.post('/api/rag/documents', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { title, content, type = 'note', tags } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: '请提供标题和内容' });
  }

  try {
    const ragEngine = getRAGEngine(req.user.id);
    const doc = await ragEngine.addDocument(
      content,
      title,
      type,
      req.user.id,
      { tags }
    );

    res.json({
      id: doc.id,
      title: doc.title,
      chunksCount: doc.chunks?.length || 0,
      message: '文档已添加到知识库'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 上传文件到知识库
app.post('/api/rag/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  try {
    const ragEngine = getRAGEngine(req.user.id);
    const doc = await ragEngine.addFromFile(file.path, req.user.id);

    // 删除临时文件
    try { fs.unlinkSync(file.path); } catch (e) { }

    res.json({
      id: doc.id,
      title: doc.title,
      chunksCount: doc.chunks?.length || 0,
      message: '文件已添加到知识库'
    });
  } catch (error: any) {
    try { fs.unlinkSync(file.path); } catch (e) { }
    res.status(500).json({ error: error.message });
  }
});

// 将数据源添加到知识库
app.post('/api/rag/datasource/:id', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const schema = await ds.instance.getSchema();
    const sampleData = schema[0]?.sampleData || [];

    const ragEngine = getRAGEngine(req.user.id);
    const doc = await ragEngine.addFromDataSource(
      ds.config.id,
      ds.config.name,
      schema,
      sampleData,
      req.user.id
    );

    res.json({
      id: doc.id,
      title: doc.title,
      message: '数据源已添加到知识库'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除知识库文档
app.delete('/api/rag/documents/:id', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const ragEngine = getRAGEngine(req.user.id);
  const success = await ragEngine.deleteDocument(req.params.id);

  if (success) {
    res.json({ message: '文档已删除' });
  } else {
    res.status(404).json({ error: '文档不存在' });
  }
});

// RAG 问答
app.post('/api/rag/ask', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { question, datasourceId } = req.body;

  if (!question) {
    return res.status(400).json({ error: '请提供问题' });
  }

  try {
    const ragEngine = getRAGEngine(req.user.id);

    // 如果指定了数据源，先执行数据查询
    let dataContext;
    if (datasourceId) {
      const ds = dataSources.get(datasourceId);
      if (ds && ds.config.userId === req.user.id) {
        try {
          const response = await aiAgent.answer(question, ds.instance, ds.config.type, []);
          dataContext = {
            sql: response.sql,
            data: response.data,
          };
        } catch (e) {
          // 数据查询失败，继续使用知识库
        }
      }
    }

    // RAG 问答
    const result = await ragEngine.hybridAnswer(question, dataContext);

    res.json({
      success: true,
      data: {
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources,
        dataContext: dataContext ? {
          sql: dataContext.sql,
          rowCount: dataContext.data?.length || 0,
        } : undefined,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取知识图谱数据
app.get('/api/rag/graph', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const ragEngine = getRAGEngine(req.user.id);
  const graph = ragEngine.getKnowledgeGraph();
  const data = graph.export();

  res.json({
    success: true,
    data: {
      entities: data.entities.map((e: any) => ({
        id: e.id,
        name: e.name,
        nameCn: e.nameCn,
        type: e.type,
        description: e.description,
      })),
      relations: data.relations.map((r: any) => ({
        id: r.id,
        source: r.sourceId,
        target: r.targetId,
        type: r.type,
        weight: r.weight,
      })),
      stats: graph.getStats(),
    }
  });
});

// 图谱子图查询
app.post('/api/rag/graph/query', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未认证' });

  const { keywords, maxEntities = 20 } = req.body;

  if (!keywords || !Array.isArray(keywords)) {
    return res.status(400).json({ error: '请提供关键词数组' });
  }

  const ragEngine = getRAGEngine(req.user.id);
  const graph = ragEngine.getKnowledgeGraph();
  const result = graph.querySubgraph(keywords, maxEntities);

  res.json({
    entities: result.entities.map((e: any) => ({
      id: e.id,
      name: e.name,
      nameCn: e.nameCn,
      type: e.type,
    })),
    relations: result.relations.map((r: any) => ({
      source: r.sourceId,
      target: r.targetId,
      type: r.type,
    })),
  });
});

// 提取关键要点（调用 MCP 工具）
app.post('/api/agent/extract-points', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { content, maxPoints = 10 } = req.body;

  if (!content) {
    return res.status(400).json({ error: '请提供内容' });
  }

  try {
    const result = await mcpRegistry.callTool('text_formatter', 'extract_key_points', {
      content,
      maxPoints
    });

    res.json({
      points: result.content[0]?.text?.split('\n').filter((l: string) => l.trim()) || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 直接生成数据报告 PPT（调用 MCP 工具）
app.post('/api/agent/data-report-ppt', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { title, summary, insights, tableData, chartData, recommendations, theme = 'corporate' } = req.body;

  if (!title) {
    return res.status(400).json({ error: '请提供报告标题' });
  }

  try {
    const result = await mcpRegistry.callTool('ppt_generator', 'create_data_report_ppt', {
      title,
      summary,
      insights: insights ? JSON.stringify(insights) : undefined,
      tableData: tableData ? JSON.stringify(tableData) : undefined,
      chartData: chartData ? JSON.stringify(chartData) : undefined,
      recommendations: recommendations ? JSON.stringify(recommendations) : undefined,
      theme
    });

    if (result.isError) {
      return res.status(500).json({ error: result.content[0]?.text });
    }

    res.json({ ppt: result.content[0]?.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 注册管理后台路由
import { registerAllSkills } from './agent/skills';
import { crawlerScheduler } from './agent/skills/crawler/scheduler';
import { createAdminRouter } from './admin';
app.use('/api/admin', authMiddleware, createAdminRouter());

// OCR 路由
import ocrRoutes from './admin/modules/ai/ocrRoutes';
app.use('/api/ocr', authMiddleware, ocrRoutes);

// Skills 路由
import skillsRoutes from './admin/modules/skills/routes';
app.use('/api/skills', authMiddleware, skillsRoutes);

// 文件工具路由
import fileToolRoutes from './admin/modules/tools/fileRoutes';
app.use('/api/tools/file', authMiddleware, fileToolRoutes);


// SPA 路由支持 - 所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  // 跳过 API 请求
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API not found' });
  }

  const adminUiIndex = path.join(process.cwd(), 'admin-ui', 'dist', 'index.html');
  const publicIndex = path.join(process.cwd(), 'public', 'index.html');

  if (fs.existsSync(adminUiIndex)) {
    res.sendFile(adminUiIndex);
  } else if (fs.existsSync(publicIndex)) {
    res.sendFile(publicIndex);
  } else {
    res.status(404).send('前端页面未找到。请运行构建或启动开发服务器。');
  }
});

const PORT = process.env.PORT || 3000;

// 先初始化数据源，再启动服务
initDataSources().then(() => {
  // 启动爬虫任务调度器
  crawlerScheduler.start();

  app.listen(PORT, () => {
    console.log(`AI数据问答平台运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
