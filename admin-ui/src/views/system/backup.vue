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
                <a-button type="link" size="small" style="color: #ff4d4f">恢复</a-button>
              </a-popconfirm>
              <a-popconfirm
                title="确定要删除此备份吗？此操作不可逆！"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
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
  id: string
  name: string
  backupSize: number
  createdAt: string
}

const loading = ref(false)
const creating = ref(false)
const backups = ref<BackupItem[]>([])

const columns = [
  { title: '文件名', dataIndex: 'name', key: 'name' },
  { title: '大小', key: 'backupSize' },
  { title: '创建时间', key: 'createdAt' },
  { title: '操作', key: 'action', width: 150 },
]

onMounted(() => {
  console.log('Backup component mounted v2')
  fetchBackups()
})

async function fetchBackups() {
  loading.value = true
  try {
    const res = await systemApi.getBackups()
    if (res.success && res.data) {
      // 后端返回分页结构 { items: [], total: ... }
      backups.value = res.data.items || []
    }
  } catch (error) {
    // 使用模拟数据 (Updated to match new structure)
    backups.value = []
  } finally {
    loading.value = false
  }
}

async function handleCreateBackup() {
  creating.value = true
  try {
    const res = await systemApi.createBackup()
    if (res.success && res.data) {
      message.success(`备份创建成功: ${res.data.name}`)
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
    await systemApi.restoreBackup(record.id)
    message.success('恢复成功，请刷新页面')
  } catch (error) {
    message.error('恢复失败')
  }
}

async function handleDelete(record: BackupItem) {
  try {
    await systemApi.deleteBackup(record.id)
    message.success('删除成功')
    fetchBackups()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleDownload(record: BackupItem) {
  try {
    const blob = await systemApi.downloadBackup(record.id);
    // 创建临时链接
    const url = window.URL.createObjectURL(new Blob([blob as any]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', record.name); // 使用记录中的文件名
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download error:', error);
    message.error('下载失败');
  }
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(timestamp: string | number) {
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
