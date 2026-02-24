# Git 工作流规范

## 分支
- `main` → 主分支

## 提交信息格式
使用中文提交信息，格式:
```
<类型>: <简要描述>

<详细说明（可选）>
```

类型:
- `feat`: 新功能
- `fix`: 修复 Bug
- `refactor`: 重构
- `docs`: 文档更新
- `style`: 代码格式调整
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链

## 注意事项
- `.env` 和 `.env.encrypted` 已在 .gitignore 中，不要提交
- `node_modules/`, `dist/`, `.venv/` 不要提交
- `uploads/` 目录不提交
