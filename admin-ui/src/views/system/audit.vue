<template>
  <div class="audit-log">
    <div class="page-header">
      <h1>审计日志</h1>
    </div>

    <!-- 搜索表单 -->
    <div class="search-form">
      <a-form layout="inline" :model="searchForm">
        <a-form-item label="操作类型">
          <a-select v-model:value="searchForm.action" placeholder="全部" allow-clear style="width: 150px">
            <a-select-option value="login">登录</a-select-option>
            <a-select-option value="logout">登出</a-select-option>
            <a-select-option value="create">创建</a-select-option>
            <a-select-option value="update">更新</a-select-option>
            <a-select-option value="delete">删除</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="时间范围">
          <a-range-picker v-model:value="searchForm.dateRange" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch"><SearchOutlined /> 搜索</a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button @click="handleExport"><ExportOutlined /> 导出</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </div>

    <a-table
      :columns="columns"
      :data-source="logs"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-tag :color="getActionColor(record.action)">{{ getActionText(record.action) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'timestamp'">
          {{ formatDate(record.timestamp) }}
        </template>
        <template v-else-if="column.key === 'detail'">
          <a-button type="link" size="small" @click="handleViewDetail(record)">
            查看详情
          </a-button>
        </template>
      </template>
    </a-table>

    <!-- 详情弹窗 -->
    <a-modal v-model:open="detailVisible" title="日志详情" :footer="null" width="600px">
      <a-descriptions :column="2" bordered v-if="currentLog">
        <a-descriptions-item label="用户">{{ currentLog.username }}</a-descriptions-item>
        <a-descriptions-item label="操作">{{ getActionText(currentLog.action) }}</a-descriptions-item>
        <a-descriptions-item label="资源类型">{{ currentLog.resourceType }}</a-descriptions-item>
        <a-descriptions-item label="资源ID">{{ currentLog.resourceId }}</a-descriptions-item>
        <a-descriptions-item label="IP地址">{{ currentLog.ip }}</a-descriptions-item>
        <a-descriptions-item label="时间">{{ formatDate(currentLog.timestamp) }}</a-descriptions-item>
        <a-descriptions-item label="User Agent" :span="2">{{ currentLog.userAgent }}</a-descriptions-item>
        <a-descriptions-item v-if="currentLog.oldValue" label="原值" :span="2">
          <pre class="json-content">{{ formatJson(currentLog.oldValue) }}</pre>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentLog.newValue" label="新值" :span="2">
          <pre class="json-content">{{ formatJson(currentLog.newValue) }}</pre>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined, ExportOutlined } from '@ant-design/icons-vue'
import { systemApi } from '@/api/system'
import type { AuditLog } from '@/types'
import type { Dayjs } from 'dayjs'

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const detailVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)

const searchForm = reactive({
  action: undefined as string | undefined,
  dateRange: undefined as [Dayjs, Dayjs] | undefined,
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const columns = [
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '操作', key: 'action' },
  { title: '资源类型', dataIndex: 'resourceType', key: 'resourceType' },
  { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
  { title: '时间', key: 'timestamp' },
  { title: '详情', key: 'detail', width: 100 },
]

onMounted(() => {
  fetchLogs()
})

async function fetchLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      action: searchForm.action,
    }
    if (searchForm.dateRange) {
      params.startTime = searchForm.dateRange[0].valueOf()
      params.endTime = searchForm.dateRange[1].valueOf()
    }
    
    const res = await systemApi.getAuditLogs(params)
    if (res.success && res.data) {
      logs.value = res.data.list
      pagination.total = res.data.total
    }
  } catch (error) {
    // 使用模拟数据
    logs.value = [
      { id: '1', userId: '1', username: 'admin', action: 'login', resourceType: 'session', resourceId: 'sess1', ip: '192.168.1.1', userAgent: 'Mozilla/5.0', timestamp: Date.now() - 3600000, sessionId: 'sess1' },
      { id: '2', userId: '1', username: 'admin', action: 'update', resourceType: 'user', resourceId: 'user2', oldValue: '{"status":"active"}', newValue: '{"status":"inactive"}', ip: '192.168.1.1', userAgent: 'Mozilla/5.0', timestamp: Date.now() - 7200000, sessionId: 'sess1' },
      { id: '3', userId: '2', username: 'user1', action: 'create', resourceType: 'datasource', resourceId: 'ds1', ip: '192.168.1.2', userAgent: 'Mozilla/5.0', timestamp: Date.now() - 10800000, sessionId: 'sess2' },
    ]
    pagination.total = 3
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.current = 1
  fetchLogs()
}

function handleReset() {
  searchForm.action = undefined
  searchForm.dateRange = undefined
  handleSearch()
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchLogs()
}

function handleViewDetail(record: AuditLog) {
  currentLog.value = record
  detailVisible.value = true
}

async function handleExport() {
  try {
    const params: any = { format: 'csv' as const }
    if (searchForm.dateRange) {
      params.startTime = searchForm.dateRange[0].valueOf()
      params.endTime = searchForm.dateRange[1].valueOf()
    }
    
    await systemApi.exportAuditLogs(params)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}

function getActionColor(action: string) {
  const colors: Record<string, string> = {
    login: 'green',
    logout: 'blue',
    create: 'cyan',
    update: 'orange',
    delete: 'red',
  }
  return colors[action] || 'default'
}

function getActionText(action: string) {
  const texts: Record<string, string> = {
    login: '登录',
    logout: '登出',
    create: '创建',
    read: '查看',
    update: '更新',
    delete: '删除',
    export: '导出',
    import: '导入',
  }
  return texts[action] || action
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function formatJson(str: string) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
</script>

<style scoped>
.audit-log {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.search-form {
  background: #fafafa;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.json-content {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0;
  font-size: 12px;
}
</style>
