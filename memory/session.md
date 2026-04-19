# Session Memory

## 最近完成
- 已恢复并续上会话 `019da0b9-eeb9-7460-9681-82e4b8effba0` 的最后工作内容
- 旧“五模式分流”与菜单 404 收口已完成，菜单烟测与核心菜单测试已在上个会话中通过
- 本轮继续完成“旧版数据问答接入统一助手中的分析类 / 报告类技能”
- 已新增数据采集中心模块 `universal-table`，把 JW 项目里的“万表归一”流程改造成 DataMind 的项目化采集工作台

## 本轮改动
- `src/agent/index.ts`
  - 扩展 `planAction()`，加入 `report.*` 与 `dataAnalysis.*` 的旧问答意图路由
  - 兼容旧技能名 `data_analysis.executePython` → `dataAnalysis.executePython`
  - `answerWithContext()` 对已识别的 `skill` 直接执行，避免二次规划丢失技能意图
  - 为报告类技能补齐默认参数和更自然的结果文案
  - `answer()` 同步兼容新技能名与技能结果输出
- `docs/tasks.md` / `docs/plan.md`
  - 新增并完成 Plan D：旧版数据问答接入分析类 / 报告类技能
- `modules/universal-table/module.json`
  - 新建“万表归一”模块，挂到“数据采集中心 /collection/universal-table`
- `admin-ui/src/router/moduleRoutes.ts` / `src/index.ts`
  - 接入动态前端路由和后端鉴权桥接 `/api/modules/universal-table`
- `modules/universal-table/backend/*`
  - 新增标准表、项目、项目文件、分类、脱敏、测试数据、Python 脚本生成、脚本执行、结果映射确认的完整后端链路
  - 新增 `backend/python/desensitize.py` 和 `requirements.txt`，支持同格式脱敏与测试数据生成
- `modules/universal-table/frontend/*`
  - 新增标准表管理、项目化上传分类、脚本生成与映射确认工作台页面
  - 补充“分析数据集”列表，展示采集自动入库后的分析表与数据源 ID
- `tests/modules/universal-table/matching.test.ts`
  - 补充表头匹配与脚本模板生成测试
- `src/types/index.ts` / `src/store/configStore.ts` / `src/datasource/mysql.ts`
  - 为自动生成的分析数据源补充 `allowedTables` 限制，确保 Agent 只看当前项目生成的数据表
- `modules/universal-table/backend/service.ts`
  - 采集执行后自动落入项目级分析表，并同步注册受限 MySQL 数据源

## 验证
- `npm run build` 通过
- `npm --prefix admin-ui run build` 通过
- `npx vitest run tests/modules/universal-table/matching.test.ts` 通过
- `python -m py_compile modules/universal-table/backend/python/desensitize.py` 通过
- 临时 TXT 烟测通过：`desensitize.py --action mask` 可输出姓名/手机号/身份证号脱敏结果

## 当前状态
- 旧版数据问答现在可以直接规划并执行新的分析类 / 报告类技能
- 数据采集中心已具备“建标准表 → 建项目 → 上传分类 → 按类生成脱敏/测试样本 → 生成/运行 Python 采集脚本 → 人工确认映射”的基本工作台
- 采集结果现在会自动入库，并按项目+标准表形成单独分析数据源，可直接供后续 Agent 加载业务技能使用
- Python 运行时依赖 `openpyxl` / `python-docx` / `pdfplumber` / `reportlab`，已写入 `modules/universal-table/backend/python/requirements.txt`
- 已定位 AI 脱敏/测试时前端“网络错误”的主要原因：开发模式 `tsx watch --include modules` 监听了 `modules/`，而 Python 脚本运行时在 `modules/universal-table/backend/python/` 生成 `__pycache__`，触发后端热重启，导致请求中断
- 已在 `modules/universal-table/backend/service.ts` 中为 Python 子进程增加 `-B` 和 `PYTHONDONTWRITEBYTECODE=1`，避免再因字节码文件写入触发模块整轮刷新
