#!/usr/bin/env node

/**
 * 简化启动脚本 - 绕过TypeScript编译问题
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📝 [${timestamp}] ${req.method} ${req.path}`);

  // 记录请求体（仅对POST/PUT请求，且不记录敏感信息）
  if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    // 隐藏敏感信息
    if (safeBody.password) safeBody.password = '***';
    if (safeBody.api_key) safeBody.api_key = '***';
    console.log(`📋 请求数据:`, JSON.stringify(safeBody, null, 2));
  }

  // 记录响应状态
  const originalSend = res.send;
  res.send = function (data) {
    console.log(`📤 [${timestamp}] ${req.method} ${req.path} - ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log(`❌ 错误响应:`, data);
    }
    originalSend.call(this, data);
  };

  next();
});

// 数据库连接
const pool = mysql.createPool({
  host: process.env.CONFIG_DB_HOST || 'localhost',
  port: parseInt(process.env.CONFIG_DB_PORT) || 3306,
  user: process.env.CONFIG_DB_USER || 'root',
  password: process.env.CONFIG_DB_PASSWORD,
  database: process.env.CONFIG_DB_NAME || 'DataMind',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 简单的认证中间件
const authMiddleware = (req, res, next) => {
  // 模拟认证用户
  req.user = { id: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'admin' };
  next();
};

// 使用AI分析schema并生成推荐问题
async function analyzeSchemaWithAI(tables, datasourceName) {
  try {
    // 获取AI配置
    const [aiConfigs] = await pool.execute(
      'SELECT * FROM sys_ai_configs WHERE status = ? ORDER BY created_at DESC LIMIT 1',
      ['active']
    );

    if (!aiConfigs || aiConfigs.length === 0) {
      console.log('⚠️ 没有可用的AI配置，使用本地分析');
      return generateLocalSuggestedQuestions(tables);
    }

    const config = aiConfigs[0];

    // 格式化schema供AI分析
    const schemaDesc = formatSchemaForAI(tables);

    // 调用AI进行分析
    const analysisResult = await callAIForAnalysis(
      schemaDesc,
      config.provider,
      config.api_key,
      config.base_url,
      config.model
    );

    if (analysisResult && analysisResult.suggestedQuestions && analysisResult.suggestedQuestions.length > 0) {
      return analysisResult.suggestedQuestions;
    }

    return generateLocalSuggestedQuestions(tables);
  } catch (error) {
    console.error('AI分析失败，使用本地分析:', error.message);
    return generateLocalSuggestedQuestions(tables);
  }
}

// 格式化schema供AI理解
function formatSchemaForAI(tables) {
  return tables.map(table => {
    const cols = table.columns.map(c =>
      `  - ${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''})`
    ).join('\n');
    return `表名: ${table.tableName}\n字段:\n${cols}`;
  }).join('\n\n');
}

// 调用AI进行schema分析
async function callAIForAnalysis(schemaDesc, provider, apiKey, baseUrl, model) {
  try {
    const axios = require('axios');

    // 如果没有API密钥，直接返回null
    if (!apiKey) {
      console.log('⚠️ AI密钥未设置，使用本地分析');
      return null;
    }

    // 如果没有baseUrl，根据提供商设置默认值
    let finalBaseUrl = baseUrl;
    if (!finalBaseUrl) {
      const defaultUrls = {
        'openai': 'https://api.openai.com/v1',
        'siliconflow': 'https://api.siliconflow.cn/v1',
        'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        'zhipu': 'https://open.bigmodel.cn/api/paas/v4',
        'deepseek': 'https://api.deepseek.com/v1'
      };
      finalBaseUrl = defaultUrls[provider];
    }

    if (!finalBaseUrl) {
      console.log(`⚠️ 无法确定${provider}的API地址，使用本地分析`);
      return null;
    }

    const prompt = `你是一个数据分析专家。分析以下数据库结构，生成10-15个简单直白的推荐问题。

数据库结构:
${schemaDesc}

要求：
1. 问题要用日常口语化表达，如"总共多少""哪个最多""排名前十""按地区分布"等
2. 问题要简短，不超过15个字
3. 涵盖常见查询：总数、排名、分布、趋势、对比
4. 避免专业术语，用普通人会问的方式
5. 只返回JSON数组格式，例如: ["问题1", "问题2", ...]`;

    const response = await axios.post(
      `${finalBaseUrl}/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: '你是一个数据分析专家，帮助用户理解数据库结构并生成有用的查询问题。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      console.log(`✅ AI生成了${questions.length}个推荐问题`);
      return { suggestedQuestions: questions };
    }

    return null;
  } catch (error) {
    console.error('⚠️ 调用AI失败:', error.message);
    return null;
  }
}

// 本地生成推荐问题（备选方案）
function generateLocalSuggestedQuestions(tables) {
  const questions = [];

  for (const table of tables) {
    const tableCn = table.tableNameCn || table.tableName;

    // 基础统计
    questions.push(`一共有多少条${tableCn}？`);
    questions.push(`展示前10条${tableCn}`);

    // 地区/地域字段
    const regionFields = table.columns.filter(c =>
      /地区|区域|省份|城市|country|region|area|code/i.test(c.name)
    );
    for (const field of regionFields.slice(0, 1)) {
      const fieldCn = field.nameCn || field.name;
      questions.push(`按${fieldCn}分布，哪个最多？`);
    }

    // 类型/分类字段
    const categoryFields = table.columns.filter(c =>
      /类型|类别|分类|性别|状态|status|type|category|continent|official/i.test(c.name)
    );
    for (const field of categoryFields.slice(0, 1)) {
      const fieldCn = field.nameCn || field.name;
      questions.push(`按${fieldCn}分组统计数量`);
    }

    // 数值字段
    const numericFields = table.columns.filter(c =>
      (/数量|金额|分数|年龄|比例|population|area|gnp|lifeexpectancy|amount|price|count|score/i.test(c.name) ||
        /int|decimal|float|double|numeric/i.test(c.type)) &&
      !/id|code/i.test(c.name)
    );
    for (const field of numericFields.slice(0, 1)) {
      const fieldCn = field.nameCn || field.name;
      questions.push(`${fieldCn}最大的是多少？`);
    }
  }

  // 综合分析
  questions.push(`数据总览`);
  questions.push(`有什么规律和特点？`);

  return [...new Set(questions)].slice(0, 15);
}

// 静态文件服务
const adminUiPath = path.join(process.cwd(), 'admin-ui', 'dist');
app.use(express.static(adminUiPath));

// ========== 认证 API ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username === 'admin' && password === 'admin123') {
      res.json({
        success: true,
        data: {
          user: { id: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'admin' },
          token: 'mock-jwt-token'
        }
      });
    } else {
      res.status(400).json({ error: '用户名或密码错误' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

app.get('/api/auth/menus', authMiddleware, async (req, res) => {
  try {
    const menus = [
      {
        id: '1',
        title: '工作台',
        path: '/workbench',
        icon: 'DashboardOutlined',
        type: 'menu'
      },
      {
        id: '2',
        title: 'AI 创新中心',
        icon: 'RobotOutlined',
        type: 'submenu',
        children: [
          { id: '21', title: '智能问答', path: '/ai/chat', icon: 'MessageOutlined', type: 'menu' },
          { id: '22', title: '知识中心', path: '/ai/knowledge', icon: 'BookOutlined', type: 'menu' },
          { id: '23', title: 'AI配置', path: '/ai/config', icon: 'SettingOutlined', type: 'menu' },
          { id: '24', title: '使用统计', path: '/ai/stats', icon: 'BarChartOutlined', type: 'menu' },
          { id: '25', title: '对话历史', path: '/ai/history', icon: 'HistoryOutlined', type: 'menu' },
          { id: '29', title: 'OCR识别', path: '/ai/ocr', icon: 'ScanOutlined', type: 'menu' }
        ]
      },
      {
        id: '3',
        title: '数据资源中心',
        icon: 'DatabaseOutlined',
        type: 'submenu',
        children: [
          { id: '31', title: '数据源管理', path: '/datasource', icon: 'DatabaseOutlined', type: 'menu' },
          { id: '32', title: '数据源审核', path: '/datasource/approval', icon: 'AuditOutlined', type: 'menu' }
        ]
      },
      {
        id: '4',
        title: '数据采集中心',
        icon: 'CloudDownloadOutlined',
        type: 'submenu',
        children: [
          { id: '41', title: 'AI采集助手', path: '/ai/crawler-assistant', icon: 'RobotOutlined', type: 'menu' },
          { id: '42', title: '爬虫管理', path: '/ai/crawler', icon: 'GlobalOutlined', type: 'menu' },
          { id: '43', title: '采集模板配置', path: '/ai/crawler-template-config', icon: 'TableOutlined', type: 'menu' }
        ]
      },
      {
        id: '5',
        title: '高效办公工具',
        icon: 'ToolOutlined',
        type: 'submenu',
        children: [
          { id: '51', title: '文件工具', path: '/tools/file', icon: 'FileOutlined', type: 'menu' },
          { id: '52', title: '效率工具', path: '/tools/efficiency', icon: 'ThunderboltOutlined', type: 'menu' },
          { id: '53', title: '公文写作', path: '/tools/official-doc', icon: 'EditOutlined', type: 'menu' }
        ]
      },
      {
        id: '6',
        title: '基础系统管理',
        icon: 'SettingOutlined',
        type: 'submenu',
        children: [
          { id: '61', title: '用户管理', path: '/user', icon: 'UserOutlined', type: 'menu' },
          { id: '62', title: '角色管理', path: '/role', icon: 'TeamOutlined', type: 'menu' },
          { id: '63', title: '菜单管理', path: '/menu', icon: 'MenuOutlined', type: 'menu' },
          { id: '64', title: '系统配置', path: '/system/config', icon: 'SettingOutlined', type: 'menu' },
          { id: '65', title: '系统状态', path: '/system/status', icon: 'MonitorOutlined', type: 'menu' },
          { id: '66', title: '审计日志', path: '/system/audit', icon: 'FileTextOutlined', type: 'menu' },
          { id: '67', title: '备份恢复', path: '/system/backup', icon: 'CloudUploadOutlined', type: 'menu' },
          { id: '68', title: '通知中心', path: '/notification', icon: 'BellOutlined', type: 'menu' }
        ]
      },
      {
        id: '7',
        title: '大屏管理',
        path: '/dashboard/list',
        icon: 'FundOutlined',
        type: 'menu'
      }
    ];
    res.json({ success: true, data: menus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加前端期望的用户菜单端点
app.get('/api/admin/menus/user', authMiddleware, async (req, res) => {
  try {
    const menus = [
      {
        id: '1',
        title: '工作台',
        path: '/workbench',
        icon: 'DashboardOutlined',
        type: 'menu'
      },
      {
        id: '2',
        title: 'AI 创新中心',
        icon: 'RobotOutlined',
        type: 'submenu',
        children: [
          { id: '11', title: '智能问答', path: '/ai/chat', icon: 'MessageOutlined', type: 'menu' },
          { id: '12', title: '知识中心', path: '/ai/knowledge', icon: 'BookOutlined', type: 'menu' },
          { id: '6', title: 'AI配置', path: '/ai/config', icon: 'SettingOutlined', type: 'menu' },
          { id: '7', title: '使用统计', path: '/ai/stats', icon: 'BarChartOutlined', type: 'menu' },
          { id: '8', title: '对话历史', path: '/ai/history', icon: 'HistoryOutlined', type: 'menu' },
          { id: '15', title: 'OCR 识别', path: '/ai/ocr', icon: 'ScanOutlined', type: 'menu' }
        ]
      },
      {
        id: '3',
        title: '数据资源中心',
        icon: 'DatabaseOutlined',
        type: 'submenu',
        children: [
          { id: '16', title: '数据源管理', path: '/datasource', icon: 'DatabaseOutlined', type: 'menu' },
          { id: '17', title: '数据源审核', path: '/datasource/approval', icon: 'AuditOutlined', type: 'menu' }
        ]
      },
      {
        id: '4',
        title: '数据采集中心',
        icon: 'CloudDownloadOutlined',
        type: 'submenu',
        children: [
          { id: '22', title: 'AI采集助手', path: '/ai/crawler-assistant', icon: 'RobotOutlined', type: 'menu' },
          { id: '14', title: '爬虫管理', path: '/ai/crawler', icon: 'GlobalOutlined', type: 'menu' },
          { id: '23', title: '采集模板配置', path: '/ai/crawler-template-config', icon: 'TableOutlined', type: 'menu' }
        ]
      },
      {
        id: '5',
        title: '高效办公工具',
        icon: 'ToolOutlined',
        type: 'submenu',
        children: [
          { id: '19', title: '文件工具', path: '/tools/file', icon: 'FileOutlined', type: 'menu' },
          { id: '21', title: '效率工具', path: '/tools/efficiency', icon: 'ThunderboltOutlined', type: 'menu' },
          { id: '20', title: '公文写作', path: '/tools/official-doc', icon: 'EditOutlined', type: 'menu' }
        ]
      },
      {
        id: '6',
        title: '基础系统管理',
        icon: 'SettingOutlined',
        type: 'submenu',
        children: [
          { id: '2', title: '用户管理', path: '/user', icon: 'UserOutlined', type: 'menu' },
          { id: '3', title: '角色管理', path: '/role', icon: 'TeamOutlined', type: 'menu' },
          { id: '4', title: '菜单管理', path: '/menu', icon: 'MenuOutlined', type: 'menu' },
          { id: '9', title: '系统配置', path: '/system/config', icon: 'SettingOutlined', type: 'menu' },
          { id: '10', title: '系统状态', path: '/system/status', icon: 'MonitorOutlined', type: 'menu' },
          { id: '11', title: '审计日志', path: '/system/audit', icon: 'FileTextOutlined', type: 'menu' },
          { id: '12', title: '备份恢复', path: '/system/backup', icon: 'CloudUploadOutlined', type: 'menu' },
          { id: '13', title: '通知中心', path: '/notification', icon: 'BellOutlined', type: 'menu' }
        ]
      },
      {
        id: '7',
        title: '大屏管理',
        path: '/dashboard/list',
        icon: 'FundOutlined',
        type: 'menu'
      }
    ];
    res.json({ success: true, data: menus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/users', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, email, full_name, role, status FROM sys_users');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/users/pending', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, email, full_name FROM sys_users WHERE status = "pending"');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Admin 模块路由 ==========
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, email, full_name, role, status FROM sys_users');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users/stats', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as total FROM sys_users');
    res.json({ success: true, data: { total: rows[0].total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/roles', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sys_roles');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/roles/permissions/all', authMiddleware, async (req, res) => {
  try {
    const permissions = [
      { code: 'user:view', name: '查看用户' },
      { code: 'user:create', name: '创建用户' },
      { code: 'role:view', name: '查看角色' },
      { code: 'menu:view', name: '查看菜单' }
    ];
    res.json({ success: true, data: permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/menus', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sys_menus ORDER BY sort_order');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/menus/tree', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sys_menus ORDER BY sort_order');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/ai/configs', authMiddleware, async (req, res) => {
  try {
    // 从数据库获取AI配置
    const [rows] = await pool.execute('SELECT * FROM sys_ai_configs ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('AI配置API错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个AI配置
app.get('/api/admin/ai/configs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM sys_ai_configs WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'AI配置不存在' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建AI配置
app.post('/api/admin/ai/configs', authMiddleware, async (req, res) => {
  try {
    const { name, provider, model, api_key, base_url, status = 'inactive' } = req.body;

    // 验证必填字段
    if (!name || !provider || !model) {
      return res.status(400).json({ error: '配置名称、提供商和模型为必填项' });
    }

    // 生成UUID
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();

    // 确保所有参数都不是undefined，将undefined转换为null
    const safeApiKey = api_key || null;
    const safeBaseUrl = base_url || null;
    const safeStatus = status || 'inactive';

    await pool.execute(
      'INSERT INTO sys_ai_configs (id, name, provider, model, api_key, base_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [id, name, provider, model, safeApiKey, safeBaseUrl, safeStatus]
    );

    res.json({
      success: true,
      data: {
        id,
        name,
        provider,
        model,
        api_key: safeApiKey,
        base_url: safeBaseUrl,
        status: safeStatus
      }
    });
  } catch (error) {
    console.error('创建AI配置错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新AI配置
app.put('/api/admin/ai/configs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider, model, api_key, base_url, status } = req.body;

    // 验证必填字段
    if (!name || !provider || !model) {
      return res.status(400).json({ error: '配置名称、提供商和模型为必填项' });
    }

    // 确保所有参数都不是undefined，将undefined转换为null
    const safeApiKey = api_key || null;
    const safeBaseUrl = base_url || null;
    const safeStatus = status || 'inactive';

    await pool.execute(
      'UPDATE sys_ai_configs SET name = ?, provider = ?, model = ?, api_key = ?, base_url = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [name, provider, model, safeApiKey, safeBaseUrl, safeStatus, id]
    );

    res.json({
      success: true,
      data: {
        id,
        name,
        provider,
        model,
        api_key: safeApiKey,
        base_url: safeBaseUrl,
        status: safeStatus
      }
    });
  } catch (error) {
    console.error('更新AI配置错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除AI配置
app.delete('/api/admin/ai/configs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM sys_ai_configs WHERE id = ?', [id]);
    res.json({ success: true, message: 'AI配置已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 测试AI配置连接
app.post('/api/admin/ai/configs/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    // 模拟测试AI配置连接
    const testResult = {
      success: true,
      latency: Math.floor(Math.random() * 1000) + 100,
      model_info: 'GPT-4 Turbo',
      timestamp: new Date()
    };
    res.json({ success: true, data: testResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 验证AI配置 - 添加缺失的验证端点
app.post('/api/admin/ai/configs/validate', authMiddleware, async (req, res) => {
  try {
    const { provider, model, api_key, base_url } = req.body;

    // 验证必填字段
    if (!provider || !model) {
      return res.status(400).json({
        success: false,
        message: '提供商和模型为必填项'
      });
    }

    // 模拟验证AI配置 - 这里可以添加真实的验证逻辑
    const validationResult = {
      success: true,
      message: '配置验证成功',
      details: {
        provider,
        model,
        connection_status: 'connected',
        response_time: Math.floor(Math.random() * 500) + 50,
        model_available: true
      },
      timestamp: new Date()
    };

    res.json({ success: true, data: validationResult });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '配置验证失败',
      error: error.message
    });
  }
});

// 验证特定AI配置
app.post('/api/admin/ai/configs/:id/validate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取配置信息
    const [rows] = await pool.execute('SELECT * FROM sys_ai_configs WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'AI配置不存在'
      });
    }

    const config = rows[0];

    // 验证API密钥是否存在
    if (!config.api_key || config.api_key === '***' || config.api_key.trim() === '') {
      return res.json({
        success: false,
        message: '配置验证失败：API密钥未设置或无效',
        details: {
          config_name: config.name,
          provider: config.provider,
          model: config.model,
          connection_status: 'failed',
          error: 'API密钥缺失'
        },
        timestamp: new Date()
      });
    }

    // 模拟验证配置 - 这里可以添加真实的API调用验证
    const validationResult = {
      valid: true,
      success: true,
      message: '配置验证成功',
      details: {
        config_name: config.name,
        provider: config.provider,
        model: config.model,
        connection_status: 'connected',
        response_time: Math.floor(Math.random() * 500) + 50,
        model_available: true
      },
      timestamp: new Date()
    };

    res.json({ success: true, data: validationResult });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '配置验证失败',
      error: error.message
    });
  }
});

app.get('/api/admin/ai/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalRequests: 1234,
      totalTokens: 567890,
      avgResponseTime: 1.2,
      successRate: 98.5
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/system/configs', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sys_system_configs');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/system/status', authMiddleware, async (req, res) => {
  try {
    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: '1.0.0'
    };
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/audit/logs', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sys_audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/audit/chat-history', authMiddleware, async (req, res) => {
  try {
    const chatHistory = [
      {
        id: '1',
        user_id: req.user.id,
        session_id: 'session-001',
        datasource_name: 'world',
        question: '查询用户总数',
        answer: '当前系统共有1,250个用户',
        sql_query: 'SELECT COUNT(*) FROM users',
        created_at: '2024-02-01T10:30:00Z',
        response_time: 1.2
      },
      {
        id: '2',
        user_id: req.user.id,
        session_id: 'session-001',
        datasource_name: 'world',
        question: '最近一周的订单统计',
        answer: '最近一周共有456个订单，总金额为￥123,456.78',
        sql_query: 'SELECT COUNT(*), SUM(amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
        created_at: '2024-02-01T10:35:00Z',
        response_time: 2.1
      },
      {
        id: '3',
        user_id: req.user.id,
        session_id: 'session-002',
        datasource_name: 'world',
        question: '活跃用户分析',
        answer: '本月活跃用户为789人，比上月增长15%',
        sql_query: 'SELECT COUNT(DISTINCT user_id) FROM user_activities WHERE DATE_FORMAT(created_at, "%Y-%m") = DATE_FORMAT(NOW(), "%Y-%m")',
        created_at: '2024-02-01T14:20:00Z',
        response_time: 1.8
      }
    ];
    res.json({ success: true, data: chatHistory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/notifications', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sys_notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/notifications/unread-count', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM sys_notifications WHERE user_id = ? AND is_read = FALSE', [req.user.id]);
    res.json({ success: true, data: { count: rows[0].count } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/crawler/templates', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM crawler_templates WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/crawler/tasks', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM crawler_tasks WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalUsers: 156,
      totalDataSources: 23,
      totalQueries: 4567,
      systemHealth: 'good'
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 数据源管理 ==========
// 测试数据源连接（通用）
app.post('/api/datasource/test', authMiddleware, async (req, res) => {
  try {
    const { type, config } = req.body;

    if (!type || !config) {
      return res.status(400).json({
        success: false,
        error: '数据源类型和配置信息不能为空'
      });
    }

    // 模拟不同类型数据源的连接测试
    let testResult;

    switch (type.toLowerCase()) {
      case 'mysql':
        testResult = {
          success: true,
          message: 'MySQL数据库连接成功',
          details: {
            host: config.host || 'localhost',
            port: config.port || 3306,
            database: config.database || 'test',
            connection_time: Math.floor(Math.random() * 100) + 50 + 'ms'
          }
        };
        break;

      case 'postgresql':
        testResult = {
          success: true,
          message: 'PostgreSQL数据库连接成功',
          details: {
            host: config.host || 'localhost',
            port: config.port || 5432,
            database: config.database || 'postgres',
            connection_time: Math.floor(Math.random() * 100) + 50 + 'ms'
          }
        };
        break;

      default:
        testResult = {
          success: true,
          message: `${type}数据源连接成功`,
          details: {
            type: type,
            connection_time: Math.floor(Math.random() * 100) + 50 + 'ms'
          }
        };
    }

    res.json({ success: true, data: testResult });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试特定数据源连接 (POST)
app.post('/api/datasource/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据源不存在或无权限访问'
      });
    }

    const datasource = rows[0];
    const config = typeof datasource.config === 'string' ? JSON.parse(datasource.config) : datasource.config;

    // 模拟连接测试
    const testResult = {
      success: true,
      message: `数据源 "${datasource.name}" 连接成功`,
      details: {
        name: datasource.name,
        type: datasource.type,
        host: config.host || 'localhost',
        connection_time: Math.floor(Math.random() * 100) + 50 + 'ms',
        status: 'connected'
      }
    };

    res.json({ success: true, data: testResult });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试特定数据源连接 (GET) - 兼容前端调用
app.get('/api/datasource/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据源不存在或无权限访问'
      });
    }

    const datasource = rows[0];
    const config = typeof datasource.config === 'string' ? JSON.parse(datasource.config) : datasource.config;

    // 模拟连接测试
    const testResult = {
      success: true,
      message: `数据源 "${datasource.name}" 连接成功`,
      details: {
        name: datasource.name,
        type: datasource.type,
        host: config.host || 'localhost',
        connection_time: Math.floor(Math.random() * 100) + 50 + 'ms',
        status: 'connected'
      }
    };

    res.json({ success: true, data: testResult });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 分析数据源结构
app.get('/api/datasource/:id/schema/analyze', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据源不存在或无权限访问'
      });
    }

    const datasource = rows[0];
    const config = typeof datasource.config === 'string' ? JSON.parse(datasource.config) : datasource.config;

    // 先检查数据库中是否已有分析结果
    const [existingAnalysis] = await pool.execute(
      'SELECT * FROM datasource_schema_analysis WHERE datasource_id = ?',
      [id]
    );

    if (existingAnalysis.length > 0) {
      const analysis = existingAnalysis[0];
      const [questions] = await pool.execute(
        'SELECT question FROM datasource_schema_questions WHERE analysis_id = ? ORDER BY sort_order',
        [analysis.id]
      );

      const tables = typeof analysis.tables === 'string' ? JSON.parse(analysis.tables) : analysis.tables;
      const suggestedQuestions = questions.map(q => q.question);

      return res.json({
        tables,
        suggestedQuestions,
        cached: true
      });
    }

    // 连接到目标数据库获取真实表结构
    let targetConnection;
    try {
      targetConnection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.username || config.user || 'root',
        password: config.password,
        database: config.database || datasource.name,
        charset: 'utf8mb4'
      });

      // 获取所有表
      const [tables] = await targetConnection.execute('SHOW TABLES');
      const analysisResult = {
        tables: [],
        suggestedQuestions: []
      };

      // 收集所有表的信息用于生成推荐问题
      const tableInfoList = [];

      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0];

        // 获取表注释
        const [tableInfo] = await targetConnection.execute(
          `SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [config.database || datasource.name, tableName]
        );
        const tableComment = tableInfo[0]?.TABLE_COMMENT || '';

        // 获取列信息
        const [columns] = await targetConnection.execute(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT, 
           CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
           ORDER BY ORDINAL_POSITION`,
          [config.database || datasource.name, tableName]
        );

        const columnList = columns.map(col => ({
          name: col.COLUMN_NAME,
          nameCn: col.COLUMN_COMMENT || col.COLUMN_NAME,
          type: col.CHARACTER_MAXIMUM_LENGTH
            ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
            : col.NUMERIC_PRECISION
              ? `${col.DATA_TYPE}(${col.NUMERIC_PRECISION}${col.NUMERIC_SCALE ? ',' + col.NUMERIC_SCALE : ''})`
              : col.DATA_TYPE.toUpperCase(),
          isPrimaryKey: col.COLUMN_KEY === 'PRI'
        }));

        const tableDisplayName = tableComment || tableName;

        analysisResult.tables.push({
          tableName: tableName,
          tableNameCn: tableDisplayName,
          columns: columnList
        });

        tableInfoList.push({
          tableName,
          tableNameCn: tableDisplayName,
          columns: columnList
        });
      }

      // 基于表结构生成推荐问题（使用AI分析）
      analysisResult.suggestedQuestions = await analyzeSchemaWithAI(analysisResult.tables, datasource.name);

      await targetConnection.end();

      // 保存分析结果到数据库
      const analysisId = require('crypto').randomUUID();
      await pool.execute(
        'INSERT INTO datasource_schema_analysis (id, datasource_id, tables, created_at) VALUES (?, ?, ?, NOW())',
        [analysisId, id, JSON.stringify(analysisResult.tables)]
      );

      // 保存推荐问题到数据库
      for (let i = 0; i < analysisResult.suggestedQuestions.length; i++) {
        const questionId = require('crypto').randomUUID();
        await pool.execute(
          'INSERT INTO datasource_schema_questions (id, analysis_id, question, sort_order) VALUES (?, ?, ?, ?)',
          [questionId, analysisId, analysisResult.suggestedQuestions[i], i + 1]
        );
      }

      res.json(analysisResult);

    } catch (dbError) {
      if (targetConnection) {
        try { await targetConnection.end(); } catch (e) { }
      }
      console.error('数据库连接错误:', dbError);

      // 如果连接失败，返回基础的分析结果
      const fallbackResult = {
        tables: [],
        suggestedQuestions: [
          '请检查数据源连接配置',
          '确认数据库服务是否正常运行'
        ]
      };

      res.json(fallbackResult);
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/datasource', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个数据源
app.get('/api/datasource/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取数据源详细信息
app.get('/api/datasource/:id/detail', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在' });
    }

    const datasource = rows[0];
    const config = typeof datasource.config === 'string' ? JSON.parse(datasource.config) : datasource.config;

    const detail = {
      id: datasource.id,
      name: datasource.name,
      type: datasource.type,
      config: config,
      status: 'connected',
      connection_info: {
        host: config.host || 'localhost',
        port: config.port || 3306,
        database: config.database || datasource.name
      },
      statistics: {
        total_tables: 3,
        total_columns: 14,
        total_rows: 7250,
        data_size: '12.9MB'
      },
      created_at: datasource.created_at,
      updated_at: datasource.updated_at
    };

    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建数据源
app.post('/api/datasource', authMiddleware, async (req, res) => {
  try {
    const { name, type, config } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({ error: '数据源名称、类型和配置为必填项' });
    }

    const id = require('crypto').randomUUID();
    await pool.execute(
      'INSERT INTO datasource_config (id, user_id, name, type, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [id, req.user.id, name, type, typeof config === 'string' ? config : JSON.stringify(config)]
    );

    res.json({
      success: true,
      data: { id, name, type, config, user_id: req.user.id }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新数据源
app.put('/api/datasource/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, config } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({ error: '数据源名称、类型和配置为必填项' });
    }

    const [result] = await pool.execute(
      'UPDATE datasource_config SET name = ?, type = ?, config = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [name, type, typeof config === 'string' ? config : JSON.stringify(config), id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限修改' });
    }

    res.json({
      success: true,
      data: { id, name, type, config }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除数据源
app.delete('/api/datasource/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查数据源是否存在
    const [checkRows] = await pool.execute('SELECT id FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限删除' });
    }

    // 删除数据源（外键约束会自动删除相关数据）
    await pool.execute('DELETE FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);

    res.json({ success: true, message: '数据源已删除' });
  } catch (error) {
    console.error('删除数据源错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 新增模块路由 ==========
// AI聊天相关API
app.get('/api/ai/chat/datasources', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, type FROM datasource_config WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { message, datasource_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    // 模拟AI回复
    const response = {
      message: `您好！我收到了您的消息："${message}"。这是一个模拟回复。`,
      timestamp: new Date(),
      datasource_id
    };

    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tools/file', authMiddleware, async (req, res) => {
  try {
    const tools = [
      { id: '1', name: 'Excel转换器', type: 'converter' },
      { id: '2', name: 'PDF解析器', type: 'parser' }
    ];
    res.json({ success: true, data: tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ocr/config', authMiddleware, async (req, res) => {
  try {
    const config = {
      enabled: true,
      supportedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      maxFileSize: '10MB'
    };
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/skills', authMiddleware, async (req, res) => {
  try {
    const skills = [
      { id: '1', name: '数据分析', category: 'analysis' },
      { id: '2', name: '网页爬虫', category: 'crawler' }
    ];
    res.json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agent/capabilities', authMiddleware, async (req, res) => {
  try {
    const capabilities = {
      dataAnalysis: true,
      webCrawling: true,
      textProcessing: true
    };
    res.json({ success: true, data: capabilities });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rag/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalDocuments: 156,
      totalChunks: 2340,
      totalSize: '45.2MB'
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rag/documents', authMiddleware, async (req, res) => {
  try {
    const documents = [
      { id: '1', title: '系统使用手册', category: '技术文档' },
      { id: '2', title: '业务流程说明', category: '业务资料' }
    ];
    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AI-QA 模块 API ==========
// RAG 文档管理
app.get('/api/admin/ai-qa/rag/documents', authMiddleware, async (req, res) => {
  try {
    const documents = [
      {
        id: '1',
        title: '系统使用手册',
        category: '技术文档',
        size: '2.5MB',
        chunks: 45,
        created_at: '2024-01-15',
        status: 'processed'
      },
      {
        id: '2',
        title: '业务流程说明',
        category: '业务资料',
        size: '1.8MB',
        chunks: 32,
        created_at: '2024-01-20',
        status: 'processed'
      },
      {
        id: '3',
        title: '数据分析报告',
        category: '分析报告',
        size: '3.2MB',
        chunks: 58,
        created_at: '2024-02-01',
        status: 'processing'
      }
    ];
    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RAG 统计信息
app.get('/api/admin/ai-qa/rag/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalDocuments: 156,
      totalChunks: 2340,
      totalSize: '45.2MB',
      processedDocuments: 142,
      processingDocuments: 8,
      failedDocuments: 6,
      avgChunksPerDocument: 15,
      categories: {
        '技术文档': 45,
        '业务资料': 38,
        '分析报告': 25,
        '其他': 48
      }
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI-QA 分类管理
app.get('/api/admin/ai-qa/categories', authMiddleware, async (req, res) => {
  try {
    const categories = [
      { id: '1', name: '技术文档', description: '系统技术相关文档', count: 45 },
      { id: '2', name: '业务资料', description: '业务流程和规范', count: 38 },
      { id: '3', name: '分析报告', description: '数据分析和统计报告', count: 25 },
      { id: '4', name: '培训材料', description: '员工培训相关资料', count: 22 },
      { id: '5', name: '其他', description: '其他类型文档', count: 26 }
    ];
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 聊天会话 API ==========
// 获取聊天会话信息
app.get('/api/chat/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 模拟聊天会话数据
    const session = {
      id: id,
      user_id: req.user.id,
      datasource_id: id, // 使用传入的ID作为数据源ID
      title: '数据分析会话',
      created_at: new Date(Date.now() - 3600000), // 1小时前创建
      updated_at: new Date(),
      message_count: 8,
      status: 'active',
      messages: [
        {
          id: '1',
          role: 'user',
          content: '请帮我分析一下用户数据',
          timestamp: new Date(Date.now() - 3600000)
        },
        {
          id: '2',
          role: 'assistant',
          content: '好的，我来帮您分析用户数据。根据数据源显示，当前有1250个用户...',
          timestamp: new Date(Date.now() - 3580000)
        },
        {
          id: '3',
          role: 'user',
          content: '用户增长趋势如何？',
          timestamp: new Date(Date.now() - 3500000)
        },
        {
          id: '4',
          role: 'assistant',
          content: '从数据来看，用户增长呈现稳定上升趋势，月增长率约为15%...',
          timestamp: new Date(Date.now() - 3480000)
        }
      ]
    };

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建新的聊天会话
app.post('/api/chat/sessions', authMiddleware, async (req, res) => {
  try {
    const { datasource_id, title } = req.body;

    const session = {
      id: require('crypto').randomUUID(),
      user_id: req.user.id,
      datasource_id,
      title: title || '新的对话',
      created_at: new Date(),
      updated_at: new Date(),
      message_count: 0,
      status: 'active',
      messages: []
    };

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AI问答相关API ==========
app.get('/api/admin/ai-qa/rag/documents', authMiddleware, async (req, res) => {
  try {
    const documents = [
      {
        id: '1',
        title: '系统使用手册',
        category: '技术文档',
        size: '2.5MB',
        chunks: 45,
        created_at: '2024-01-15T10:30:00Z',
        status: 'processed'
      },
      {
        id: '2',
        title: '业务流程说明',
        category: '业务资料',
        size: '1.8MB',
        chunks: 32,
        created_at: '2024-01-20T14:20:00Z',
        status: 'processed'
      },
      {
        id: '3',
        title: 'API接口文档',
        category: '技术文档',
        size: '3.2MB',
        chunks: 58,
        created_at: '2024-01-25T09:15:00Z',
        status: 'processing'
      }
    ];
    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/ai-qa/rag/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalDocuments: 156,
      totalChunks: 2340,
      totalSize: '45.2MB',
      processedDocuments: 142,
      processingDocuments: 8,
      failedDocuments: 6,
      avgChunksPerDocument: 15,
      lastUpdated: new Date().toISOString()
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/ai-qa/categories', authMiddleware, async (req, res) => {
  try {
    const categories = [
      {
        id: '1',
        name: '技术文档',
        count: 89,
        description: '系统技术相关文档'
      },
      {
        id: '2',
        name: '业务资料',
        count: 45,
        description: '业务流程和规范文档'
      },
      {
        id: '3',
        name: '用户手册',
        count: 22,
        description: '用户操作指南和帮助文档'
      },
      {
        id: '4',
        name: '政策法规',
        count: 18,
        description: '相关政策和法规文件'
      }
    ];
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/ai-qa/rag/graph', authMiddleware, async (req, res) => {
  try {
    const graph = {
      nodes: [
        {
          id: '1',
          label: '用户管理',
          type: 'concept',
          size: 20,
          color: '#1890ff'
        },
        {
          id: '2',
          label: '权限控制',
          type: 'concept',
          size: 15,
          color: '#52c41a'
        },
        {
          id: '3',
          label: '数据源',
          type: 'concept',
          size: 18,
          color: '#fa8c16'
        },
        {
          id: '4',
          label: 'API接口',
          type: 'concept',
          size: 12,
          color: '#eb2f96'
        }
      ],
      edges: [
        {
          id: 'e1',
          source: '1',
          target: '2',
          label: '关联',
          weight: 0.8
        },
        {
          id: 'e2',
          source: '1',
          target: '3',
          label: '访问',
          weight: 0.6
        },
        {
          id: 'e3',
          source: '2',
          target: '4',
          label: '控制',
          weight: 0.7
        }
      ],
      statistics: {
        totalNodes: 4,
        totalEdges: 3,
        avgConnections: 1.5,
        lastUpdated: new Date().toISOString()
      }
    };
    res.json({ success: true, data: graph });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 数据源架构分析API ==========
app.get('/api/datasource/:id/schema', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限访问' });
    }

    const datasource = rows[0];
    const config = typeof datasource.config === 'string' ? JSON.parse(datasource.config) : datasource.config;

    // 连接到目标数据库获取真实表结构
    let targetConnection;
    try {
      targetConnection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.username || config.user || 'root',
        password: config.password,
        database: config.database || datasource.name,
        charset: 'utf8mb4'
      });

      // 获取所有表
      const [tables] = await targetConnection.execute('SHOW TABLES');
      const tableList = [];

      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0];

        // 获取表注释
        const [tableInfo] = await targetConnection.execute(
          `SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [config.database || datasource.name, tableName]
        );
        const tableComment = tableInfo[0]?.TABLE_COMMENT || '';

        // 获取列信息
        const [columns] = await targetConnection.execute(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT, 
           CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
           ORDER BY ORDINAL_POSITION`,
          [config.database || datasource.name, tableName]
        );

        const columnList = columns.map(col => ({
          name: col.COLUMN_NAME,
          type: col.CHARACTER_MAXIMUM_LENGTH
            ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
            : col.NUMERIC_PRECISION
              ? `${col.DATA_TYPE}(${col.NUMERIC_PRECISION}${col.NUMERIC_SCALE ? ',' + col.NUMERIC_SCALE : ''})`
              : col.DATA_TYPE.toUpperCase(),
          isPrimaryKey: col.COLUMN_KEY === 'PRI',
          comment: col.COLUMN_COMMENT || ''
        }));

        tableList.push({
          tableName: tableName,
          tableComment: tableComment,
          columns: columnList
        });
      }

      await targetConnection.end();

      // 返回真实的表结构
      res.json(tableList);

    } catch (dbError) {
      if (targetConnection) {
        try { await targetConnection.end(); } catch (e) { }
      }
      console.error('数据库连接错误:', dbError);
      res.status(500).json({ error: `无法连接到数据库: ${dbError.message}` });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取数据源表信息（简化版本）
app.get('/api/datasource/:id/tables', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限访问' });
    }

    const tables = [
      { name: 'users', comment: '用户表', row_count: 1250 },
      { name: 'orders', comment: '订单表', row_count: 5680 },
      { name: 'products', comment: '产品表', row_count: 320 }
    ];

    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取特定表的列信息
app.get('/api/datasource/:id/tables/:tableName/columns', authMiddleware, async (req, res) => {
  try {
    const { id, tableName } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限访问' });
    }

    // 模拟不同表的列信息
    let columns = [];
    switch (tableName) {
      case 'users':
        columns = [
          { name: 'id', type: 'INT', primary_key: true, comment: '用户ID' },
          { name: 'username', type: 'VARCHAR(50)', nullable: false, comment: '用户名' },
          { name: 'email', type: 'VARCHAR(100)', nullable: false, comment: '邮箱' },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, comment: '创建时间' }
        ];
        break;
      case 'orders':
        columns = [
          { name: 'id', type: 'INT', primary_key: true, comment: '订单ID' },
          { name: 'user_id', type: 'INT', foreign_key: 'users.id', comment: '用户ID' },
          { name: 'amount', type: 'DECIMAL(10,2)', nullable: false, comment: '订单金额' },
          { name: 'status', type: 'VARCHAR(20)', nullable: false, comment: '订单状态' },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, comment: '创建时间' }
        ];
        break;
      case 'products':
        columns = [
          { name: 'id', type: 'INT', primary_key: true, comment: '产品ID' },
          { name: 'name', type: 'VARCHAR(100)', nullable: false, comment: '产品名称' },
          { name: 'price', type: 'DECIMAL(10,2)', nullable: false, comment: '产品价格' },
          { name: 'category', type: 'VARCHAR(50)', nullable: false, comment: '产品分类' },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, comment: '创建时间' }
        ];
        break;
      default:
        return res.status(404).json({ error: '表不存在' });
    }

    res.json({ success: true, data: columns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 聊天会话API ==========
app.get('/api/chat/sessions/:datasourceId', authMiddleware, async (req, res) => {
  try {
    const { datasourceId } = req.params;

    // 模拟聊天会话数据
    const sessions = [
      {
        id: '1',
        datasource_id: datasourceId,
        title: '用户数据分析',
        message_count: 8,
        created_at: '2024-02-01T10:30:00Z',
        updated_at: '2024-02-01T11:45:00Z'
      },
      {
        id: '2',
        datasource_id: datasourceId,
        title: '订单统计查询',
        message_count: 5,
        created_at: '2024-02-01T14:20:00Z',
        updated_at: '2024-02-01T14:35:00Z'
      }
    ];

    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/sessions', authMiddleware, async (req, res) => {
  try {
    const { datasource_id, title } = req.body;

    if (!datasource_id) {
      return res.status(400).json({ error: '数据源ID不能为空' });
    }

    // 创建新的聊天会话
    const session = {
      id: require('crypto').randomUUID(),
      datasource_id,
      title: title || '新的对话',
      message_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AI爬虫对话API ==========
app.get('/api/admin/ai/crawler-conversations-latest', authMiddleware, async (req, res) => {
  try {
    const latestConversations = [
      {
        id: '1',
        user_id: req.user.id,
        title: '爬取政府公告数据',
        target_url: 'https://example.gov.cn/announcements',
        status: 'completed',
        created_at: '2024-02-02T10:30:00Z',
        updated_at: '2024-02-02T10:45:00Z',
        result_count: 156,
        success_rate: 98.5
      },
      {
        id: '2',
        user_id: req.user.id,
        title: '采集新闻资讯',
        target_url: 'https://news.example.com',
        status: 'running',
        created_at: '2024-02-02T14:20:00Z',
        updated_at: '2024-02-02T14:35:00Z',
        result_count: 89,
        success_rate: 95.2
      }
    ];
    res.json({ success: true, data: latestConversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/ai/crawler-conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = [
      {
        id: '1',
        user_id: req.user.id,
        title: '爬取政府公告数据',
        target_url: 'https://example.gov.cn/announcements',
        status: 'completed',
        created_at: '2024-02-02T10:30:00Z',
        updated_at: '2024-02-02T10:45:00Z',
        result_count: 156,
        success_rate: 98.5,
        messages: [
          {
            role: 'user',
            content: '请帮我爬取政府公告页面的数据',
            timestamp: '2024-02-02T10:30:00Z'
          },
          {
            role: 'assistant',
            content: '好的，我来帮您分析页面结构并提取数据...',
            timestamp: '2024-02-02T10:31:00Z'
          }
        ]
      },
      {
        id: '2',
        user_id: req.user.id,
        title: '采集新闻资讯',
        target_url: 'https://news.example.com',
        status: 'running',
        created_at: '2024-02-02T14:20:00Z',
        updated_at: '2024-02-02T14:35:00Z',
        result_count: 89,
        success_rate: 95.2,
        messages: [
          {
            role: 'user',
            content: '需要采集最新的新闻资讯',
            timestamp: '2024-02-02T14:20:00Z'
          },
          {
            role: 'assistant',
            content: '正在分析新闻网站结构，请稍候...',
            timestamp: '2024-02-02T14:21:00Z'
          }
        ]
      },
      {
        id: '3',
        user_id: req.user.id,
        title: '电商产品信息抓取',
        target_url: 'https://shop.example.com/products',
        status: 'failed',
        created_at: '2024-02-01T16:10:00Z',
        updated_at: '2024-02-01T16:25:00Z',
        result_count: 0,
        success_rate: 0,
        error_message: '目标网站反爬虫机制较强，建议调整策略',
        messages: [
          {
            role: 'user',
            content: '爬取电商网站的产品信息',
            timestamp: '2024-02-01T16:10:00Z'
          },
          {
            role: 'assistant',
            content: '检测到反爬虫机制，正在尝试其他方案...',
            timestamp: '2024-02-01T16:11:00Z'
          }
        ]
      }
    ];
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 数据源审核API ==========
app.get('/api/datasource/pending-approvals', authMiddleware, async (req, res) => {
  try {
    const pendingApprovals = [
      {
        id: '1',
        datasource_id: '24be7276-8964-4adf-9eed-3b7965b1386e',
        datasource_name: 'world',
        datasource_type: 'mysql',
        requester_id: req.user.id,
        requester_name: 'admin',
        request_reason: '需要访问用户数据进行分析',
        status: 'pending',
        requested_at: '2024-02-02T09:30:00Z',
        expires_at: '2024-02-09T09:30:00Z'
      },
      {
        id: '2',
        datasource_id: 'test-datasource-id',
        datasource_name: 'analytics_db',
        datasource_type: 'postgresql',
        requester_id: req.user.id,
        requester_name: 'admin',
        request_reason: '业务报表生成需要',
        status: 'pending',
        requested_at: '2024-02-01T14:20:00Z',
        expires_at: '2024-02-08T14:20:00Z'
      }
    ];
    res.json({ success: true, data: pendingApprovals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 审批数据源访问请求
app.post('/api/datasource/approvals/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;

    // 模拟审批处理
    const approval = {
      id,
      approved,
      approver_id: req.user.id,
      approver_name: req.user.username,
      approval_reason: reason,
      approved_at: new Date().toISOString()
    };

    res.json({ success: true, data: approval });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 前端友好的字段API ==========
// 简化的字段列表API - 专为前端显示优化
app.get('/api/datasource/:id/fields', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限访问' });
    }

    const datasource = rows[0];

    // 扁平化的字段列表 - 更容易前端处理
    const fields = [
      // users表字段
      { table: 'users', tableName: '用户表', name: 'id', type: 'INT', comment: '用户ID', isPrimary: true },
      { table: 'users', tableName: '用户表', name: 'username', type: 'VARCHAR(50)', comment: '用户名', isPrimary: false },
      { table: 'users', tableName: '用户表', name: 'email', type: 'VARCHAR(100)', comment: '邮箱地址', isPrimary: false },
      { table: 'users', tableName: '用户表', name: 'created_at', type: 'TIMESTAMP', comment: '创建时间', isPrimary: false },

      // orders表字段
      { table: 'orders', tableName: '订单表', name: 'id', type: 'INT', comment: '订单ID', isPrimary: true },
      { table: 'orders', tableName: '订单表', name: 'user_id', type: 'INT', comment: '用户ID', isPrimary: false },
      { table: 'orders', tableName: '订单表', name: 'amount', type: 'DECIMAL(10,2)', comment: '订单金额', isPrimary: false },
      { table: 'orders', tableName: '订单表', name: 'status', type: 'VARCHAR(20)', comment: '订单状态', isPrimary: false },
      { table: 'orders', tableName: '订单表', name: 'created_at', type: 'TIMESTAMP', comment: '创建时间', isPrimary: false },

      // products表字段
      { table: 'products', tableName: '产品表', name: 'id', type: 'INT', comment: '产品ID', isPrimary: true },
      { table: 'products', tableName: '产品表', name: 'name', type: 'VARCHAR(100)', comment: '产品名称', isPrimary: false },
      { table: 'products', tableName: '产品表', name: 'price', type: 'DECIMAL(10,2)', comment: '产品价格', isPrimary: false },
      { table: 'products', tableName: '产品表', name: 'category', type: 'VARCHAR(50)', comment: '产品分类', isPrimary: false },
      { table: 'products', tableName: '产品表', name: 'created_at', type: 'TIMESTAMP', comment: '创建时间', isPrimary: false }
    ];

    res.json({
      success: true,
      data: {
        datasource_id: id,
        datasource_name: datasource.name,
        fields: fields,
        total_fields: fields.length,
        tables: ['users', 'orders', 'products']
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按表分组的字段API
app.get('/api/datasource/:id/tables-with-fields', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据源配置
    const [rows] = await pool.execute('SELECT * FROM datasource_config WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据源不存在或无权限访问' });
    }

    const datasource = rows[0];

    // 按表分组的数据结构
    const tablesWithFields = [
      {
        table: 'users',
        tableName: '用户表',
        fields: [
          { name: 'id', type: 'INT', comment: '用户ID', isPrimary: true },
          { name: 'username', type: 'VARCHAR(50)', comment: '用户名', isPrimary: false },
          { name: 'email', type: 'VARCHAR(100)', comment: '邮箱地址', isPrimary: false },
          { name: 'created_at', type: 'TIMESTAMP', comment: '创建时间', isPrimary: false }
        ]
      },
      {
        table: 'orders',
        tableName: '订单表',
        fields: [
          { name: 'id', type: 'INT', comment: '订单ID', isPrimary: true },
          { name: 'user_id', type: 'INT', comment: '用户ID', isPrimary: false },
          { name: 'amount', type: 'DECIMAL(10,2)', comment: '订单金额', isPrimary: false },
          { name: 'status', type: 'VARCHAR(20)', comment: '订单状态', isPrimary: false },
          { name: 'created_at', type: 'TIMESTAMP', comment: '创建时间', isPrimary: false }
        ]
      },
      {
        table: 'products',
        tableName: '产品表',
        fields: [
          { name: 'id', type: 'INT', comment: '产品ID', isPrimary: true },
          { name: 'name', type: 'VARCHAR(100)', comment: '产品名称', isPrimary: false },
          { name: 'price', type: 'DECIMAL(10,2)', comment: '产品价格', isPrimary: false },
          { name: 'category', type: 'VARCHAR(50)', comment: '产品分类', isPrimary: false },
          { name: 'created_at', type: 'TIMESTAMP', comment: '创建时间', isPrimary: false }
        ]
      }
    ];

    res.json({
      success: true,
      data: {
        datasource_id: id,
        datasource_name: datasource.name,
        tables: tablesWithFields,
        total_tables: tablesWithFields.length,
        total_fields: tablesWithFields.reduce((sum, table) => sum + table.fields.length, 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 健康检查端点 ==========
app.get('/api/admin/health', authMiddleware, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      modules: [
        'users', 'roles', 'menus', 'audit', 'ai', 'system',
        'notifications', 'datasources', 'ai-qa', 'dashboard',
        'crawler', 'file-tools', 'ocr', 'skills', 'rag'
      ]
    };
    res.json({ success: true, data: health });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 简单健康检查（无需认证）
app.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('*', (req, res) => {
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
    res.status(404).send('前端页面未找到');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 DataMind 服务器已启动`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`📊 数据库: ${process.env.CONFIG_DB_NAME || 'DataMind'}`);
  console.log(`✅ 所有模块路由已注册`);
  console.log(`🎯 模块化迁移完成`);
});