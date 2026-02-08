<template>
  <div class="crawler-management">
    <div class="page-header">
      <h1>爬虫管理</h1>
      <p class="subtitle">管理网页抓取模板、定时任务及历史采集数据</p>
    </div>

    <a-card :bordered="false" class="main-card">
      <div class="filter-bar">
        <a-space>
          <a-input v-model:value="filterForm.department" placeholder="按部门筛选" allow-clear style="width: 180px" />
          <a-input v-model:value="filterForm.dataType" placeholder="按数据类型筛选" allow-clear style="width: 180px" />
          <a-button @click="resetFilters">重置</a-button>
        </a-space>
      </div>

      <a-tabs v-model:activeKey="activeTab">
        <!-- 采集模板 -->
        <a-tab-pane key="templates" tab="采集模板">
          <a-table :columns="templateColumns" :data-source="filteredTemplates" :loading="loading" row-key="id">
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
          <a-table :columns="resultColumns" :data-source="filteredResults" :loading="loading" row-key="id">
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
        <div class="modal-footer-content">
          <div class="selection-info">
            <a-checkbox v-model:checked="isSelectAllAll" @change="handleSelectAllAll">全选所有记录 (跨分页)</a-checkbox>
            <span v-if="selectedRowKeys.length > 0" class="selection-text">
              已选中 {{ isSelectAllAll ? detailData.length : selectedRowKeys.length }} 条记录
            </span>
          </div>
          <a-space>
            <a-button @click="detailVisible = false">关闭</a-button>
            <a-button type="primary" :disabled="selectedRowKeys.length === 0 && !isSelectAllAll" @click="handleExportExcel">
              <template #icon><DownloadOutlined /></template>
              导出 ({{ isSelectAllAll ? detailData.length : selectedRowKeys.length }})
            </a-button>
          </a-space>
        </div>
      </template>
      <div v-if="detailLoading" class="loading-box">
        <a-spin tips="加载中..." />
      </div>
      <div v-else class="detail-container">
        <a-table 
          :columns="dynamicColumns" 
          :data-source="detailData" 
          :pagination="detailPagination" 
          row-key="id" 
          bordered 
          size="small"
          :row-selection="rowSelection"
        >
          <template #bodyCell="{ text, column, index }">
            <template v-if="column.key === 'index'">
              {{ (detailPagination.current - 1) * detailPagination.pageSize + index + 1 }}
            </template>
            <template v-else-if="isLink(text)">
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
import { ref, onMounted, watch, computed } from 'vue'
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

// 筛选相关
const filterForm = ref({
  department: '',
  dataType: ''
})

const filteredTemplates = computed(() => {
  return templates.value.filter(item => {
    const matchDept = !filterForm.value.department || (item.department && item.department.toLowerCase().includes(filterForm.value.department.toLowerCase()))
    const matchType = !filterForm.value.dataType || (item.data_type && item.data_type.toLowerCase().includes(filterForm.value.dataType.toLowerCase()))
    return matchDept && matchType
  })
})

const filteredResults = computed(() => {
  const filtered = results.value.filter(item => {
    const matchDept = !filterForm.value.department || (item.department && item.department.toLowerCase().includes(filterForm.value.department.toLowerCase()))
    const matchType = !filterForm.value.dataType || (item.data_type && item.data_type.toLowerCase().includes(filterForm.value.dataType.toLowerCase()))
    return matchDept && matchType
  })
  
  // 按创建时间倒序排序
  return filtered.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    return timeB - timeA  // 倒序
  })
})

function resetFilters() {
  filterForm.value.department = ''
  filterForm.value.dataType = ''
}

// 详情相关
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<any[]>([])
const dynamicColumns = ref<any[]>([])
const currentResult = ref<any>(null)
const selectedRowKeys = ref<any[]>([])
const isSelectAllAll = ref(false)
const detailPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    detailPagination.value.current = page
    detailPagination.value.pageSize = pageSize
  }
})
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: any[]) => {
    selectedRowKeys.value = keys
    if (keys.length < detailData.value.length) {
      isSelectAllAll.value = false
    } else if (keys.length === detailData.value.length) {
      isSelectAllAll.value = true
    }
  }
}))

