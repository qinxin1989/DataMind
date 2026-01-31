# 需求文档：采集模板配置增强

## 简介

增强采集模板配置页面，将网页预览、选择器可视化和数据预览功能整合到配置页面中，并添加智能元素选择和AI辅助分析功能，提升用户配置爬虫模板的体验。

## 术语表

- **System**: 采集模板配置系统
- **User**: 使用系统配置爬虫模板的用户
- **Template**: 爬虫采集模板，包含URL、选择器等配置
- **Selector**: CSS选择器，用于定位网页元素
- **Preview_Panel**: 预览面板，包含网页预览、选择器可视化、数据预览三个标签页
- **Element_Picker**: 元素选择器，用于在网页预览中点击选择元素
- **AI_Analyzer**: AI分析器，用于分析采集失败原因并推荐策略

## 需求

### 需求 1: 整合预览面板到配置页面

**用户故事**: 作为用户，我希望在配置模板时能直接看到网页预览和数据预览，这样我可以实时验证配置效果。

#### 验收标准

1. WHEN 用户打开采集模板配置页面 THEN THE System SHALL 在右侧显示预览面板
2. THE Preview_Panel SHALL 包含三个标签页：网页预览、选择器可视化、数据预览
3. WHEN 用户输入URL并点击加载 THEN THE System SHALL 在网页预览标签页中显示该网页
4. WHEN 用户配置选择器 THEN THE System SHALL 在选择器可视化标签页中显示选择器列表
5. WHEN 用户点击预览数据按钮 THEN THE System SHALL 在数据预览标签页中显示采集结果

### 需求 2: 数据预览默认显示条数

**用户故事**: 作为用户，我希望数据预览默认显示合适的条数，这样我可以快速验证采集效果而不会加载过多数据。

#### 验收标准

1. WHEN 用户预览数据 THEN THE System SHALL 默认显示10条数据
2. THE System SHALL 提供分页控件允许用户查看更多数据
3. WHEN 数据少于10条 THEN THE System SHALL 显示所有可用数据
4. THE System SHALL 在数据预览区域显示总数据条数

### 需求 3: 网页预览元素点击选择

**用户故事**: 作为用户，我希望能在网页预览中直接点击元素来获取其CSS选择器，这样我不需要手动编写选择器。

#### 验收标准

1. WHEN 用户点击"启用元素选择"按钮 THEN THE Element_Picker SHALL 激活
2. WHEN Element_Picker 激活 THEN THE System SHALL 在网页预览中高亮鼠标悬停的元素
3. WHEN 用户点击网页预览中的元素 THEN THE System SHALL 自动生成该元素的CSS选择器
4. WHEN 选择器生成后 THEN THE System SHALL 将选择器填充到对应的输入框中
5. WHEN 用户点击"停止选择"按钮 THEN THE Element_Picker SHALL 停用

### 需求 4: AI智能获取采集标签

**用户故事**: 作为用户，我希望AI能自动分析网页并推荐需要采集的字段和选择器，这样我可以快速完成配置。

#### 验收标准

1. WHEN 用户点击"AI智能分析"按钮 THEN THE AI_Analyzer SHALL 分析网页结构
2. WHEN AI分析完成 THEN THE System SHALL 显示推荐的字段列表和对应选择器
3. THE System SHALL 为每个推荐字段显示置信度
4. WHEN 用户选择推荐字段 THEN THE System SHALL 将选择器自动填充到配置表单
5. THE System SHALL 允许用户编辑AI推荐的选择器

### 需求 5: 保存后预览数据

**用户故事**: 作为用户，我希望保存选择器配置后能立即预览采集效果，这样我可以验证配置是否正确。

#### 验收标准

1. WHEN 用户保存选择器配置 THEN THE System SHALL 自动触发数据预览
2. WHEN 数据预览成功 THEN THE System SHALL 在数据预览标签页显示采集结果
3. WHEN 数据预览失败 THEN THE System SHALL 显示错误信息
4. THE System SHALL 在预览数据时显示加载状态
5. WHEN 预览完成 THEN THE System SHALL 自动切换到数据预览标签页

