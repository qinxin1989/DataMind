import express from 'express';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import multer from 'multer';
import * as fs from 'fs';
import { createDataSource, BaseDataSource } from './datasource';
import { AIAgent, skillRegistry, mcpRegistry, AnalysisStep } from './agent';
import { DataSourceConfig } from './types';
import { ConfigStore, ChatSession } from './store/configStore';
import { AuthService } from './services/authService';
import { createAuthMiddleware, requireAdmin } from './middleware/auth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// 静态文件服务
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

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

// AI Agent（替代原有的 AIEngine）
// 优先使用千问，如果没有配置则使用 OpenAI
const aiAgent = new AIAgent(
  process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY || '',
  process.env.QWEN_BASE_URL || process.env.OPENAI_BASE_URL,
  process.env.QWEN_API_KEY ? 'qwen-plus' : (process.env.OPENAI_MODEL || 'gpt-4o')
);

// 初始化：加载已保存的数据源
async function initDataSources() {
  await configStore.init();
  await configStore.initChatTable();
  await configStore.initSchemaAnalysisTable();
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

// 上传文件并创建数据源
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const { name, fileType } = req.body;
    if (!name) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '请提供数据源名称' });
    }

    // 处理中文文件名编码
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    const detectedType = fileType || (ext === '.csv' ? 'csv' : ext === '.json' ? 'json' : 'xlsx');

    // 创建文件数据源配置
    const config: DataSourceConfig = {
      id: uuidv4(),
      userId: req.user.id,
      name,
      type: 'file',
      config: {
        path: req.file.path,
        fileType: detectedType,
        originalName: originalName
      }
    };

    // 测试连接
    const instance = createDataSource(config);
    await instance.testConnection();

    // 保存到MySQL
    await configStore.save(config);
    dataSources.set(config.id, { config, instance });

    res.json({
      id: config.id,
      name,
      message: '文件上传成功',
      file: {
        originalName: originalName,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error: any) {
    // 删除已上传的文件
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // 忽略删除失败
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

  const list = Array.from(dataSources.entries())
    .filter(([, { config }]) => config.userId === req.user!.id)
    .map(([id, { config }]) => ({
      id,
      name: config.name,
      type: config.type,
      host: (config.config as any).host || (config.config as any).url || (config.config as any).path,
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
  
  if (ds.config.userId !== req.user.id) {
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

// 获取数据源schema（带AI分析）
app.get('/api/datasource/:id/schema', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const schema = await ds.instance.getSchema();
    res.json(schema);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取AI分析的schema（带中文名和推荐问题）- 优先从缓存读取
app.get('/api/datasource/:id/schema/analyze', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const ds = dataSources.get(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据源不存在' });

  if (ds.config.userId !== req.user.id) {
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
    res.status(500).json({ error: error.message });
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

// 自然语言问答（带会话上下文）
app.post('/api/ask', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { datasourceId, question, sessionId } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: '请提供问题' });
  }

  const ds = dataSources.get(datasourceId);
  if (!ds) {
    return res.status(404).json({ error: '数据源不存在' });
  }

  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

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
    const response = await aiAgent.answer(question, ds.instance, ds.config.type, session.messages);
    
    // 保存对话记录
    session.messages.push({ role: 'user', content: question, timestamp: Date.now() });
    session.messages.push({ 
      role: 'assistant', 
      content: response.answer, 
      sql: response.sql, 
      timestamp: Date.now() 
    });
    await configStore.saveChatSession(session, req.user.id);

    res.json({ 
      ...response, 
      sessionId: session.id,
      meta: {
        skillUsed: response.skillUsed,
        toolUsed: response.toolUsed,
        visualization: response.visualization
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  if (ds.config.userId !== req.user.id) {
    return res.status(403).json({ error: '无权访问此数据源' });
  }

  try {
    const sessions = await configStore.getChatSessions(req.params.datasourceId, req.user.id);
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
  const skills = skillRegistry.getAll().map(s => ({
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
  
  const skill = skillRegistry.get(skillName);
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
    skills: skillRegistry.getAll().map(s => ({
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
    res.json(report);
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
    res.json(result);
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

  if (ds.config.userId !== req.user.id) {
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

// 内容编排 + 生成 PPT（链式调用两个 MCP 工具）
app.post('/api/agent/format-and-ppt', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  const { content, title, theme = 'corporate', style = 'report' } = req.body;

  if (!content) {
    return res.status(400).json({ error: '请提供要处理的内容' });
  }

  try {
    // 1. 先调用 text_formatter 编排内容
    const formatResult = await mcpRegistry.callTool('text_formatter', 'format_report', {
      content,
      style
    });

    if (formatResult.isError) {
      return res.status(500).json({ error: '内容编排失败: ' + formatResult.content[0]?.text });
    }

    const formattedContent = formatResult.content[0]?.text || content;

    // 2. 再调用 ppt_generator 生成 PPT
    const pptResult = await mcpRegistry.callTool('ppt_generator', 'create_ppt_from_text', {
      title: title || '分析报告',
      content: formattedContent,
      theme
    });

    if (pptResult.isError) {
      return res.status(500).json({ 
        error: 'PPT生成失败: ' + pptResult.content[0]?.text,
        formatted: formattedContent
      });
    }

    res.json({
      formatted: formattedContent,
      ppt: pptResult.content[0]?.text,
      style,
      theme
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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

const PORT = process.env.PORT || 3000;

// 先初始化数据源，再启动服务
initDataSources().then(() => {
  app.listen(PORT, () => {
    console.log(`AI数据问答平台运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
