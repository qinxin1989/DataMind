## 测试分层

- `tests/modules/`: 模块实现层测试，只验证 `modules/<name>/backend/*` 的真实业务逻辑。
- `tests/compat/`: 兼容层测试，验证 `src/admin/modules/*` 对旧接口、旧字段和返回结构的适配。
- `tests/core/`: 管理框架核心能力测试，例如权限、模块注册、类型契约。
- `tests/module-system/` 和 `tests/security/`: 平台层测试，验证模块装载、路由管理、签名校验和安全策略。
- `tests/admin/`: 仍未完成模块化迁移的场景型测试，后续应继续按职责下沉到上面三类。

## 推荐执行方式

- 跑模块实现: `npm run test:modules`
- 跑兼容层: `npm run test:compat`
- 跑框架核心: `npm run test:core`
- 跑平台层: `npm run test:platform`
- 跑前端菜单路由冒烟: `npm run test:menu-smoke`
- 自动拉起前后端再跑菜单冒烟: `npm run test:menu-smoke:auto`
- 跑统一助手 / 知识中心 / 采集助手业务流冒烟: `npm run test:business-smoke`
- 自动拉起前后端再跑业务流冒烟: `npm run test:business-smoke:auto`
- 跑遗留场景: `npm run test:scenarios`
