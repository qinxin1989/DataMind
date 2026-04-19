# Admin Backend Module

`src/admin/` 现在只承担两类职责：

1. 管理后台的核心基础设施：数据库初始化、权限中间件、通用响应工具。
2. 少量兼容层：为了兼容旧接口而保留的适配代码，例如旧字段映射、旧服务包装。

## 边界约束

- 新的业务功能不要再落到 `src/admin/modules/*`。
- 新的业务能力统一创建到 `modules/<module-name>/`。
- 如果必须兼容旧接口，只在 `src/admin/modules/*` 保留一层薄适配，真实业务逻辑仍放在 `modules/*`。

## 当前目录职责

### `core/`
- 数据库连接池、初始化脚本、模块注册辅助

### `middleware/`
- 权限校验、审计等后台中间件

### `utils/`
- 通用响应和工具函数

### `modules/`
- 仅保留兼容层，不再新增真实业务实现

## 模块化开发

建议直接使用模块脚手架命令创建新模块：

```bash
npm run module:create -- your-module-name --display-name 你的模块名
```

更多约定见 `docs/module-development.md`。