const templateColumns = [
  { title: '归属部门', dataIndex: 'department', key: 'department' },
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
  { title: '归属部门', dataIndex: 'department', key: 'department' },
  { title: '数据类型', dataIndex: 'data_type', key: 'data_type' },
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
  isSelectAllAll.value = false
  
  // 重置分页
  detailPagination.value.current = 1
  
  try {
    const res = await aiApi.getCrawlerResultDetails(record.id)
    if (res.data && res.data.length > 0) {
      // 排序数据 (按日期倒序)
      const dateKey = Object.keys(res.data[0]).find(k => ['发布日期', 'date', 'publish_date', 'time'].includes(k))
      if (dateKey) {
        res.data.sort((a, b) => {
          const dateA = new Date(a[dateKey]).getTime()
          const dateB = new Date(b[dateKey]).getTime()
          return isNaN(dateA) || isNaN(dateB) ? 0 : dateB - dateA
        })
      }

      // 注入归属部门和数据类型
      detailData.value = res.data.map(row => ({
        ...row,
        _department: row['归属部门'] || row['department'] || record.department || '-',
        _dataType: row['数据类型'] || row['data_type'] || record.data_type || '-'
      }))
      
      // 更新分页总数
      detailPagination.value.total = res.data.length
      
      // 自定义列顺序：序号 -> 标题 -> 发布日期 -> 链接 -> 数据类型 -> 归属部门 -> 其他
      const allKeys = Object.keys(res.data[0]).filter(k => 
         !['id', 'created_at', '归属部门', 'department', '数据类型', 'data_type'].includes(k)
      )

      const titleKey = allKeys.find(k => ['标题', 'title'].includes(k))
      const publishDateKey = allKeys.find(k => ['发布日期', 'date', 'publish_date'].includes(k))
      const linkKey = allKeys.find(k => ['链接', 'link', 'url'].includes(k))
      
      const specificKeys = [titleKey, publishDateKey, linkKey].filter(Boolean) as string[]
      const otherKeys = allKeys.filter(k => !specificKeys.includes(k))

      const cols: any[] = [
        { 
          title: '序号', 
          key: 'index', 
          width: 80, 
          fixed: 'left',
          customRender: ({ index }: any) => {
            const pagination = detailPagination.value
            return (pagination.current - 1) * pagination.pageSize + index + 1
          }
        }
      ]

      if (titleKey) cols.push({ title: titleKey, dataIndex: titleKey, key: titleKey, minWidth: 300, ellipsis: true })
      if (publishDateKey) cols.push({ title: publishDateKey, dataIndex: publishDateKey, key: publishDateKey, width: 150 })
      if (linkKey) cols.push({ title: linkKey, dataIndex: linkKey, key: linkKey, width: 300, ellipsis: true })
      
      cols.push({ title: '数据类型', dataIndex: '_dataType', key: '_dataType', width: 120 })
      cols.push({ title: '归属部门', dataIndex: '_department', key: '_department', width: 150 })
      
      otherKeys.forEach(k => {
        cols.push({ title: k, dataIndex: k, key: k, minWidth: 150 })
      })

      dynamicColumns.value = cols
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

function handleSelectAllAll() {
  if (isSelectAllAll.value) {
    selectedRowKeys.value = detailData.value.map(item => item.id)
  } else {
    selectedRowKeys.value = []
  }
}

function handleRunManual(template: any) {
  message.info('正在启动手动采集任务...')
  // 通过 API 执行技能
  // 通过 API 执行技能
  post('/skills/crawler.extract/execute', {
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
  if (selectedRowKeys.value.length === 0 && !isSelectAllAll.value) return

  const dataToExport = isSelectAllAll.value 
    ? detailData.value 
    : detailData.value.filter(row => selectedRowKeys.value.includes(row.id))
  
  // 移除无关字段，保留部门
  const cleanedData = dataToExport.map(row => {
    const { id, created_at, ...rest } = row
    // 将 _department 映射回“归属部门”
    const { _department, ...fields } = rest
    return {
      '归属部门': _department,
      ...fields
    }
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

.filter-bar {
  margin-bottom: 16px;
  padding: 0 4px;
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
.modal-footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-text {
  color: #6b7280;
  font-size: 13px;
}
</style>
