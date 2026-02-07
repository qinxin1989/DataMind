<template>
  <div class="crawler-template-config-enhanced">
    <div class="page-header">
      <h1>采集模板配置</h1>
      <p class="subtitle">配置和管理网页采集模板</p>
    </div>

    <!-- 模板列表视图 -->
    <a-card v-if="!editMode" :bordered="false">
      <div class="toolbar">
        <a-space>
          <a-input 
            v-model:value="searchKeyword" 
            placeholder="搜索模板名称或URL" 
            style="width: 300px"
            allow-clear
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-button type="primary" @click="handleAdd">
            <template #icon><PlusOutlined /></template>
            新增模板
          </a-button>
        </a-space>
        <a-tooltip>
          <template #title>
            <div style="max-width: 300px;">
              <p><strong>采集模板配置说明：</strong></p>
              <p>• 点击"新增模板"创建新的采集配置</p>
              <p>• 点击"编辑"修改现有模板</p>
              <p>• 点击"测试"验证模板是否正常工作</p>
              <p>• 支持AI智能分析，自动识别网页结构</p>
            </div>
          </template>
          <a-button type="text">
            <template #icon>
              <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
                <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/>
              </svg>
            </template>
            帮助
          </a-button>
        </a-tooltip>
      </div>

      <a-table 
        :columns="columns" 
        :data-source="filteredTemplates" 
        :loading="loading" 
        row-key="id"
        :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'url'">
            <a :href="record.url" target="_blank" class="url-link">{{ record.url }}</a>
          </template>
          <template v-else-if="column.key === 'fields'">
            <a-tag v-for="field in record.fields" :key="field.name" color="blue">
              {{ field.name }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'pagination'">
            <a-tag :color="record.pagination_enabled ? 'green' : 'default'">
              {{ record.pagination_enabled ? `启用 (最多${record.pagination_max_pages || 50}页)` : '禁用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.created_at) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="handleTest(record)">测试</a-button>
              <a-popconfirm 
                title="确定删除此模板？" 
                @confirm="handleDelete(record.id)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 编辑视图：左右分栏布局 -->
    <div v-else class="edit-layout">
      <!-- 顶部操作栏 -->
      <div class="edit-header">
        <a-space>
          <a-tooltip title="快捷键: Esc">
            <a-button @click="handleCancel">
              <template #icon><ArrowLeftOutlined /></template>
              返回列表
            </a-button>
          </a-tooltip>
          <a-divider type="vertical" />
          <span class="edit-title">{{ editingTemplate ? '编辑模板' : '新增模板' }}</span>
        </a-space>
        <a-space>
          <a-tooltip>
            <template #title>
              <div style="max-width: 300px;">
                <p><strong>操作指引：</strong></p>
                <p>1. 输入目标URL后，可点击"AI智能分析"自动识别字段</p>
                <p>2. 或手动配置容器选择器和字段选择器</p>
                <p>3. 在右侧预览面板查看采集效果</p>
                <p>4. 测试通过后保存模板</p>
                <p><strong>快捷键：</strong></p>
                <p>Ctrl+S: 保存 | Ctrl+T: 测试 | Esc: 返回</p>
              </div>
            </template>
            <a-button type="text">
              <template #icon>
                <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
                  <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
                  <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/>
                </svg>
              </template>
              帮助
            </a-button>
          </a-tooltip>
          <a-tooltip title="快捷键: Ctrl+T">
            <a-button @click="handleTestConfig" :loading="testing">
              <template #icon><ExperimentOutlined /></template>
              测试配置
            </a-button>
          </a-tooltip>
          <a-tooltip title="快捷键: Ctrl+S">
            <a-button type="primary" @click="handleSaveConfig" :loading="saving">
              <template #icon><SaveOutlined /></template>
              保存模板
            </a-button>
          </a-tooltip>
        </a-space>
      </div>

      <!-- 左右分栏内容 -->
      <div class="split-layout">
        <!-- 左侧：配置表单 -->
        <div class="left-panel" :class="{ collapsed: leftPanelCollapsed }">
          <div class="panel-header">
            <span class="panel-title">配置表单</span>
            <a-button 
              type="text" 
              size="small" 
              @click="leftPanelCollapsed = !leftPanelCollapsed"
            >
              {{ leftPanelCollapsed ? '展开' : '收起' }}
            </a-button>
          </div>
          <div v-show="!leftPanelCollapsed" class="panel-content">
            <ConfigForm
              v-model="formState"
              :loading="saving"
              @ai-analyze="handleAIAnalyze"
            />
          </div>
        </div>

        <!-- 右侧：预览面板 -->
        <div class="right-panel" :class="{ collapsed: rightPanelCollapsed }">
          <div class="panel-header">
            <span class="panel-title">预览面板</span>
            <a-button 
              type="text" 
              size="small" 
              @click="rightPanelCollapsed = !rightPanelCollapsed"
            >
              {{ rightPanelCollapsed ? '展开' : '收起' }}
            </a-button>
          </div>
          <div v-show="!rightPanelCollapsed" class="panel-content">
            <PreviewPanel
              ref="previewPanelRef"
              :url="formState.url"
              :container-selector="formState.containerSelector"
              :fields="formState.fields"
              :preview-data="previewData"
              :preview-loading="previewLoading"
              :preview-error="previewError"
              @selector-selected="handleSelectorSelected"
              @apply-strategy="handleApplyStrategy"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 测试结果弹窗 -->
    <a-modal
      v-model:open="testVisible"
      title="测试采集结果"
      width="1000px"
      :footer="null"
    >
      <div v-if="testLoading" class="loading-box">
        <a-spin tip="正在测试采集..." />
      </div>
      <div v-else-if="testResult">
        <a-alert 
          v-if="testResult.success" 
          type="success" 
          :message="`成功采集 ${testResult.count} 条数据`"
          show-icon
          style="margin-bottom: 16px"
        />
        <a-alert 
          v-else 
          type="error" 
          :message="testResult.error || '采集失败'"
          show-icon
          style="margin-bottom: 16px"
        />
        
        <a-table 
          v-if="testResult.success && testResult.data"
          :columns="testColumns"
          :data-source="testResult.data.slice(0, 10)"
          :pagination="false"
          size="small"
          bordered
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { 
  SearchOutlined, 
  PlusOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  ExperimentOutlined
} from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'
import dayjs from 'dayjs'
import ConfigForm from '@/components/crawler/ConfigForm.vue'
import PreviewPanel from '@/components/crawler/PreviewPanel.vue'

// 状态管理
const loading = ref(false)
const templates = ref<any[]>([])
const searchKeyword = ref('')
const editMode = ref(false)
const editingTemplate = ref<any>(null)
const saving = ref(false)
const testing = ref(false)
const testVisible = ref(false)
const testLoading = ref(false)
const testResult = ref<any>(null)
const testColumns = ref<any[]>([])
const previewData = ref<any[]>([])
const previewLoading = ref(false)
const previewError = ref('')
const previewPanelRef = ref<any>(null)
const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)

const formState = ref({
  name: '',
  description: '',
  department: '',
  dataType: '',
  url: '',
  containerSelector: '',
  fields: [
    { name: '标题', selector: 'a' },
    { name: '链接', selector: 'a::attr(href)' },
    { name: '发布日期', selector: 'span' }
  ],
  paginationEnabled: true,
  paginationNextSelector: '',
  paginationMaxPages: 50
})

const columns = [
  { title: '模板名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '归属部门', dataIndex: 'department', key: 'department', width: 120 },
  { title: '数据类型', dataIndex: 'data_type', key: 'dataType', width: 120 },
  { title: '目标URL', dataIndex: 'url', key: 'url', ellipsis: true },
  { title: '字段', key: 'fields', width: 200 },
  { title: '分页', key: 'pagination', width: 150 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' }
]

const filteredTemplates = computed(() => {
  if (!searchKeyword.value) return templates.value
  const keyword = searchKeyword.value.toLowerCase()
  return templates.value.filter(t => 
    t.name?.toLowerCase().includes(keyword) || 
    t.url?.toLowerCase().includes(keyword)
  )
})

onMounted(() => {
  fetchTemplates()
  // 添加键盘快捷键监听
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // 移除键盘快捷键监听
  document.removeEventListener('keydown', handleKeyDown)
})

// 键盘快捷键处理
function handleKeyDown(e: KeyboardEvent) {
  // 只在编辑模式下启用快捷键
  if (!editMode.value) return
  
  // Ctrl+S 保存
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    handleSaveConfig()
  }
  
  // Ctrl+T 测试
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault()
    handleTestConfig()
  }
  
  // Esc 关闭弹窗或返回列表
  if (e.key === 'Escape') {
    if (testVisible.value) {
      testVisible.value = false
    } else {
      handleCancel()
    }
  }
}

// 监听URL变化，自动预览数据
watch(() => formState.value.url, (newUrl) => {
  if (newUrl && editMode.value) {
    debouncedPreview()
  }
})

// 监听选择器变化，自动预览数据
watch(() => [formState.value.containerSelector, formState.value.fields], () => {
  if (formState.value.url && editMode.value) {
    debouncedPreview()
  }
}, { deep: true })

// 防抖预览
let previewTimer: any = null
function debouncedPreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    handlePreview()
  }, 1000)
}

