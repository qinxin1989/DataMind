<template>
  <div class="datasource-approval">
    <div class="page-header">
      <h1>数据源审核</h1>
      <p class="page-desc">审核用户提交的公共数据源申请</p>
    </div>

    <a-table :columns="columns" :data-source="pendingList" :loading="loading" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="getTypeColor(record.type)">{{ record.type.toUpperCase() }}</a-tag>
        </template>
        <template v-else-if="column.key === 'connection'">
          {{ record.host }}:{{ record.port }}/{{ record.database }}
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="primary" size="small" @click="handleApprove(record)">
              通过
            </a-button>
            <a-button danger size="small" @click="handleReject(record)">
              拒绝
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 拒绝原因弹窗 -->
    <a-modal
      v-model:open="rejectModalVisible"
      title="拒绝原因"
      @ok="handleRejectConfirm"
      :confirmLoading="rejectLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="拒绝原因" required>
          <a-textarea
            v-model:value="rejectComment"
            placeholder="请输入拒绝原因"
            :rows="4"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { datasourceApi } from '@/api/datasource'
import type { Datasource } from '@/types'

const loading = ref(false)
const pendingList = ref<Datasource[]>([])
const rejectModalVisible = ref(false)
const rejectLoading = ref(false)
const rejectComment = ref('')
const rejectingRecord = ref<Datasource | null>(null)

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', key: 'type', width: 120 },
  { title: '连接信息', key: 'connection' },
  { title: '提交时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 150 },
]

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    mysql: 'blue',
    postgresql: 'green',
    sqlserver: 'orange',
    sqlite: 'purple',
    file: 'cyan'
  }
  return colors[type] || 'default'
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchPendingList()
})

async function fetchPendingList() {
  loading.value = true
  try {
    const res = await datasourceApi.getPendingApprovals()
    pendingList.value = res.data?.list || []
  } catch (error) {
    message.error('加载待审核列表失败')
  } finally {
    loading.value = false
  }
}

async function handleApprove(record: Datasource) {
  try {
    await datasourceApi.approve(record.id)
    message.success('审核通过')
    fetchPendingList()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  }
}

function handleReject(record: Datasource) {
  rejectingRecord.value = record
  rejectComment.value = ''
  rejectModalVisible.value = true
}

async function handleRejectConfirm() {
  if (!rejectComment.value.trim()) {
    message.warning('请输入拒绝原因')
    return
  }
  
  rejectLoading.value = true
  try {
    await datasourceApi.reject(rejectingRecord.value!.id, rejectComment.value)
    message.success('已拒绝')
    rejectModalVisible.value = false
    fetchPendingList()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    rejectLoading.value = false
  }
}
</script>

<style scoped>
.datasource-approval {
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

.page-desc {
  color: #666;
  margin-top: 8px;
}
</style>
