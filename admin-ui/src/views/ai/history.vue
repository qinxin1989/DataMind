<template>
  <div class="ai-history">
    <div class="page-header">
      <h1>对话历史</h1>
    </div>

    <!-- 搜索筛选 -->
    <a-card class="search-card" :bordered="false">
      <a-form layout="inline">
        <a-form-item label="关键词">
          <a-input v-model:value="searchParams.keyword" placeholder="搜索问题或回答" allow-clear style="width: 200px" />
        </a-form-item>
        <a-form-item label="用户">
          <a-input v-model:value="searchParams.userId" placeholder="用户ID" allow-clear style="width: 150px" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="handleSearch">搜索</a-button>
          <a-button style="margin-left: 8px" @click="handleReset">重置</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-table
      :columns="columns"
      :data-source="conversations"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="handleTableChange"
      style="margin-top: 16px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'question'">
          <a-tooltip :title="record.question">
            <span class="ellipsis">{{ record.question }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'answer'">
          <a-tooltip :title="record.answer">
            <span class="ellipsis">{{ record.answer }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'responseTime'">
          {{ record.responseTime }}ms
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleView(record)">详情</a-button>
            <a-popconfirm title="确定删除此记录？" @confirm="handleDelete(record.id)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 详情弹窗 -->
    <a-modal v-model:open="detailVisible" title="对话详情" :footer="null" width="700px">
      <a-descriptions :column="2" bordered v-if="currentConversation">
        <a-descriptions-item label="用户">{{ currentConversation.username || currentConversation.userId }}</a-descriptions-item>
        <a-descriptions-item label="数据源">{{ currentConversation.datasourceName || currentConversation.datasourceId }}</a-descriptions-item>
        <a-descriptions-item label="Token消耗">{{ currentConversation.tokensUsed }}</a-descriptions-item>
        <a-descriptions-item label="响应时间">{{ currentConversation.responseTime }}ms</a-descriptions-item>
        <a-descriptions-item label="时间" :span="2">{{ formatDate(currentConversation.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="问题" :span="2">
          <div class="detail-content">{{ currentConversation.question }}</div>
        </a-descriptions-item>
        <a-descriptions-item label="回答" :span="2">
          <div class="detail-content">{{ currentConversation.answer }}</div>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentConversation.sqlQuery" label="生成SQL" :span="2">
          <pre class="sql-code">{{ currentConversation.sqlQuery }}</pre>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { aiApi, type ConversationHistory } from '@/api/ai'

const loading = ref(false)
const conversations = ref<ConversationHistory[]>([])
const detailVisible = ref(false)
const currentConversation = ref<ConversationHistory | null>(null)

const searchParams = reactive({
  keyword: '',
  userId: '',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const columns = [
  { title: '用户', dataIndex: 'username', key: 'username', width: 100 },
  { title: '数据源', dataIndex: 'datasourceName', key: 'datasourceName', width: 120 },
  { title: '问题', key: 'question', ellipsis: true },
  { title: '回答', key: 'answer', ellipsis: true },
  { title: 'Token', dataIndex: 'tokensUsed', key: 'tokensUsed', width: 80 },
  { title: '响应时间', key: 'responseTime', width: 100 },
  { title: '时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'action', width: 120 },
]

onMounted(() => {
  fetchConversations()
})

async function fetchConversations() {
  loading.value = true
  try {
    const res = await aiApi.getConversations({
      page: pagination.current,
      pageSize: pagination.pageSize,
      keyword: searchParams.keyword || undefined,
      userId: searchParams.userId || undefined,
    })
    if (res.success && res.data) {
      conversations.value = res.data.list
      pagination.total = res.data.total
    }
  } catch (error) {
    console.error('获取对话历史失败:', error)
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchConversations()
}

function handleSearch() {
  pagination.current = 1
  fetchConversations()
}

function handleReset() {
  searchParams.keyword = ''
  searchParams.userId = ''
  pagination.current = 1
  fetchConversations()
}

function handleView(record: ConversationHistory) {
  currentConversation.value = record
  detailVisible.value = true
}

async function handleDelete(id: string) {
  try {
    await aiApi.deleteChatHistory(id)
    message.success('删除成功')
    fetchConversations()
  } catch (error) {
    message.error('删除失败')
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}
</script>

<style scoped>
.ai-history {
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

.search-card {
  margin-bottom: 16px;
}

.ellipsis {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.sql-code {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0;
}
</style>
