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
import { aiConfigService, aiQAService } from './admin';
import { approvalService } from '../modules/approval/backend/service';
import { moduleRegistry } from './module-system/core/ModuleRegistry';
import { menuManager } from './module-system/core/MenuManager';
import { ModuleScanner } from './module-system/core/ModuleScanner';
import { createLogger } from './utils/logger';
import { dataSourceManager } from '../modules/datasource-management/backend/manager';

// 创建主日志器 (全量层级刷新)
const log = createLogger('Server');

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

// 初始化模块系统
async function initModuleSystem() {
  try {
    log.info('正在初始化模块系统...');

    // 初始化模块注册表
    await moduleRegistry.initialize();

    // 初始化后端路由管理器
    const { getBackendRouteManager } = await import('./module-system/core/BackendRouteManager');
    getBackendRouteManager(app);

    // 创建生命周期管理器
    const { createLifecycleManager } = await import('./module-system/core/LifecycleManager');
    const { BackendModuleLoader } = await import('./module-system/core/BackendModuleLoader');
    const { FrontendModuleLoader } = await import('./module-system/core/FrontendModuleLoader');
    const { permissionManager } = await import('./module-system/core/PermissionManager');
    const { migrationManager } = await import('./module-system/core/MigrationManager');

    const backendLoader = new BackendModuleLoader();
    const frontendLoader = new FrontendModuleLoader();
    const lifecycleManager = createLifecycleManager(
      moduleRegistry,
      backendLoader,
      frontendLoader,
      menuManager,
      permissionManager,
      migrationManager
    );

    // 扫描并注册所有模块
    const scanner = new ModuleScanner();
    const scanResults = await scanner.scan({ validateStructure: false, includeDisabled: false });

    log.info(`发现 ${scanResults.length} 个模块`);

    // 第一步：注册所有有效的模块
    const validModules = [];
    for (const result of scanResults) {
      if (result.valid) {
        try {
          // 检查模块是否已注册
          const existing = await moduleRegistry.getModule(result.manifest.name);
          if (!existing) {
            await moduleRegistry.register(result.manifest);
          }
          validModules.push(result);
        } catch (error) {
          log.error(`注册模块 ${result.manifest.name} 失败:`, error);
        }
      } else {
        log.warn(`模块 ${result.moduleName} 无效:`, result.errors);
      }
    }

    // 第二步：按依赖顺序排序
    const sortedModules = sortModulesByDependencies(validModules);

    // 第三步：启用模块
    for (const result of sortedModules) {
      try {
        log.debug(`正在启用模块: ${result.manifest.name}`);
        await lifecycleManager.enable(result.manifest.name);
      } catch (error: any) {
        log.warn(`模块 ${result.manifest.name} 启用失败:`, error.message);
      }
    }

    log.info('模块系统初始化完成');
  } catch (error) {
    log.error('模块系统初始化失败:', error);
  }
}

/**
 * 按依赖关系对模块进行排序（拓扑排序）
 */
