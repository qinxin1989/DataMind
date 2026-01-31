<template>
  <div class="crawler-template-config">
    <div class="page-header">
      <h1>采集模板配置</h1>
      <p class="subtitle">配置和管理网页采集模板</p>
    </div>

    <a-card :bordered="false">
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

    <!-- 新增/编辑模板弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingTemplate ? '编辑模板' : '新增模板'"
      width="800px"
      @ok="handleSave"
      :confirmLoading="saving"
    >
      <a-form :model="formState" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="formState.name" placeholder="例如：国家数据局政策文件" />
        </a-form-item>

        <a-form-item label="归属部门">
          <a-input v-model:value="formState.department" placeholder="例如：数据管理部" />
        </a-form-item>

        <a-form-item label="数据类型">
          <a-input v-model:value="formState.dataType" placeholder="例如：政策文件" />
        </a-form-item>

        <a-form-item label="目标URL" required>
          <a-space style="width: 100%">
            <a-input 
              v-model:value="formState.url" 
              placeholder="https://example.com/list" 
              style="flex: 1"
            />
            <a-button 
              type="primary" 
              @click="handleAIAnalysis"
              :loading="aiAnalyzing"
              :disabled="!formState.url"
            >
              <template #icon>
                <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
                  <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
                  <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/>
                </svg>
              </template>
              AI智能分析
            </a-button>
          </a-space>
        </a-form-item>

        <a-form-item label="容器选择器" required>
          <a-input 
            v-model:value="formState.containerSelector" 
            placeholder="例如：ul.list > li"
          />
          <div class="help-text">
            用于定位列表项的 CSS 选择器
          </div>
        </a-form-item>

        <!-- AI推荐字段面板 -->
        <a-alert 
          v-if="aiRecommendations && aiRecommendations.fields && aiRecommendations.fields.length > 0"
          type="info"
          style="margin-bottom: 16px"
        >
          <template #message>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>AI推荐了 {{ aiRecommendations.fields.length }} 个字段</span>
              <a-button 
                type="link" 
                size="small" 
                @click="applyAIRecommendations(aiRecommendations.fields)"
              >
                应用全部推荐
              </a-button>
            </div>
          </template>
          <template #description>
            <div class="ai-recommendations">
              <div 
                v-for="(field, index) in aiRecommendations.fields" 
                :key="index"
                class="recommendation-item"
              >
                <div class="field-info">
                  <strong>{{ field.name }}</strong>
                  <span class="confidence">置信度: {{ (field.confidence * 100).toFixed(0) }}%</span>
                </div>
                <div class="field-selector">{{ field.selector }}</div>
                <a-button 
                  type="link" 
                  size="small" 
                  @click="applyAIRecommendations([field])"
                >
                  应用此字段
                </a-button>
              </div>
            </div>
          </template>
        </a-alert>

        <a-form-item label="字段配置" required>
          <div class="fields-config">
            <div v-for="(field, index) in formState.fields" :key="index" class="field-item">
              <a-input 
                v-model:value="field.name" 
                placeholder="字段名" 
                style="width: 150px"
              />
              <a-input 
                v-model:value="field.selector" 
                placeholder="选择器（如：a 或 a::attr(href)）" 
                style="width: 400px; margin-left: 8px"
              />
              <a-button 
                type="text" 
                danger 
                @click="removeField(index)"
                style="margin-left: 8px"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" block @click="addField" style="margin-top: 8px">
              <template #icon><PlusOutlined /></template>
              添加字段
            </a-button>
          </div>
        </a-form-item>

        <a-divider>分页配置</a-divider>

        <a-form-item label="启用分页">
          <a-switch v-model:checked="formState.paginationEnabled" />
        </a-form-item>

        <template v-if="formState.paginationEnabled">
          <a-form-item label="下一页选择器">
            <a-input 
              v-model:value="formState.paginationNextSelector" 
              placeholder="留空则自动检测"
            />
            <div class="help-text">
              例如：a.next 或 .pagination .next
            </div>
          </a-form-item>

          <a-form-item label="最大页数">
            <a-input-number 
              v-model:value="formState.paginationMaxPages" 
              :min="1" 
              :max="100"
              style="width: 150px"
            />
            <span style="margin-left: 8px; color: #999">默认 50 页</span>
          </a-form-item>
        </template>
      </a-form>
    </a-modal>

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
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  SearchOutlined, 
  PlusOutlined, 
  DeleteOutlined 
} from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'
import dayjs from 'dayjs'

