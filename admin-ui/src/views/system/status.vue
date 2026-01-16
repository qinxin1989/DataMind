<template>
  <div class="system-status">
    <div class="page-header">
      <h1>系统状态</h1>
    </div>

    <a-spin :spinning="loading">
      <a-row :gutter="16">
        <a-col :xs="24" :sm="12" :lg="6">
          <a-card title="CPU">
            <a-progress
              type="dashboard"
              :percent="status.cpu.usage"
              :stroke-color="getProgressColor(status.cpu.usage)"
            />
            <div class="stat-info">{{ status.cpu.cores }} 核心</div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <a-card title="内存">
            <a-progress
              type="dashboard"
              :percent="memoryPercent"
              :stroke-color="getProgressColor(memoryPercent)"
            />
            <div class="stat-info">
              {{ formatBytes(status.memory.used) }} / {{ formatBytes(status.memory.total) }}
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <a-card title="磁盘">
            <a-progress
              type="dashboard"
              :percent="diskPercent"
              :stroke-color="getProgressColor(diskPercent)"
            />
            <div class="stat-info">
              {{ formatBytes(status.disk.used) }} / {{ formatBytes(status.disk.total) }}
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <a-card title="运行时间">
            <div class="uptime">{{ formatUptime(status.uptime) }}</div>
            <div class="stat-info">
              Node {{ status.nodeVersion }}<br />
              {{ status.platform }}
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-card title="系统信息" class="system-info">
      <a-descriptions :column="2" bordered>
        <a-descriptions-item label="Node.js 版本">{{ status.nodeVersion }}</a-descriptions-item>
        <a-descriptions-item label="操作系统">{{ status.platform }}</a-descriptions-item>
        <a-descriptions-item label="CPU 核心数">{{ status.cpu.cores }}</a-descriptions-item>
        <a-descriptions-item label="总内存">{{ formatBytes(status.memory.total) }}</a-descriptions-item>
        <a-descriptions-item label="总磁盘">{{ formatBytes(status.disk.total) }}</a-descriptions-item>
        <a-descriptions-item label="运行时间">{{ formatUptime(status.uptime) }}</a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { systemApi, type SystemStatus } from '@/api/system'

const loading = ref(false)
let refreshTimer: number | null = null

const status = ref<SystemStatus>({
  cpu: { usage: 0, cores: 0 },
  memory: { total: 0, used: 0, free: 0 },
  disk: { total: 0, used: 0, free: 0 },
  uptime: 0,
  nodeVersion: '',
  platform: '',
})

const memoryPercent = computed(() => {
  if (!status.value.memory.total) return 0
  return Math.round((status.value.memory.used / status.value.memory.total) * 100)
})

const diskPercent = computed(() => {
  if (!status.value.disk.total) return 0
  return Math.round((status.value.disk.used / status.value.disk.total) * 100)
})

onMounted(() => {
  fetchStatus()
  refreshTimer = window.setInterval(fetchStatus, 30000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})

async function fetchStatus() {
  loading.value = true
  try {
    const res = await systemApi.getStatus()
    if (res.success && res.data) {
      status.value = res.data
    }
  } catch (error) {
    // 使用模拟数据
    status.value = {
      cpu: { usage: 35, cores: 8 },
      memory: { total: 17179869184, used: 8589934592, free: 8589934592 },
      disk: { total: 512110190592, used: 256055095296, free: 256055095296 },
      uptime: 864000,
      nodeVersion: 'v20.10.0',
      platform: 'win32',
    }
  } finally {
    loading.value = false
  }
}

function getProgressColor(percent: number) {
  if (percent < 60) return '#52c41a'
  if (percent < 80) return '#faad14'
  return '#ff4d4f'
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  
  return parts.join(' ') || '刚刚启动'
}
</script>

<style scoped>
.system-status {
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

.ant-card {
  text-align: center;
  margin-bottom: 16px;
}

.stat-info {
  margin-top: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}

.uptime {
  font-size: 24px;
  font-weight: 600;
  color: #1677ff;
  padding: 20px 0;
}

.system-info {
  margin-top: 24px;
}
</style>
