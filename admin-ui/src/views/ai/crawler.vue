<template>
  <div class="crawler-management">
    <div class="page-header">
      <h1>爬虫管理</h1>
      <p class="subtitle">管理网页抓取模板、定时任务及历史采集数据</p>
    </div>

    <a-card :bordered="false" class="main-card">
      <a-tabs v-model:activeKey="activeTab">
        <!-- 采集模板 -->
        <a-tab-pane key="templates" tab="采集模板">
          <a-table :columns="templateColumns" :data-source="templates" :loading="loading" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'url'">
                <a :href="record.url" target="_blank" class="url-link">{{ record.url }}</a>
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatDate(record.created_at) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space>
                  <a-button type="link" size="small" @click="handleRunManual(record)">立即抓取</a-button>
                  <a-button type="link" size="small" @click="handleDeleteTemplate(record.id)" danger>删除</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 定时任务 -->
        <a-tab-pane key="tasks" tab="定时任务">
          <a-table :columns="taskColumns" :data-source="tasks" :loading="loading" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'frequency'">
                <a-tag color="blue">{{ translateFrequency(record.frequency) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-switch 
                  :checked="record.status === 'active'" 
                  @change="(val: any) => handleToggleTask(record, val)" 
                  checked-children="运行中" 
                  un-checked-children="已暂停" 
                />
              </template>
              <template v-else-if="column.key === 'nextRunAt'">
                {{ record.next_run_at ? formatDate(record.next_run_at) : '-' }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button type="link" size="small" @click="handleRunTask(record)">手动执行</a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 采集结果 -->
        <a-tab-pane key="results" tab="采集记录">
          <a-table :columns="resultColumns" :data-source="results" :loading="loading" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'createdAt'">
                {{ formatDate(record.created_at) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space>
                  <a-button type="primary" size="small" class="tech-btn" @click="handleViewDetails(record)">查看明细</a-button>
                  <a-button type="link" size="small" @click="handleDeleteResult(record.id)" danger>删除</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal v-model:open="detailVisible" :title="`采集明细 - ${currentResult?.template_name || ''}`" width="1000px">
      <template #footer>
        <a-space>
          <a-button @click="detailVisible = false">关闭</a-button>
          <a-button type="primary" :disabled="selectedRowKeys.length === 0" @click="handleExportExcel">
            <template #icon><DownloadOutlined /></template>
            导出选中 ({{ selectedRowKeys.length }})
          </a-button>
        </a-space>
      </template>
      <div v-if="detailLoading" class="loading-box">
        <a-spin tips="加载中..." />
      </div>
      <div v-else class="detail-container">
        <a-table 
          :columns="dynamicColumns" 
          :data-source="detailData" 
          :pagination="{ pageSize: 10 }" 
          row-key="id" 
          bordered 
          size="small"
          :row-selection="rowSelection"
        >
          <template #bodyCell="{ text }">
            <template v-if="isLink(text)">
              <a :href="text" target="_blank" class="detail-link">{{ text }}</a>
            </template>
            <template v-else-if="isHtml(text)">
              <div v-html="text" class="html-content"></div>
            </template>
            <template v-else>
              <div class="text-content">{{ text }}</div>
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DownloadOutlined } from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const activeTab = ref('templates')
const loading = ref(false)
const templates = ref<any[]>([])
const tasks = ref<any[]>([])
const results = ref<any[]>([])

// 详情相关
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<any[]>([])
const dynamicColumns = ref<any[]>([])
const currentResult = ref<any>(null)
const selectedRowKeys = ref<string[]>([])
const rowSelection = ref({
  selectedRowKeys: selectedRowKeys,
  onChange: (keys: any[]) => {
    selectedRowKeys.value = keys
  }
})

const templateColumns = [
  { title: '模板名称', dataIndex: 'name', key: 'name' },
  { title: '数据类型', dataIndex: 'data_type', key: 'data_type' },
  { title: '目标URL', dataIndex: 'url', key: 'url', ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt' },
  { title: '操作', key: 'action', width: 200 }
]

const taskColumns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '所属模板', dataIndex: 'template_name', key: 'template_name' },
  { title: '执行频率', dataIndex: 'frequency', key: 'frequency' },
  { title: '状态', key: 'status' },
  { title: '下次执行', key: 'nextRunAt' },
  { title: '操作', key: 'action' }
]

const resultColumns = [
  { title: '采集批次', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: '所属模板', dataIndex: 'template_name', key: 'template_name' },
  { title: '采集时间', dataIndex: 'created_at', key: 'createdAt' },
  { title: '操作', key: 'action', width: 180 }
]

onMounted(() => {
  loadData()
})

watch(activeTab, () => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    if (activeTab.value === 'templates') {
      const res = await aiApi.getCrawlerTemplates()
      templates.value = res.data || []
    } else if (activeTab.value === 'tasks') {
      const res = await aiApi.getCrawlerTasks()
      tasks.value = res.data || []
    } else if (activeTab.value === 'results') {
      const res = await aiApi.getCrawlerResults()
      results.value = res.data || []
    }
  } catch (error) {
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

async function handleToggleTask(record: any, checked: boolean | string | number) {
  try {
    const status = checked ? 'active' : 'paused'
    await aiApi.toggleCrawlerTask(record.id, status)
    record.status = status
    message.success(`任务已${checked ? '启动' : '暂停'}`)
  } catch (error) {
    message.error('操作失败')
  }
}

async function handleViewDetails(record: any) {
  currentResult.value = record
  detailVisible.value = true
  detailLoading.value = true
  selectedRowKeys.value = [] // 重置选择项
  try {
    const res = await aiApi.getCrawlerResultDetails(record.id)
    if (res.data && res.data.length > 0) {
      detailData.value = res.data
      // 动态生成列表头
      const fields = Object.keys(res.data[0]).filter(k => k !== 'id' && k !== 'created_at')
      dynamicColumns.value = fields.map(f => ({
        title: f,
        dataIndex: f,
        key: f,
        minWidth: 150
      }))
    } else {
      detailData.value = []
      dynamicColumns.value = []
    }
  } catch (error) {
    message.error('获取明细失败')
  } finally {
    detailLoading.value = false
  }
}

function handleRunManual(template: any) {
  message.info('正在启动手动采集任务...')
  // 通过 API 执行技能
  post('/skills/execute', {
    skill: 'crawler.extract',
    params: {
      url: template.url,
      description: `Manual run for: ${template.name}`,
      templateId: template.id
    }
  }).then((res: any) => {
    if (res.success || (res.data && !res.error)) {
      message.success('采集完成！可在"采集记录"中查看结果')
      activeTab.value = 'results'
    } else {
      message.error('采集失败: ' + (res.message || res.error || '未知错误'))
    }
  })
}

function handleRunTask(task: any) {
  handleRunManual({ id: task.template_id, url: task.url, name: task.template_name })
}

async function handleDeleteTemplate(id: string) {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这个爬虫模板吗？删除后将无法恢复。',
    okText: '确定',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await aiApi.deleteCrawlerTemplate(id)
        message.success('删除成功')
        // 刷新模板列表
        await loadData()
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

async function handleDeleteResult(id: string) {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这条采集记录吗？删除后将无法恢复。',
    okText: '确定',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await aiApi.deleteCrawlerResult(id)
        message.success('记录已删除')
        // 刷新结果列表
        await loadData()
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

function handleExportExcel() {
  if (selectedRowKeys.value.length === 0) return

  const dataToExport = detailData.value.filter(row => selectedRowKeys.value.includes(row.id))
  
  // 移除无关字段
  const cleanedData = dataToExport.map(row => {
    const { id, created_at, ...rest } = row
    return rest
  })

  const worksheet = XLSX.utils.json_to_sheet(cleanedData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '采集数据')
  
  const fileName = `crawler_export_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
  XLSX.writeFile(workbook, fileName)
  
  message.success(`成功导出 ${selectedRowKeys.value.length} 条数据`)
}

function formatDate(date: any) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

function translateFrequency(freq: string) {
  const map: Record<string, string> = {
    'minutely': '每分钟',
    'hourly': '每小时',
    'daily': '每天'
  }
  return map[freq] || freq
}

function isHtml(str: any) {
  return typeof str === 'string' && (str.includes('<') || str.includes('>') || str.includes('\n'))
}

function isLink(str: any) {
  return typeof str === 'string' && /^https?:\/\/[^\s]+$/.test(str.trim())
}

// 模拟 post 方法，因为目前 api.ts 里没写统一 execute
async function post(url: string, data: any) {
  const { post: axiosPost } = await import('@/api/request')
  return axiosPost(url, data) as any
}
</script>

<style scoped>
.crawler-management {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
}

.subtitle {
  color: #6b7280;
  margin-top: 4px;
}

.main-card {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 12px;
}

.url-link {
  color: #2563eb;
  font-size: 13px;
}

.loading-box {
  padding: 50px;
  text-align: center;
}

.detail-container {
  max-height: 600px;
  overflow-y: auto;
}

.html-content {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 100px;
  overflow-y: auto;
}

.text-content {
  font-size: 13px;
}

.tech-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
  color: #fff !important;
  font-weight: 500;
}

.tech-btn:hover {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
}

.detail-link {
  color: #2563eb;
  word-break: break-all;
  font-size: 13px;
}

.detail-link:hover {
  text-decoration: underline;
}
</style>
