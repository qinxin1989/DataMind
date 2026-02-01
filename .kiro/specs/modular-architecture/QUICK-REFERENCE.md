# 快速参考卡 - Task 22

## 🎯 当前任务

**Task 22: 其他模块迁移**  
**状态**: ⏳ 待开始  
**下一步**: Task 22.1 - 迁移通知中心模块

---

## 📊 项目状态速览

```
阶段3进度: 85.7% (6/7任务组完成)

✅ Task 16: AI服务模块
✅ Task 17: 数据采集中心模块
✅ Task 18: AI问答模块
✅ Task 19: 数据源管理模块
✅ Task 20: 工具模块
✅ Task 21: 系统管理模块 ← 刚完成
⏳ Task 22: 其他模块 ← 当前任务
```

**累计**: 13个模块 | 503个测试 | 96.4%通过率

---

## 📋 Task 22 子任务

| 子任务 | 模块 | 预计时间 | 状态 |
|-------|------|---------|------|
| 22.1 | notification (通知中心) | 4-6小时 | ⏳ 待开始 |
| 22.2 | dashboard (大屏管理) | 6-8小时 | ⏳ 待开始 |
| 22.3 | 集成测试 | 3-4小时 | ⏳ 待开始 |

**总计**: 13-18小时 (2-3天)

---

## 🚀 Task 22.1 快速启动

### 创建模块

```bash
# 1. 创建目录结构
mkdir -p modules/notification/backend/hooks
mkdir -p modules/notification/backend/migrations
mkdir -p modules/notification/frontend/views
mkdir -p modules/notification/frontend/api
mkdir -p modules/notification/config
mkdir -p tests/modules/notification
```

### 核心文件清单

**必需文件** (13个):
- [ ] `module.json` - 模块清单
- [ ] `README.md` - 模块文档
- [ ] `backend/index.ts` - 后端入口
- [ ] `backend/types.ts` - 类型定义
- [ ] `backend/service.ts` - 业务逻辑
- [ ] `backend/routes.ts` - 路由定义
- [ ] `backend/migrations/001_create_notifications_tables.sql` - 数据库迁移
- [ ] `frontend/index.ts` - 前端入口
- [ ] `frontend/views/Notification.vue` - 前端页面
- [ ] `frontend/api/index.ts` - API调用
- [ ] `config/schema.json` - 配置Schema
- [ ] `config/default.json` - 默认配置
- [ ] `tests/modules/notification/service.test.ts` - 单元测试

**生命周期钩子** (8个):
- [ ] `backend/hooks/beforeInstall.ts`
- [ ] `backend/hooks/afterInstall.ts`
- [ ] `backend/hooks/beforeEnable.ts`
- [ ] `backend/hooks/afterEnable.ts`
- [ ] `backend/hooks/beforeDisable.ts`
- [ ] `backend/hooks/afterDisable.ts`
- [ ] `backend/hooks/beforeUninstall.ts`
- [ ] `backend/hooks/afterUninstall.ts`

---

## 📚 参考模块

**推荐参考顺序**:

1. **system-config** - 系统配置模块
   - 路径: `modules/system-config/`
   - 特点: 完整的CRUD、配置验证
   - 测试: 20个，100%通过

2. **audit-log** - 审计日志模块
   - 路径: `modules/audit-log/`
   - 特点: 日志记录、统计分析
   - 测试: 20个，100%通过

3. **system-backup** - 系统备份模块
   - 路径: `modules/system-backup/`
   - 特点: 备份创建、验证、恢复
   - 测试: 15个，100%通过

---

## 🎯 API端点设计 (notification)

**预计8-10个端点**:

```typescript
GET    /api/notifications           // 获取通知列表
GET    /api/notifications/:id       // 获取通知详情
POST   /api/notifications           // 创建通知
PUT    /api/notifications/:id       // 更新通知
DELETE /api/notifications/:id       // 删除通知
POST   /api/notifications/:id/read  // 标记为已读
POST   /api/notifications/read-all  // 全部标记为已读
GET    /api/notifications/unread-count // 获取未读数量
POST   /api/notifications/batch     // 批量发送
GET    /api/notifications/stats     // 通知统计
```

