<template>
  <div class="system-monitoring">
    <div class="page-header">
      <h1>系统监控</h1>
      <p class="page-desc">实时监控系统性能指标与运行状态</p>
    </div>

    <a-row :gutter="[16, 16]">
      <a-col :span="8">
        <a-card title="API 性能 (QPS/响应时间)">
          <div class="metric-value">
            <span class="main">{{ metrics.api?.qps || 0 }}</span>
            <span class="unit">req/s</span>
          </div>
          <div class="metric-footer">
            平均响应: {{ metrics.api?.avgDuration || 0 }}ms
          </div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="数据库性能">
          <div class="metric-value">
            <span class="main">{{ metrics.database?.avgDuration || 0 }}</span>
            <span class="unit">ms</span>
          </div>
          <div class="metric-footer">
            近5分钟查询: {{ metrics.database?.count || 0 }} 次
          </div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="系统资源">
          <div class="resource-item">
            <span>CPU</span>
            <a-progress :percent="metrics.system?.cpuUsage || 0" size="small" />
          </div>
          <div class="resource-item">
            <span>内存</span>
            <a-progress :percent="metrics.system?.memoryUsage || 0" size="small" />
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card title="慢查询 (Top 10)" style="margin-top: 24px;">
      <a-table :columns="slowQueryColumns" :data-source="slowQueries" :pagination="false" size="small" row-key="created_at">
        <template #bodyCell="{ column, text }">
          <template v-if="column.key === 'duration'">
            <a-tag :color="text > 500 ? 'red' : 'orange'">{{ text }}ms</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { get } from '@/api/request'

const metrics = ref<any>({})
const slowQueries = ref<any[]>([])
let timer: any = null

const slowQueryColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '耗时', dataIndex: 'duration', key: 'duration', width: 120 },
  { title: '信息', dataIndex: 'metadata', key: 'metadata', ellipsis: true },
  { title: '发生时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
]

async function fetchData() {
  try {
    const [resMetrics, resSlow] = await Promise.all([
      get('/admin/monitoring/metrics'),
      get('/admin/monitoring/slow-queries?limit=10')
    ])
    
    if (resMetrics.success) {
      metrics.value = resMetrics.data
    }
    if (resSlow.success) {
      slowQueries.value = resSlow.data
    }
  } catch (error) {
    console.error('Fetch monitoring data failed:', error)
  }
}

onMounted(() => {
  fetchData()
  timer = setInterval(fetchData, 10000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.metric-value {
  margin: 12px 0;
  display: flex;
  align-items: baseline;
}
.metric-value .main {
  font-size: 32px;
  font-weight: bold;
  color: #1890ff;
}
.metric-value .unit {
  margin-left: 8px;
  color: #888;
}
.metric-footer {
  color: #666;
  font-size: 13px;
}
.resource-item {
  margin-bottom: 12px;
}
.resource-item span {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}
</style>
