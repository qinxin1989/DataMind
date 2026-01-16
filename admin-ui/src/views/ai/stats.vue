<template>
  <div class="ai-stats">
    <div class="page-header">
      <h1>使用统计</h1>
    </div>

    <!-- 时间范围选择 -->
    <div class="filter-bar">
      <a-range-picker v-model:value="dateRange" @change="fetchStats" />
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="16" class="stat-cards">
      <a-col :xs="24" :sm="8">
        <a-card>
          <a-statistic title="总请求数" :value="stats.totalRequests">
            <template #prefix><ApiOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="8">
        <a-card>
          <a-statistic title="总Token消耗" :value="stats.totalTokens">
            <template #prefix><ThunderboltOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="8">
        <a-card>
          <a-statistic title="预估费用" :value="stats.estimatedCost" prefix="$" :precision="2">
            <template #prefix><DollarOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 按模型统计 -->
    <a-card title="模型使用统计" class="stats-card">
      <a-table :columns="modelColumns" :data-source="stats.byModel || []" :pagination="false" size="small" row-key="modelName">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tokens'">
            {{ formatNumber(record.tokens) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 用户使用排行 -->
    <a-card title="用户使用排行" class="stats-card">
      <a-table :columns="userColumns" :data-source="stats.topUsers" :pagination="false" size="small" row-key="userId">
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'rank'">
            <a-tag :color="index < 3 ? 'gold' : 'default'">{{ index + 1 }}</a-tag>
          </template>
          <template v-else-if="column.key === 'tokens'">
            {{ formatNumber(record.tokens || 0) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 用户-模型明细 -->
    <a-card title="用户模型使用明细" class="stats-card">
      <a-table :columns="userModelColumns" :data-source="stats.byUserModel || []" :pagination="{ pageSize: 10 }" size="small" row-key="key">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tokens'">
            {{ formatNumber(record.tokens) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 每日调用明细 -->
    <a-card title="每日调用明细" class="stats-card">
      <a-table :columns="dayModelColumns" :data-source="dayModelData" :pagination="{ pageSize: 10 }" size="small" row-key="key">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tokens'">
            {{ formatNumber(record.tokens) }}
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ApiOutlined, ThunderboltOutlined, DollarOutlined } from '@ant-design/icons-vue'
import { aiApi, type AIUsageStats } from '@/api/ai'
import dayjs, { type Dayjs } from 'dayjs'

const dateRange = ref<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs()])

const stats = ref<AIUsageStats>({
  totalRequests: 0,
  totalTokens: 0,
  estimatedCost: 0,
  requestsByDay: [],
  tokensByDay: [],
  topUsers: [],
  byModel: [],
  byUserModel: [],
  byDayModel: [],
})

const modelColumns = [
  { title: '模型', dataIndex: 'modelName', key: 'modelName' },
  { title: '请求数', dataIndex: 'requests', key: 'requests' },
  { title: 'Token消耗', key: 'tokens' },
]

const userColumns = [
  { title: '排名', key: 'rank', width: 80 },
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '请求数', dataIndex: 'requests', key: 'requests' },
  { title: 'Token消耗', key: 'tokens' },
]

const userModelColumns = [
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '模型', dataIndex: 'modelName', key: 'modelName' },
  { title: '请求数', dataIndex: 'requests', key: 'requests' },
  { title: 'Token消耗', key: 'tokens' },
]

const dayModelColumns = [
  { title: '日期', dataIndex: 'date', key: 'date' },
  { title: '模型', dataIndex: 'modelName', key: 'modelName' },
  { title: '请求数', dataIndex: 'requests', key: 'requests' },
  { title: 'Token消耗', key: 'tokens' },
]

// 为每日数据添加唯一 key
const dayModelData = computed(() => {
  return (stats.value.byDayModel || []).map((item, index) => ({
    ...item,
    key: `${item.date}-${item.modelName}-${index}`
  }))
})

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }
  return String(num)
}

onMounted(() => {
  fetchStats()
})

async function fetchStats() {
  try {
    const [start, end] = dateRange.value
    const res = await aiApi.getUsageStats(start.valueOf(), end.valueOf())
    if (res.success && res.data) {
      stats.value = res.data
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}
</script>

<style scoped>
.ai-stats {
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

.filter-bar {
  margin-bottom: 24px;
}

.stat-cards {
  margin-bottom: 24px;
}

.stat-cards .ant-card {
  text-align: center;
}

.stats-card {
  margin-bottom: 24px;
}
</style>
