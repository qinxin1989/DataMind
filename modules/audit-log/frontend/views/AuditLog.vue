<template>
  <div class="audit-log">
    <div class="page-header">
      <h1>审计日志</h1>
    </div>

    <!-- 查询表单 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-form layout="inline" :model="queryForm">
        <a-form-item label="用户ID">
          <a-input v-model:value="queryForm.userId" placeholder="请输入用户ID" style="width: 200px" />
        </a-form-item>
        <a-form-item label="操作">
          <a-input v-model:value="queryForm.action" placeholder="请输入操作" style="width: 200px" />
        </a-form-item>
        <a-form-item label="资源类型">
          <a-select v-model:value="queryForm.resourceType" placeholder="请选择" style="width: 150px" allow-clear>
            <a-select-option value="user">用户</a-select-option>
            <a-select-option value="config">配置</a-select-option>
            <a-select-option value="backup">备份</a-select-option>
            <a-select-option value="module">模块</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="queryForm.status" placeholder="请选择" style="width: 120px" allow-clear>
            <a-select-option value="success">成功</a-select-option>
            <a-select-option value="failed">失败</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="时间范围">
          <a-range-picker
            v-model:value="dateRange"
            :show-time="true"
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 380px"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleQuery">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button @click="handleExport">导出</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic title="总日志数" :value="stats.totalLogs" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic title="成功日志" :value="stats.successLogs" value-style="color: #52c41a" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic title="失败日志" :value="stats.failedLogs" value-style="color: #ff4d4f" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic
            title="成功率"
            :value="stats.totalLogs > 0 ? ((stats.successLogs / stats.totalLogs) * 100).toFixed(1) : 0"
            suffix="%"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 日志列表 -->
    <a-card :bordered="false">
      <a-table
        :columns="columns"
        :data-source="logs"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'success' ? 'success' : 'error'">
              {{ record.status === 'success' ? '成功' : '失败' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="handleViewDetail(record)">
              {{ record.action }}
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情弹窗 -->
    <a-modal
      v-model:open="detailVisible"
      title="日志详情"
      width="800px"
      :footer="null"
    >
      <a-descriptions v-if="currentLog" :column="2" bordered>
        <a-descriptions-item label="日志ID" :span="2">{{ currentLog.id }}</a-descriptions-item>
        <a-descriptions-item label="用户ID">{{ currentLog.userId }}</a-descriptions-item>
        <a-descriptions-item label="用户名">{{ currentLog.username }}</a-descriptions-item>
        <a-descriptions-item label="操作">{{ currentLog.action }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="currentLog.status === 'success' ? 'success' : 'error'">
            {{ currentLog.status === 'success' ? '成功' : '失败' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="资源类型">{{ currentLog.resourceType || '-' }}</a-descriptions-item>
        <a-descriptions-item label="资源ID">{{ currentLog.resourceId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="IP地址">{{ currentLog.ipAddress || '-' }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDate(currentLog.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="详情" :span="2">
          <pre style="margin: 0; white-space: pre-wrap">{{ currentLog.details || '-' }}</pre>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentLog.errorMessage" label="错误信息" :span="2">
          <a-alert type="error" :message="currentLog.errorMessage" />
        </a-descriptions-item>
        <a-descriptions-item label="User Agent" :span="2">
          <div style="word-break: break-all">{{ currentLog.userAgent || '-' }}</div>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { auditLogApi } from '../api'
import type { AuditLog, LogStats } from '../../backend/types'
import type { Dayjs } from 'dayjs'

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const stats = ref<LogStats>({
  totalLogs: 0,
  successLogs: 0,
  failedLogs: 0,
  topActions: [],
  topUsers: [],
  logsByDate: []
})

const queryForm = reactive({
  userId: '',
  action: '',
  resourceType: undefined as string | undefined,
  status: undefined as 'success' | 'failed' | undefined
})

const dateRange = ref<[Dayjs, Dayjs] | null>(null)

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const columns = [
  { title: '操作', key: 'action', dataIndex: 'action', width: 150 },
  { title: '用户名', dataIndex: 'username', width: 120 },
  { title: '资源类型', dataIndex: 'resourceType', width: 120 },
  { title: '资源ID', dataIndex: 'resourceId', width: 150, ellipsis: true },
  { title: 'IP地址', dataIndex: 'ipAddress', width: 140 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 80 },
  { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', width: 180 }
]

const detailVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)

onMounted(() => {
  fetchLogs()
  fetchStats()
})

async function fetchLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      pageSize: pagination.pageSize
    }

    if (queryForm.userId) params.userId = queryForm.userId
    if (queryForm.action) params.action = queryForm.action
    if (queryForm.resourceType) params.resourceType = queryForm.resourceType
    if (queryForm.status) params.status = queryForm.status
    if (dateRange.value) {
      params.startDate = dateRange.value[0].valueOf()
      params.endDate = dateRange.value[1].valueOf()
    }

    const res = await auditLogApi.getLogs(params)
    if (res.success && res.data) {
      logs.value = res.data.items
      pagination.total = res.data.total
    }
  } catch (error: any) {
    message.error(error.message || '获取日志失败')
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  try {
    const params: any = {}
    if (dateRange.value) {
      params.startDate = dateRange.value[0].valueOf()
      params.endDate = dateRange.value[1].valueOf()
    }

    const res = await auditLogApi.getStats(params)
    if (res.success && res.data) {
      stats.value = res.data
    }
  } catch (error) {
    console.error('获取统计失败:', error)
  }
}

function handleQuery() {
  pagination.current = 1
  fetchLogs()
  fetchStats()
}

function handleReset() {
  queryForm.userId = ''
  queryForm.action = ''
  queryForm.resourceType = undefined
  queryForm.status = undefined
  dateRange.value = null
  pagination.current = 1
  fetchLogs()
  fetchStats()
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchLogs()
}

function handleViewDetail(log: AuditLog) {
  currentLog.value = log
  detailVisible.value = true
}

async function handleExport() {
  try {
    const params: any = {
      format: 'csv'
    }

    if (queryForm.userId) params.userId = queryForm.userId
    if (queryForm.action) params.action = queryForm.action
    if (dateRange.value) {
      params.startDate = dateRange.value[0].valueOf()
      params.endDate = dateRange.value[1].valueOf()
    }

    await auditLogApi.exportLogs(params)
    message.success('导出成功')
  } catch (error: any) {
    message.error(error.message || '导出失败')
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
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
</style>