function sortModulesByDependencies(modules: any[]) {
  const sorted: any[] = [];
  const visited = new Set<string>();
  const checking = new Set<string>();

  function visit(mod: any) {
    if (checking.has(mod.manifest.name)) {
      console.error(`发现循环依赖: ${mod.manifest.name}`);
      return;
    }

    if (!visited.has(mod.manifest.name)) {
      checking.add(mod.manifest.name);

      const deps = mod.manifest.dependencies || {};
      for (const depName of Object.keys(deps)) {
        const depMod = modules.find(m => m.manifest.name === depName);
        if (depMod) {
          visit(depMod);
        }
      }

      checking.delete(mod.manifest.name);
      visited.add(mod.manifest.name);
      sorted.push(mod);
    }
  }

  for (const mod of modules) {
    visit(mod);
  }
  return sorted;
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

  // 初始化模块系统
  await initModuleSystem();

  // 设置 AI Agent 从数据库获取配置（返回所有可用配置，支持自动故障转移）
  aiAgent.setConfigGetter(async () => {
    const configs = await aiConfigService.getActiveConfigsByPriority();
    log.debug('=== AI 配置列表（按优先级排序）===');
    configs.forEach((c, i) => {
      log.debug(`  ${i + 1}. ${c.name} (${c.provider}/${c.model}) - priority: ${c.priority}, baseUrl: ${c.baseUrl || '未设置'}`);
    });
    if (!configs || configs.length === 0) {
      log.warn('没有可用的 AI 配置！');
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
  log.info('AI Agent 已配置为从数据库读取配置（支持自动故障转移）');

  const configs = await configStore.getAll();
  for (const config of configs) {
    try {
      await dataSourceManager.register(config);
      log.info(`已加载数据源: ${config.name}`);
    } catch (e: any) {
      log.error(`加载数据源失败 ${config.name}:`, e.message);
    }
  }
}

// ========== 认证 API ==========

// ========== 认证 API (已桥接到模块) ==========

// 使用模块化的认证路由
app.use('/api/auth', async (req, res, next) => {
  try {
    const { default: authRoutes } = await import('../modules/auth/backend/routes');
    authRoutes(req, res, next);
  } catch (error) {
    log.error('认证模块路由加载失败:', error);
    res.status(500).json({ error: '认证服务不可用' });
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
    if (datasourceId && dataSourceManager.has(datasourceId)) {
      const existing = dataSourceManager.get(datasourceId)!;
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

    // 更新到管理器（内部处理连接测试与旧连接断开）
    await dataSourceManager.register(config);

    // 保存到MySQL
    await configStore.save(config);

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

app.use('/api/datasource', async (req, res, next) => {
  try {
    const { createDataSourceBridgeRoutes } = await import('../modules/datasource-management/backend/bridge_routes');
    const router = createDataSourceBridgeRoutes(configStore, authMiddleware, requireAdmin, log, aiAgent, approvalService);
    router(req, res, next);
  } catch (error) {
    log.error('数据源模块路由加载失败:', error);
    res.status(500).json({ error: '数据源服务不可用' });
  }
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
    res.json(mapping);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 核心逻辑已桥接到模块 -> 见文件末尾新模块路由段


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
app.use('/api/admin', authMiddleware, createAdminRouter(configStore.pool));

// ========== 模块化路由桥接 (Module Bridges) ==========

// 1. AI 智能问答 & Agent (Ask, Chat, Query, RAG)
let aiQaRouter: any = null;
app.use(['/api/ask', '/api/chat', '/api/query', '/api/ai-qa'], authMiddleware, async (req, res, next) => {
  try {
    if (!aiQaRouter) {
      const { initialize } = await import('../modules/ai-qa/backend/index');
      aiQaRouter = await initialize(configStore.pool);
    }
    aiQaRouter(req, res, next);
  } catch (error) {
    log.error('AI-QA 模块路由加载失败:', error);
    res.status(500).json({ error: 'AI 服务不可用' });
  }
});

// 2. OCR 服务
app.use('/api/ocr', authMiddleware, async (req, res, next) => {
  try {
    const { default: ocrRoutes } = await import('../modules/ocr-service/backend/routes');
    ocrRoutes(req, res, next);
  } catch (error) {
    console.error('OCR路由加载失败:', error);
    res.status(500).json({ error: 'OCR服务不可用' });
  }
});

// 3. Skills & Agent 基础能力
app.use(['/api/skills', '/api/agent'], authMiddleware, async (req, res, next) => {
  try {
    const { default: skillsRoutes } = await import('../modules/skills-service/backend/routes');
    skillsRoutes(req, res, next);
  } catch (error) {
    console.error('Skills路由加载失败:', error);
    res.status(500).json({ error: 'Skills服务不可用' });
  }
});

// 4. RAG 服务 (专用 RAG 引擎)
app.use('/api/rag', authMiddleware, async (req, res, next) => {
  try {
    const { default: ragRoutes } = await import('../modules/rag-service/backend/routes');
    ragRoutes(req, res, next);
  } catch (error) {
    console.error('RAG路由加载失败:', error);
    res.status(500).json({ error: 'RAG服务不可用' });
  }
});

// 文件工具路由（修复路径）
let fileToolsRouter: any = null;
app.use('/api/tools/file', authMiddleware, async (req, res, next) => {
  try {
    if (!fileToolsRouter) {
      const { createFileToolsRoutes } = await import('../modules/file-tools/backend/routes');
      const { FileToolsService } = await import('../modules/file-tools/backend/service');
      const fileToolsService = new FileToolsService(configStore.pool);
      fileToolsRouter = createFileToolsRoutes(fileToolsService);
    }
    fileToolsRouter(req, res, next);
  } catch (error) {
    console.error('文件工具路由加载失败:', error);
    res.status(500).json({ error: '文件工具服务不可用' });
  }
});




const PORT = process.env.PORT || 3000;

// 先初始化数据源，再启动服务
initDataSources().then(() => {
  // 启动爬虫任务调度器
  crawlerScheduler.start();

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

  app.listen(PORT, () => {
    console.log(`DataMind 运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);

});