async function fetchTemplates() {
  loading.value = true
  try {
    const res = await aiApi.getCrawlerTemplates()
    if (res.success && res.data) {
      templates.value = res.data
    }
  } catch (error) {
    message.error('获取模板列表失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  editingTemplate.value = null
  formState.value = {
    name: '',
    description: '',
    department: '',
    dataType: '',
    url: '',
    containerSelector: '',
    fields: [
      { name: '标题', selector: 'a' },
      { name: '链接', selector: 'a::attr(href)' },
      { name: '发布日期', selector: 'span' }
    ],
    paginationEnabled: true,
    paginationNextSelector: '',
    paginationMaxPages: 50
  }
  editMode.value = true
  previewData.value = []
  previewError.value = ''
}

function handleEdit(record: any) {
  editingTemplate.value = record
  formState.value = {
    name: record.name,
    description: record.description || '',
    department: record.department || '',
    dataType: record.data_type || '',
    url: record.url,
    containerSelector: record.containerSelector || record.container_selector,
    fields: record.fields || [],
    paginationEnabled: record.pagination_enabled || false,
    paginationNextSelector: record.pagination_next_selector || '',
    paginationMaxPages: record.pagination_max_pages || 50
  }
  editMode.value = true
  previewData.value = []
  previewError.value = ''
  
  // 加载后立即预览
  handlePreview()
}

function handleCancel() {
  editMode.value = false
  editingTemplate.value = null
  previewData.value = []
  previewError.value = ''
}

async function handleSaveConfig() {
  if (!formState.value.name || !formState.value.url || !formState.value.containerSelector) {
    message.error('请填写必填项')
    return
  }

  if (formState.value.fields.length === 0) {
    message.error('请至少添加一个字段')
    return
  }

  saving.value = true
  try {
    // Construct payload matching SaveTemplateRequest interface
    const data = {
      name: formState.value.name,
      description: formState.value.description,
      department: formState.value.department,
      dataType: formState.value.dataType, // maps to data_type in backend
      url: formState.value.url,
      // Backend expects 'selectors' object with 'container' and 'fields'
      selectors: {
        container: formState.value.containerSelector,
        fields: formState.value.fields.reduce((acc: any, field: any) => {
          acc[field.name] = field.selector
          return acc
        }, {})
      },
      paginationEnabled: formState.value.paginationEnabled,
      paginationNextSelector: formState.value.paginationNextSelector,
      paginationMaxPages: formState.value.paginationMaxPages
    }

    if (editingTemplate.value) {
      await aiApi.updateCrawlerTemplate(editingTemplate.value.id, data)
      message.success('模板更新成功')
    } else {
      await aiApi.createCrawlerTemplate(data)
      message.success('模板创建成功')
    }

    // 保存后自动预览（需求5.5）
    await handlePreview()
    
    // 自动切换到数据预览标签页（需求5.5）
    if (previewPanelRef.value && previewPanelRef.value.switchToTab) {
      previewPanelRef.value.switchToTab('data')
    }
    
    // 刷新列表
    await fetchTemplates()
  } catch (error) {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function handleTestConfig() {
  if (!formState.value.url || !formState.value.containerSelector) {
    message.error('请先填写URL和容器选择器')
    return
  }

  testing.value = true
  try {
    const selectors = {
      container: formState.value.containerSelector,
      fields: formState.value.fields.reduce((acc: any, field: any) => {
        acc[field.name] = field.selector
        return acc
      }, {})
    }

    const res = await aiApi.testCrawlerTemplate(
      formState.value.url,
      selectors,
      {
        enabled: formState.value.paginationEnabled,
        maxPages: formState.value.paginationMaxPages,
        nextPageSelector: formState.value.paginationNextSelector
      }
    )

    if (res.success && res.data) {
      message.success(res.data.message || '测试成功')
      
      // 显示测试结果
      testResult.value = res.data
      testVisible.value = true

      if (res.data.success && res.data.data && res.data.data.length > 0) {
        const fields = Object.keys(res.data.data[0])
        testColumns.value = fields.map(f => ({
          title: f,
          dataIndex: f,
          key: f,
          ellipsis: true
        }))
      }
    } else {
      message.error('测试失败')
    }
  } catch (error: any) {
    message.error(`测试失败: ${error.message || '未知错误'}`)
  } finally {
    testing.value = false
  }
}

async function handlePreview() {
  if (!formState.value.url || !formState.value.containerSelector) {
    return
  }

  previewLoading.value = true
  previewError.value = ''
  
  try {
    const selectors = {
      container: formState.value.containerSelector,
      fields: formState.value.fields.reduce((acc: any, field: any) => {
        acc[field.name] = field.selector
        return acc
      }, {})
    }

    const res = await aiApi.previewCrawlerEnhanced(
      formState.value.url,
      selectors,
      10
    )

    if (res.success && res.data) {
      previewData.value = res.data.data || []
      if (previewData.value.length === 0) {
        previewError.value = '未采集到数据，请检查选择器配置'
      }
    } else {
      previewError.value = '预览失败'
      previewData.value = []
    }
  } catch (error: any) {
    previewError.value = error.message || '预览失败'
    previewData.value = []
  } finally {
    previewLoading.value = false
  }
}

async function handleDelete(id: string) {
  try {
    await aiApi.deleteCrawlerTemplate(id)
    message.success('删除成功')
    fetchTemplates()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleTest(record: any) {
  testVisible.value = true
  testLoading.value = true
  testResult.value = null

  try {
    // Construct selectors object from array
    const selectors = {
      container: record.containerSelector || record.container_selector,
      fields: Array.isArray(record.fields)
        ? record.fields.reduce((acc: any, field: any) => {
            acc[field.name] = field.selector
            return acc
          }, {})
        : record.fields
    }

    const paginationConfig = {
      enabled: record.pagination_enabled,
      maxPages: record.pagination_max_pages,
      nextPageSelector: record.pagination_next_selector
    }

    const res = await aiApi.testCrawlerTemplate(record.url, selectors, paginationConfig)
    testResult.value = res.data // Note: res.data contains the result object (success, data, count, etc)

    if (res.success && res.data && res.data.success && res.data.data && res.data.data.length > 0) {
      const firstRow = res.data.data[0]
      const fields = Object.keys(firstRow)
      testColumns.value = fields.map(f => ({
        title: f,
        dataIndex: f,
        key: f,
        ellipsis: true
      }))
    }
  } catch (error: any) {
    testResult.value = {
      success: false,
      error: error.message || '测试失败'
    }
  } finally {
    testLoading.value = false
  }
}

function handleAIAnalyze() {
  // AI分析功能已在ConfigForm组件中实现
  message.info('AI分析功能已在配置表单中实现')
}

function handleSelectorSelected(selector: string, fieldName?: string) {
  if (fieldName) {
    // 更新特定字段的选择器
    const field = formState.value.fields.find(f => f.name === fieldName)
    if (field) {
      field.selector = selector
    }
  } else {
    // 更新容器选择器
    formState.value.containerSelector = selector
  }
  
  message.success('选择器已应用')
}

function handleApplyStrategy(strategy: any) {
  // 应用AI诊断推荐的策略
  if (strategy.waitForSelector) {
    formState.value.containerSelector = strategy.waitForSelector
  }
  
  message.success('已应用推荐策略')
}

function formatDate(date: any) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
}
</script>

<style scoped>
.crawler-template-config-enhanced {
  padding: 0;
  height: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.subtitle {
  color: #666;
  margin: 0;
}

.toolbar {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.url-link {
  color: #1890ff;
  text-decoration: none;
}

.url-link:hover {
  text-decoration: underline;
}

/* 编辑视图布局 */
.edit-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
}

.edit-title {
  font-size: 16px;
  font-weight: 600;
}

.split-layout {
  display: flex;
  gap: 16px;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 40%;
  overflow-y: auto;
  background: #fff;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.left-panel.collapsed {
  width: 60px;
  min-width: 60px;
}

.right-panel {
  width: 60%;
  overflow-y: auto;
  background: #fff;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.right-panel.collapsed {
  width: 60px;
  min-width: 60px;
}

.left-panel.collapsed ~ .right-panel:not(.collapsed) {
  width: calc(100% - 76px);
}

.right-panel.collapsed ~ .left-panel:not(.collapsed) {
  width: calc(100% - 76px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
  border-radius: 4px 4px 0 0;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #262626;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.loading-box {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 响应式布局 */
@media (max-width: 1400px) {
  .split-layout {
    flex-direction: column;
  }
  
  .left-panel,
  .right-panel {
    width: 100% !important;
    max-height: 50vh;
  }
  
  .left-panel.collapsed,
  .right-panel.collapsed {
    width: 100% !important;
    min-width: 100%;
    max-height: 60px;
  }
}

@media (max-width: 768px) {
  .edit-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .edit-header > a-space {
    width: 100%;
    justify-content: space-between;
  }
  
  .panel-content {
    padding: 16px;
  }
  
  .page-header h1 {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .crawler-template-config-enhanced {
    padding: 0 8px;
  }
  
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .toolbar a-space {
    width: 100%;
  }
  
  .toolbar a-input {
    width: 100% !important;
  }
  
  .panel-content {
    padding: 12px;
  }
}
</style>
