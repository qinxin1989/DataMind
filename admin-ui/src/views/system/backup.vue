<template>
  <div class="system-backup">
    <div class="page-header">
      <h1>备份恢复</h1>
    </div>

    <a-row :gutter="24">
      <a-col :span="12">
        <a-card title="创建备份">
          <p>创建当前系统数据的完整备份，包括用户、角色、配置等数据。</p>
          <a-button type="primary" @click="handleCreateBackup" :loading="creating">
            <template #icon><CloudUploadOutlined /></template>
            创建备份
          </a-button>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="恢复说明">
          <a-alert
            message="注意事项"
            description="恢复备份将覆盖当前所有数据，此操作不可逆。请确保在恢复前已做好当前数据的备份。"
            type="warning"
            show-icon
          />
        </a-card>
      </a-col>
    </a-row>

    <a-card title="备份列表" class="backup-list">
      <a-table :columns="columns" :data-source="backups" :loading="loading" row-key="filename">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'size'">
            {{ formatBytes(record.size) }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="handleDownload(record)">
                下载
              </a-button>
              <a-popconfirm
                title="确定要恢复此备份吗？当前数据将被覆盖！"
                @confirm="handleRestore(record)"
              >
                <a-button type="link" size="small" danger>恢复</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined } from '@ant-design/icons-vue'
import { systemApi } from '@/api/system'

interface BackupItem {
  filename: string
  size: number
  createdAt: number
}

const loading = ref(false)
const creating = ref(false)
const backups = ref<BackupItem[]>([])

const columns = [
  { title: '文件名', dataIndex: 'filename', key: 'filename' },
  { title: '大小', key: 'size' },
  { title: '创建时间', key: 'createdAt' },
  { title: '操作', key: 'action', width: 150 },
]

onMounted(() => {
  fetchBackups()
})

async function fetchBackups() {
  loading.value = true
  try {
    const res = await systemApi.getBackups()
    if (res.success && res.data) {
      backups.value = res.data
    }
  } catch (error) {
    // 使用模拟数据
    backups.value = [
      { filename: 'backup-2026-01-13-120000.zip', size: 1048576, createdAt: Date.now() - 86400000 },
      { filename: 'backup-2026-01-12-120000.zip', size: 1024000, createdAt: Date.now() - 172800000 },
    ]
  } finally {
    loading.value = false
  }
}

async function handleCreateBackup() {
  creating.value = true
  try {
    const res = await systemApi.createBackup()
    if (res.success && res.data) {
      message.success(`备份创建成功: ${res.data.filename}`)
      fetchBackups()
    }
  } catch (error) {
    message.error('备份创建失败')
  } finally {
    creating.value = false
  }
}

async function handleRestore(record: BackupItem) {
  try {
    await systemApi.restoreBackup(record.filename)
    message.success('恢复成功，请刷新页面')
  } catch (error) {
    message.error('恢复失败')
  }
}

function handleDownload(record: BackupItem) {
  // 实际项目中应该调用下载API
  message.info(`下载: ${record.filename}`)
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
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

.backup-list {
  margin-top: 24px;
}
</style>
