<template>
  <div class="preview-panel">
    <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
      <!-- 网页预览标签页 -->
      <a-tab-pane key="webpage" tab="网页预览">
        <template #tab>
          <span>
            <GlobalOutlined />
            网页预览
          </span>
        </template>
        <WebpagePreview
          :url="url"
          @element-selected="handleElementSelected"
        />
      </a-tab-pane>

      <!-- 选择器可视化标签页 -->
      <a-tab-pane key="selectors" tab="选择器可视化">
        <template #tab>
          <span>
            <AimOutlined />
            选择器可视化
            <a-badge 
              v-if="selectorCount > 0" 
              :count="selectorCount" 
              :number-style="{ backgroundColor: '#52c41a' }"
            />
          </span>
        </template>
        <SelectorVisualization
          :selectors="selectors"
        />
      </a-tab-pane>

      <!-- 数据预览标签页 -->
      <a-tab-pane key="data" tab="数据预览">
        <template #tab>
          <span>
            <TableOutlined />
            数据预览
            <a-badge 
              v-if="previewDataCount > 0" 
              :count="previewDataCount" 
              :number-style="{ backgroundColor: '#1890ff' }"
            />
          </span>
        </template>
        <DataPreviewTable
          :data="previewData"
          :loading="previewLoading"
          :page-size="10"
          :url="url"
          :selectors="selectors"
          :error="previewError"
          @apply-strategy="handleApplyStrategy"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { GlobalOutlined, AimOutlined, TableOutlined } from '@ant-design/icons-vue'
import WebpagePreview from './WebpagePreview.vue'
import SelectorVisualization from './SelectorVisualization.vue'
import DataPreviewTable from './DataPreviewTable.vue'

// Props
interface Props {
  url: string
  containerSelector?: string
  fields?: FieldConfig[]
  previewData?: any[]
  previewLoading?: boolean
  previewError?: string
}

interface FieldConfig {
  name: string
  selector: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '',
  fields: () => [],
  previewData: () => [],
  previewLoading: false,
  previewError: ''
})

// Emits
const emit = defineEmits<{
  'selectorSelected': [selector: string, fieldName?: string]
  'applyStrategy': [strategy: any]
}>()

// Local state
const activeTab = ref('webpage')

// Computed
const selectors = computed(() => {
  const result: any = {}
  
  if (props.containerSelector) {
    result.container = props.containerSelector
  }
  
  if (props.fields && props.fields.length > 0) {
    result.fields = props.fields.reduce((acc: any, field) => {
      acc[field.name] = field.selector
      return acc
    }, {})
  }
  
  return result
})

const selectorCount = computed(() => {
  let count = 0
  if (props.containerSelector) count++
  if (props.fields) count += props.fields.length
  return count
})

const previewDataCount = computed(() => {
  return props.previewData?.length || 0
})

// Methods
function handleTabChange(key: string) {
  activeTab.value = key
}

function handleElementSelected(selector: string) {
  emit('selectorSelected', selector)
}

function handleApplyStrategy(strategy: any) {
  emit('applyStrategy', strategy)
}

// 暴露方法给父组件
defineExpose({
  switchToTab: (tab: string) => {
    activeTab.value = tab
  },
  getCurrentTab: () => activeTab.value
})
</script>

<style scoped>
.preview-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

:deep(.ant-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.ant-tabs-content-holder) {
  flex: 1;
  overflow: auto;
}

:deep(.ant-tabs-content) {
  height: 100%;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
}

:deep(.ant-badge) {
  margin-left: 8px;
}
</style>
