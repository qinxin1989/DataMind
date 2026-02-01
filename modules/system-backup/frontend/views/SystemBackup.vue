<template>
  <div class="system-backup">
    <div class="page-header">
      <h1>备份恢复</h1>
    </div>

    <!-- 操作卡片 -->
    <a-row :gutter="24" style="margin-bottom: 24px">
      <a-col :span="12">
        <a-card title="创建备份" :bordered="false">
          <p>创建当前系统数据的完整备份，包括用户、角色、配置等数据。</p>
          <a-form layout="vertical" style="margin-top: 16px">
            <a-form-item label="备份名称">
              <a-input v-model:value="backupForm.name" placeholder="请输入备份名称" />
            </a-form-item>
            <a-form-item label="备份描述">
              <a-textarea
                v-model:value="backupForm.description"
                placeholder="请输入备份描述（可选）"
                :rows="3"
              />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="handleCreateBackup" :loading="creating">
                <template #icon><CloudUploadOutlined /></template>
                创建备份
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="恢复说明" :bordered="false">
          <a-alert
            message="注意事项"
            description="恢复备份将覆盖当前所有数据，此操作不可逆。请确保在恢复前已做好当前数据的备份。"
            type="warning"
            show-icon
            style="margin-bottom: 16px"
          />
          <a-alert
            message="备份内容"
            description="备份包含：用户数据、角色权限、系统配置、菜单配置、AI配置等核心数据。"
            type="info"
            show-icon
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 备份列表 -->
    <a-card title="备份列表" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="backups"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'backupSize'">
            {{ formatBytes(record.backupSize) }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="handleVerify(record)">
                验证
              </a-button>
              <a-button type="link" size="small" @click="handleDownload(record)">
                下载
              </a-button>
              <a-popconfirm
                title="确定要恢复此备份吗？当前数据将被覆盖！"
                @confirm="handleRestore(record)"
              >
                <a-button type="link" size="small" :disabled="record.status !== 'completed'">
                  恢复
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                title="确定要删除此备份吗？"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 验证结果弹窗 -->
    <a-modal
      v-model:open="verifyVisible"
      title="备份验证结果"
      :footer="null"
      width="600px"
    >
      <a-result
        v-if="verifyResult"
        :status="verifyResult.valid ? 'success' : 'error'"
        :title="verifyResult.message"
      >
        <template #extra>
          <a-list
            v-if="verifyResult.errors.length > 0"
            size="small"
            :data-source="verifyResult.errors"
            bordered
          >
            <template #renderItem="{ item }">
              <a-list-item>{{ item }}</a-list-item>
            </template>
          </a-list>
        </template>
      </a-result>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined } from '@ant-design/icons-vue'
import { systemBackupApi } from '../api'
import type { SystemBackup, VerifyResult } from '../../backend/types'

const loading = ref(false)
const creating = ref(false)
const backups = ref<SystemBackup[]>([])

const backupForm = reactive({
  name: '',
  description: ''
})

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const columns = [
  { title: '备份名称', dataIndex: 'name', width: 200 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '文件数', dataIndex: 'fileCount', width: 100 },
  { title: '大小', key: 'backupSize', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 240, fixed: 'right' }
]

const verifyVisible = ref(false)
const verifyResult = ref<VerifyResult | null>(null)

onMounted(() => {
  fetchBackups()
})

async function fetchBackups() {
  loading.value = true
  try {
    const res = await systemBackupApi.getBackups({
      page: pagination.current,
      pageSize: pagination.pageSize
    })
    if (res.success && res.data) {
      backups.value = res.data.items
      pagination.total = res.data.total
    }
  } catch (error: any) {
    message.error(error.message || '获取备份列表失败')
  } finally {
    loading.value = false
  }
}

async function handleCreateBackup() {
  if (!backupForm.name) {
    message.warning('请输入备份名称')
    return
  }

  creating.value = true
  try {
    const res = await systemBackupApi.createBackup({
      name: backupForm.name,
      description: backupForm.description,
      createdBy: 'current-user' // 实际应该从用户上下文获取
    })
    if (res.success) {
      message.success('备份创建成功')
      backupForm.name = ''
      backupForm.description = ''
      fetchBackups()
    }
  } catch (error: any) {
    message.error(error.message || '备份创建失败')
  } finally {
    creating.value = false
  }
}

async function handleRestore(record: SystemBackup) {
  try {
    const res = await systemBackupApi.restoreBackup(record.id)
    if (res.success && res.data) {
      if (res.data.success) {
        message.success(res.data.message)
      } else {
        message.error(res.data.message)
      }
    }
  } catch (error: any) {
    message.error(error.message || '恢复失败')
  }
}

async function handleVerify(record: SystemBackup) {
  try {
    const res = await systemBackupApi.verifyBackup(record.id)
    if (res.success && res.data) {
      verifyResult.value = res.data
      verifyVisible.value = true
    }
  } catch (error: any) {
    message.error(error.message || '验证失败')
  }
}

async function handleDownload(record: SystemBackup) {
  try {
    await systemBackupApi.downloadBackup(record.id)
    message.success('下载成功')
  } catch (error: any) {
    message.error(error.message || '下载失败')
  }
}

async function handleDelete(record: SystemBackup) {
  try {
    const res = await systemBackupApi.deleteBackup(record.id)
    if (res.success) {
      message.success('删除成功')
      fetchBackups()
    }
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchBackups()
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'processing',
    completed: 'success',
    failed: 'error'
  }
  return colors[status] || 'default'
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: '进行中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}
</script>

<style scoped>
.system-backup {
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
