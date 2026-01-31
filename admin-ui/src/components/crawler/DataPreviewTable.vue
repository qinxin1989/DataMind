<template>
  <div class="data-preview-table">
    <!-- 失败提示和AI诊断按钮 -->
    <a-alert
      v-if="showFailureAlert"
      type="warning"
      message="数据预览失败或未采集到数据"
      show-icon
      closable
      style="margin-bottom: 16px"
    >
      <template #description>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>{{ errorMessage || '请检查选择器配置是否正确，或使用AI诊断功能获取修复建议' }}</span>
          <a-button 
            type="primary" 
            size="small"
            :loading="diagnosing"
            @click="handleDiagnose"
          >
            <template #icon>
              <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
                <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/>
              </svg>
            </template>
            AI诊断
          </a-button>
        </div>
      </template>
    </a-alert>

    <!-- AI诊断结果面板 -->
    <DiagnosisPanel
      v-if="diagnosisResult"
      :diagnosis="diagnosisResult"
      @apply-strategy="handleApplyStrategy"
      style="margin-bottom: 16px"
    />

    <!-- 统计信息 -->
    <div v-if="data && data.length > 0" class="preview-stats">
      <a-space>
        <a-statistic 
          title="总数据条数" 
          :value="total" 
          :value-style="{ fontSize: '16px' }"
        />
        <a-divider type="vertical" style="height: 40px" />
        <a-statistic 
          title="当前显示" 
          :value="data.length" 
          :value-style="{ fontSize: '16px' }"
        />
      </a-space>
    </div>

    <!-- 数据表格 -->
    <a-table
      :columns="columns"
      :data-source="paginatedData"
      :loading="loading"
      :pagination="paginationConfig"
      :scroll="{ x: 'max-content' }"
      size="small"
      bordered
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, text }">
        <div class="cell-content">
          {{ formatCellValue(text) }}
        </div>
      </template>
    </a-table>

    <!-- 空状态 -->
    <a-empty 
      v-if="!loading && (!data || data.length === 0) && !showFailureAlert" 
      description="暂无数据，请先配置选择器并预览"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { TableProps, TableColumnType } from 'ant-design-vue'
import DiagnosisPanel from './DiagnosisPanel.vue'
import { aiApi } from '@/api/ai'

// Props
interface Props {
  data: any[]
  total?: number
  loading?: boolean
  pageSize?: number
  url?: string
  selectors?: any
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  total: 0,
  loading: false,
  pageSize: 10  // 默认10条
})

// Emits
interface Emits {
  (e: 'applyStrategy', strategy: any): void
}

const emit = defineEmits<Emits>()

// Local state
const currentPage = ref(1)
const currentPageSize = ref(props.pageSize)
const diagnosing = ref(false)
const diagnosisResult = ref<any>(null)

// Watch pageSize prop changes
watch(() => props.pageSize, (newSize) => {
  currentPageSize.value = newSize
})

// Computed
const showFailureAlert = computed(() => {
  // 如果有错误信息，或者数据为空且不在加载中
  return props.error || (!props.loading && (!props.data || props.data.length === 0))
})

const errorMessage = computed(() => {
  return props.error || ''
})

const columns = computed<TableColumnType[]>(() => {
  if (!props.data || props.data.length === 0) return []

  // 从第一条数据中提取字段名
  const firstItem = props.data[0]
  const fields = Object.keys(firstItem)

  return fields.map(field => ({
    title: field,
    dataIndex: field,
    key: field,
    ellipsis: true,
    width: 150
  }))
})

const paginatedData = computed(() => {
  if (!props.data) return []
  
  const start = (currentPage.value - 1) * currentPageSize.value
  const end = start + currentPageSize.value
  
  return props.data.slice(start, end).map((item, index) => ({
    ...item,
    key: `row-${start + index}`
  }))
})

const paginationConfig = computed<TableProps['pagination']>(() => {
  const totalCount = props.total || props.data?.length || 0
  
  return {
    current: currentPage.value,
    pageSize: currentPageSize.value,
    total: totalCount,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条数据`,
    pageSizeOptions: ['10', '20', '50', '100'],
    onChange: (page: number, pageSize: number) => {
      currentPage.value = page
      currentPageSize.value = pageSize
    }
  }
})

// Methods
async function handleDiagnose() {
  if (!props.url || !props.selectors) {
    message.error('缺少URL或选择器配置，无法进行诊断')
    return
  }

  diagnosing.value = true
  diagnosisResult.value = null

  try {
    const res = await aiApi.diagnoseCrawler(
      props.url,
      props.selectors,
      props.error
    )

    if (res.success && res.data) {
      diagnosisResult.value = res.data
      message.success('AI诊断完成')
    } else {
      message.error('AI诊断失败')
    }
  } catch (error: any) {
    message.error(`AI诊断失败: ${error.message || '未知错误'}`)
  } finally {
    diagnosing.value = false
  }
}

function handleApplyStrategy(strategy: any) {
  emit('applyStrategy', strategy)
  message.success('已应用推荐策略')
}

function handleTableChange(pagination: any) {
  if (pagination) {
    currentPage.value = pagination.current
    currentPageSize.value = pagination.pageSize
  }
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return '-'
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  
  return String(value)
}

// Reset page when data changes
watch(() => props.data, () => {
  currentPage.value = 1
  // 清除之前的诊断结果
  diagnosisResult.value = null
})
</script>

<style scoped>
.data-preview-table {
  padding: 16px 0;
}

.preview-stats {
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
}

.cell-content {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.ant-table-small) {
  font-size: 12px;
}

:deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
}
</style>