### 需求 6: AI分析采集失败原因

**用户故事**: 作为用户，当采集失败时，我希望AI能分析原因并给出建议，这样我可以快速修复配置问题。

#### 验收标准

1. WHEN 数据预览返回空结果或错误 THEN THE System SHALL 提供"AI分析"按钮
2. WHEN 用户点击"AI分析"按钮 THEN THE AI_Analyzer SHALL 分析失败原因
3. THE AI_Analyzer SHALL 检查选择器是否匹配网页元素
4. THE AI_Analyzer SHALL 检查网页是否为动态加载
5. WHEN 分析完成 THEN THE System SHALL 显示失败原因和推荐的采集策略
6. THE System SHALL 提供"应用推荐策略"按钮自动修复配置

### 需求 7: 选择器实时验证

**用户故事**: 作为用户，我希望在输入选择器时能实时看到匹配的元素数量，这样我可以及时调整选择器。

#### 验收标准

1. WHEN 用户输入或修改选择器 THEN THE System SHALL 实时验证选择器
2. THE System SHALL 显示选择器匹配的元素数量
3. WHEN 选择器无效 THEN THE System SHALL 显示错误提示
4. WHEN 选择器匹配0个元素 THEN THE System SHALL 显示警告
5. THE System SHALL 在网页预览中高亮显示匹配的元素

### 需求 8: 模板配置表单

**用户故事**: 作为用户，我希望有一个清晰的表单来配置模板的所有参数，这样我可以系统地完成配置。

#### 验收标准

1. THE System SHALL 提供表单输入：模板名称、URL、归属部门、数据类型
2. THE System SHALL 提供容器选择器配置
3. THE System SHALL 提供字段选择器配置（支持添加多个字段）
4. WHEN 用户添加字段 THEN THE System SHALL 允许输入字段名称和选择器
5. THE System SHALL 提供删除字段功能
6. THE System SHALL 提供保存和测试按钮

### 需求 9: 分页配置

**用户故事**: 作为用户，我希望能配置是否采集分页数据以及采集页数，这样我可以控制采集范围。

#### 验收标准

1. THE System SHALL 提供"启用分页"开关
2. WHEN 启用分页 THEN THE System SHALL 显示分页配置选项
3. THE System SHALL 允许配置最大采集页数
4. THE System SHALL 允许配置分页URL模式
5. THE System SHALL 提供分页选择器配置（下一页按钮或页码链接）

### 需求 10: 模板测试功能

**用户故事**: 作为用户，我希望能在保存前测试模板配置，这样我可以确保配置正确后再保存。

#### 验收标准

1. THE System SHALL 提供"测试采集"按钮
2. WHEN 用户点击测试按钮 THEN THE System SHALL 使用当前配置执行采集
3. WHEN 测试成功 THEN THE System SHALL 显示采集到的数据
4. WHEN 测试失败 THEN THE System SHALL 显示错误信息和AI分析建议
5. THE System SHALL 允许用户在测试后继续修改配置

## 非功能需求

### 性能

1. 网页预览加载时间应在3秒内
2. 数据预览响应时间应在2秒内
3. AI分析响应时间应在5秒内
4. 元素选择器响应应即时（<100ms）

### 可用性

1. 界面应采用左右分栏布局，左侧配置表单，右侧预览面板
2. 所有操作应提供明确的视觉反馈
3. 错误信息应清晰易懂
4. 应提供操作提示和帮助文档

### 兼容性

1. 支持Chrome、Firefox、Edge等主流浏览器
2. 网页预览应支持iframe跨域加载
3. 应处理各种网页编码格式

## 约束条件

1. 网页预览使用iframe实现，受同源策略限制
2. AI分析依赖后端AI服务配置
3. 元素选择器需要注入JavaScript到iframe中
4. 数据预览受网页结构复杂度影响