---

## ✅ 验收标准

### 功能完整性
- [ ] 所有API端点正常工作
- [ ] 前端页面完整且用户体验良好
- [ ] 权限控制正确
- [ ] 菜单配置正确

### 代码质量
- [ ] 代码结构清晰
- [ ] 类型定义完整
- [ ] 错误处理完善
- [ ] 注释文档完整

### 测试覆盖
- [ ] 单元测试通过率 ≥ 95%
- [ ] 测试覆盖所有核心功能
- [ ] 测试覆盖边界情况

### 性能指标
- [ ] API响应时间 < 100ms
- [ ] 页面加载时间 < 2s
- [ ] 数据库查询优化

### 文档完整性
- [ ] README.md完整
- [ ] API文档完整
- [ ] 配置说明完整
- [ ] 使用示例完整

---

## 📖 重要文档

### 必读文档
1. [task-22-plan.md](task-22-plan.md) - Task 22详细计划
2. [module-development-guide.md](module-development-guide.md) - 模块开发指南
3. [phase-3-progress.md](phase-3-progress.md) - 阶段3进度

### 参考文档
1. [task-21-summary.md](task-21-summary.md) - Task 21总结（最新完成）
2. [task-20-summary.md](task-20-summary.md) - Task 20总结
3. [design.md](design.md) - 设计文档

---

## 💡 开发提示

### 模块清单 (module.json)

```json
{
  "id": "notification",
  "name": "通知中心",
  "version": "1.0.0",
  "description": "系统通知管理模块",
  "author": "AI Data Platform Team",
  "dependencies": [],
  "permissions": [
    {
      "id": "notification:view",
      "name": "查看通知",
      "description": "允许查看通知列表和详情"
    },
    {
      "id": "notification:create",
      "name": "创建通知",
      "description": "允许创建和发送通知"
    },
    {
      "id": "notification:manage",
      "name": "管理通知",
      "description": "允许管理所有通知"
    }
  ],
  "menus": [
    {
      "id": "notification-main",
      "title": "通知中心",
      "path": "/system/notification",
      "icon": "BellOutlined",
      "order": 904,
      "permission": "notification:view"
    }
  ],
  "backend": {
    "entry": "backend/index.ts",
    "routes": "backend/routes.ts"
  },
  "frontend": {
    "entry": "frontend/index.ts"
  }
}
```

### 数据库表设计

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL COMMENT '通知标题',
  content TEXT COMMENT '通知内容',
  type VARCHAR(50) DEFAULT 'info' COMMENT '通知类型',
  user_id INT COMMENT '接收用户ID',
  is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';
```

---

## 🔄 工作流程

1. **创建模块结构** (30分钟)
   - 创建目录和基础文件
   - 编写 module.json

2. **实现后端服务** (2-3小时)
   - 定义类型 (types.ts)
   - 实现服务 (service.ts)
   - 定义路由 (routes.ts)
   - 创建入口 (index.ts)

3. **实现生命周期钩子** (1小时)
   - 8个钩子文件
   - 数据库迁移脚本

4. **实现前端** (1-2小时)
   - 页面组件 (Notification.vue)
   - API调用 (api/index.ts)
   - 前端入口 (index.ts)

5. **编写测试** (1-2小时)
   - 单元测试 (20+个)
   - 运行测试验证

6. **编写文档** (30分钟)
   - README.md
   - API文档

7. **创建完成报告** (15分钟)
   - task-22.1-completion.md

---

## 🎯 执行原则

1. ✅ **一次只执行一个子任务**
2. ✅ **每个模块创建后立即测试**
3. ✅ **参考已完成的模块**
4. ✅ **测试必须100%通过**
5. ✅ **创建详细的完成报告**

---

## 📞 用户指令

准备好后，用户可以说：
- **"继续"** - 开始Task 22.1
- **"开始Task 22.1"** - 开始迁移通知中心模块
- **"查看详细计划"** - 查看task-22-plan.md

---

**更新时间**: 2026-02-01  
**状态**: ✅ 准备就绪

