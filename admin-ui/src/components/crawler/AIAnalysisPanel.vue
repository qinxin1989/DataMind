<template>
  <div class="ai-analysis-panel">
    <a-card title="AI智能分析结果" :bordered="false">
      <template #extra>
        <a-button 
          type="primary" 
          @click="handleApplyAll" 
          :disabled="!hasRecommendations"
        >
          应用全部推荐
        </a-button>
      </template>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <a-spin size="large" tip="AI正在分析网页结构..." />
      </div>

      <!-- 推荐字段列表 -->
      <div v-else-if="hasRecommendations" class="recommendations-list">
        <a-list :data-source="recommendations" item-layout="horizontal">
          <template #renderItem="{ item, index }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <a-space>
                    <span class="field-name">{{ item.name }}</span>
                    <a-tag :color="getConfidenceColor(item.confidence)">
                      置信度: {{ (item.confidence * 100).toFixed(0) }}%
                    </a-tag>
                  </a-space>
                </template>
                <template #description>
                  <div class="field-details">
                    <div class="selector-row">
                      <span class="label">选择器:</span>
                      <a-input
                        v-model:value="item.selector"
                        size="small"
                        style="flex: 1; margin: 0 8px"
                      />
                    </div>
                    <div v-if="item.sampleValue" class="sample-row">
                      <span class="label">示例值:</span>
                      <code>{{ item.sampleValue }}</code>
                    </div>
                  </div>
                </template>
              </a-list-item-meta>
              <template #actions>
                <a-button 
                  type="link" 
                  size="small" 
                  @click="handleApplySingle(item)"
                >
                  应用
                </a-button>
                <a-button 
                  type="link" 
                  size="small" 
                  danger
                  @click="handleRemove(index)"
                >
                  移除
                </a-button>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </div>

      <!-- 空状态 -->
      <a-empty 
        v-else 
        description="暂无AI分析结果，请先输入URL并点击AI智能分析"
      />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message } from 'ant-design-vue'

// Props
interface Props {
  recommendations: RecommendedField[]
  loading?: boolean
}

interface RecommendedField {
  name: string
  selector: string
  confidence: number
  sampleValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
const emit = defineEmits<{
  'apply': [field: RecommendedField]
  'applyAll': [fields: RecommendedField[]]
  'remove': [index: number]
}>()

// Computed
const hasRecommendations = computed(() => {
  return props.recommendations && props.recommendations.length > 0
})

// Methods
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'green'
  if (confidence >= 0.6) return 'blue'
  if (confidence >= 0.4) return 'orange'
  return 'red'
}

function handleApplySingle(field: RecommendedField) {
  emit('apply', field)
  message.success(`已应用字段: ${field.name}`)
}

function handleApplyAll() {
  if (!hasRecommendations.value) return
  
  emit('applyAll', props.recommendations)
  message.success(`已应用 ${props.recommendations.length} 个推荐字段`)
}

function handleRemove(index: number) {
  emit('remove', index)
}
</script>

<style scoped>
.ai-analysis-panel {
  padding: 16px 0;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
}

.recommendations-list {
  margin-top: 16px;
}

.field-name {
  font-weight: 500;
  font-size: 14px;
  color: #262626;
}

.field-details {
  margin-top: 8px;
}

.selector-row,
.sample-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.label {
  min-width: 60px;
  color: #666;
  font-size: 12px;
}

.sample-row code {
  flex: 1;
  padding: 4px 8px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  font-size: 12px;
  color: #d46b08;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.ant-list-item) {
  padding: 16px 0;
}

:deep(.ant-list-item-meta-description) {
  margin-top: 8px;
}
</style>