const loading = ref(false)
const templates = ref<any[]>([])
const searchKeyword = ref('')
const modalVisible = ref(false)
const editingTemplate = ref<any>(null)
const saving = ref(false)
const testVisible = ref(false)
const testLoading = ref(false)
const testResult = ref<any>(null)
const testColumns = ref<any[]>([])
const aiAnalyzing = ref(false)
const aiRecommendations = ref<any>(null)

const formState = ref({
  name: '',
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
})

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
  modalVisible.value = true
}

function handleEdit(record: any) {
  editingTemplate.value = record
  formState.value = {
    name: record.name,
    department: record.department || '',
    dataType: record.data_type || '',
    url: record.url,
    containerSelector: record.container_selector,
    fields: record.fields || [],
    paginationEnabled: record.pagination_enabled || false,
    paginationNextSelector: record.pagination_next_selector || '',
    paginationMaxPages: record.pagination_max_pages || 50
  }
  modalVisible.value = true
}

async function handleSave() {
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
    const data = {
      name: formState.value.name,
      department: formState.value.department,
      dataType: formState.value.dataType,
      url: formState.value.url,
      containerSelector: formState.value.containerSelector,
      fields: formState.value.fields,
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

    modalVisible.value = false
    fetchTemplates()
  } catch (error) {
    message.error('保存失败')
  } finally {
    saving.value = false
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
    const res = await aiApi.testCrawlerTemplate(record.id)
    testResult.value = res

    if (res.success && res.data && res.data.length > 0) {
      // 动态生成列
      const fields = Object.keys(res.data[0])
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

function addField() {
  formState.value.fields.push({ name: '', selector: '' })
}

function removeField(index: number) {
  formState.value.fields.splice(index, 1)
}

function formatDate(date: any) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function handleAIAnalysis() {
  if (!formState.value.url) {
    message.error('请先输入目标URL')
    return
  }

  aiAnalyzing.value = true
  try {
    const res = await aiApi.analyzeWebpage(
      formState.value.url, 
      formState.value.dataType || '提取页面主要内容'
    )
    
    if (res.success && res.data) {
      aiRecommendations.value = res.data
      
      // 显示AI推荐面板
      message.success('AI分析完成！请查看推荐字段')
      
      // 可选：自动应用推荐
      if (res.data.fields && res.data.fields.length > 0) {
        const shouldApply = await new Promise((resolve) => {
          const modal = message.info({
            content: `AI分析到 ${res.data.fields.length} 个推荐字段，是否应用到表单？`,
            duration: 5,
            onClose: () => resolve(false)
          })
          
          // 添加确认按钮
          setTimeout(() => {
            modal.then(() => {
              applyAIRecommendations(res.data.fields)
            })
          }, 100)
        })
      }
    } else {
      message.error('AI分析失败，请稍后重试')
    }
  } catch (error: any) {
    message.error(`AI分析失败: ${error.message || '未知错误'}`)
  } finally {
    aiAnalyzing.value = false
  }
}

function applyAIRecommendations(fields: any[]) {
  if (!fields || fields.length === 0) {
    message.warning('没有可应用的推荐字段')
    return
  }

  // 应用推荐字段到表单
  formState.value.fields = fields.map((field: any) => ({
    name: field.name,
    selector: field.selector
  }))

  // 如果有容器选择器推荐，也应用
  if (aiRecommendations.value?.containerSelector) {
    formState.value.containerSelector = aiRecommendations.value.containerSelector
  }

  message.success(`已应用 ${fields.length} 个推荐字段`)
}
</script>

<style scoped>
.crawler-template-config {
  padding: 0;
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
}

.url-link {
  color: #1890ff;
  text-decoration: none;
}

.url-link:hover {
  text-decoration: underline;
}

.fields-config {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.field-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.field-item:last-child {
  margin-bottom: 0;
}

.help-text {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.loading-box {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
}

.ai-recommendations {
  margin-top: 8px;
}

.recommendation-item {
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recommendation-item:last-child {
  margin-bottom: 0;
}

.field-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.confidence {
  font-size: 12px;
  color: #52c41a;
  font-weight: 500;
}

.field-selector {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #666;
  margin: 0 12px;
}
</style>
