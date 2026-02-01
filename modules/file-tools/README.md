# 文件工具模块 (file-tools)

## 概述

文件工具模块提供文件格式转换、PDF合并、图片压缩等实用功能,帮助用户快速处理各种文件格式。

## 功能特性

### 1. 文件格式转换
- PDF → 文本
- Word/Excel → PDF
- CSV → Excel
- JSON → Excel
- 支持批量转换

### 2. PDF 合并
- 合并多个 PDF 文件为一个
- 保持原始格式

### 3. 图片压缩
- 批量压缩图片
- 减小文件体积
- 保持图片质量

### 4. 转换历史
- 记录所有转换操作
- 查看历史记录
- 删除历史记录

## 安装

```bash
# 模块会自动安装,无需手动操作
```

## 配置

模块配置文件位于 `config/default.json`:

```json
{
  "maxFileSize": 104857600,        // 最大文件大小 (100MB)
  "allowedFormats": [...],          // 允许的格式
  "uploadDir": "uploads/file-tools", // 上传目录
  "tempDir": "uploads/temp",        // 临时目录
  "retentionDays": 7,               // 文件保留天数
  "enableHistory": true             // 是否启用历史记录
}
```

## API 接口

### 1. 文件转换

**POST** `/api/modules/file-tools/convert`

请求参数:
- `files`: 文件列表 (multipart/form-data)
- `sourceFormat`: 源格式 (word|excel|image|pdf|txt|csv|json)
- `targetFormat`: 目标格式 (word|excel|image|pdf|txt|csv|json)
- `options`: 转换选项 (可选)

响应:
```json
{
  "success": true,
  "fileId": "uuid",
  "safeName": "filename_converted.pdf",
  "message": "转换完成，请下载"
}
```

### 2. 文件下载

**GET** `/api/modules/file-tools/download/:id/:filename`

参数:
- `id`: 文件ID
- `filename`: 文件名

### 3. 获取历史记录

**GET** `/api/modules/file-tools/history`

查询参数:
- `page`: 页码 (默认: 1)
- `pageSize`: 每页数量 (默认: 20)
- `status`: 状态过滤 (pending|processing|success|failed)
- `startDate`: 开始时间 (时间戳)
- `endDate`: 结束时间 (时间戳)

响应:
```json
{
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "items": [...]
}
```

### 4. 删除历史记录

**DELETE** `/api/modules/file-tools/history/:id`

参数:
- `id`: 历史记录ID

### 5. 清理过期文件 (管理员)

**POST** `/api/modules/file-tools/cleanup`

响应:
```json
{
  "success": true,
  "message": "已清理 10 个过期文件"
}
```

## 数据库表

### file_conversion_history

文件转换历史记录表:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | 主键 |
| user_id | VARCHAR(36) | 用户ID |
| source_format | VARCHAR(20) | 源格式 |
| target_format | VARCHAR(20) | 目标格式 |
| original_filename | VARCHAR(255) | 原文件名 |
| result_filename | VARCHAR(255) | 结果文件名 |
| file_size | BIGINT | 文件大小 |
| status | VARCHAR(20) | 状态 |
| error_message | TEXT | 错误信息 |
| created_at | BIGINT | 创建时间 |
| updated_at | BIGINT | 更新时间 |

## 权限

模块定义了以下权限:

- `file-tools:view` - 查看文件工具
- `file-tools:convert` - 文件转换
- `file-tools:merge` - PDF合并
- `file-tools:compress` - 图片压缩
- `file-tools:history` - 查看历史

## 生命周期钩子

模块实现了完整的生命周期钩子:

- `beforeInstall` - 安装前检查依赖和权限
- `afterInstall` - 安装后创建目录和验证表
- `beforeEnable` - 启用前检查数据库连接
- `afterEnable` - 启用后初始化
- `beforeDisable` - 禁用前检查正在进行的任务
- `afterDisable` - 禁用后清理
- `beforeUninstall` - 卸载前检查和警告
- `afterUninstall` - 卸载后删除表和清理目录

## 依赖

### NPM 包
- `multer` - 文件上传
- `pdf-parse` - PDF 解析
- `xlsx` - Excel 处理
- `uuid` - UUID 生成

### 系统依赖
- Node.js >= 14
- 文件系统写入权限

## 使用示例

### 前端调用

```typescript
import * as fileToolsApi from '@/modules/file-tools/api'

// 文件转换
const result = await fileToolsApi.convertFiles({
  files: [file1, file2],
  sourceFormat: 'pdf',
  targetFormat: 'txt'
})

// 获取下载链接
const downloadUrl = fileToolsApi.getDownloadUrl(result.fileId, result.safeName)

// 获取历史记录
const history = await fileToolsApi.getHistory({
  page: 1,
  pageSize: 20
})
```

### 后端调用

```typescript
import { FileToolsService } from './modules/file-tools/backend/service'

const service = new FileToolsService(db)

// 转换文件
const result = await service.convertFiles({
  files: [...],
  sourceFormat: 'pdf',
  targetFormat: 'txt'
}, userId)

// 获取历史
const history = await service.getHistory({
  userId,
  page: 1,
  pageSize: 20
})
```

## 故障排查

### 1. PDF 转换失败

**问题**: PDF 转文本转换失败  
**解决**: 
- 检查 `pdf-parse` 包是否正确安装
- 检查 `pdfjs-dist` 的 cmaps 目录是否存在
- 查看错误日志获取详细信息

### 2. 文件上传失败

**问题**: 文件上传失败  
**解决**:
- 检查文件大小是否超过限制 (默认 100MB)
- 检查上传目录权限
- 检查磁盘空间

### 3. 历史记录不显示

**问题**: 历史记录页面为空  
**解决**:
- 检查 `enableHistory` 配置是否为 true
- 检查数据库表是否正确创建
- 检查用户权限

## 性能优化

1. **文件清理**: 定期运行清理任务删除过期文件
2. **并发控制**: 限制同时转换的文件数量
3. **缓存**: 对常用转换结果进行缓存
4. **异步处理**: 大文件转换使用异步队列

## 安全注意事项

1. **文件类型验证**: 严格验证上传文件类型
2. **文件大小限制**: 限制单个文件和总大小
3. **路径遍历防护**: 防止路径遍历攻击
4. **临时文件清理**: 及时清理临时文件
5. **权限控制**: 严格的权限检查

## 更新日志

### v1.0.0 (2026-02-01)
- 初始版本
- 支持基本的文件格式转换
- 支持 PDF 合并和图片压缩
- 支持转换历史记录
- 完整的生命周期钩子
- 完整的测试覆盖

## 许可证

MIT

## 作者

System

## 支持

如有问题,请联系系统管理员或查看文档。
