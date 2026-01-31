<template>
  <div class="diagnosis-panel">
    <a-card title="AI诊断结果" :bordered="false">
      <!-- 失败原因 -->
      <div class="diagnosis-section">
        <h4>失败原因</h4>
        <a-alert 
          type="error" 
          :message="diagnosis.reason || '未知原因'"
          show-icon
        />
      </div>

      <!-- 检测到的问题 -->
      <div v-if="diagnosis.issues && diagnosis.issues.length > 0" class="diagnosis-section">
        <h4>检测到的问题</h4>
        <a-list 
          size="small" 
          :data-source="diagnosis.issues"
          :split="false"
        >
          <template #renderItem="{ item }">
            <a-list-item>
              <a-typography-text type="danger">
                <CloseCircleOutlined /> {{ item }}
              </a-typography-text>
            </a-list-item>
          </template>
        </a-list>
      </div>

      <!-- 修复建议 -->
      <div v-if="diagnosis.suggestions && diagnosis.suggestions.length > 0" class="diagnosis-section">
        <h4>修复建议</h4>
        <a-list 
          size="small" 
          :data-source="diagnosis.suggestions"
          :split="false"
        >
          <template #renderItem="{ item, index }">
            <a-list-item>
              <a-typography-text>
                <CheckCircleOutlined style="color: #52c41a" /> {{ item }}
              </a-typography-text>
            </a-list-item>
          </template>
        </a-list>
      </div>

      <!-- 推荐策略 -->
      <div v-if="diagnosis.recommendedStrategy" class="diagnosis-section">
        <h4>推荐采集策略</h4>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item 
            v-if="diagnosis.recommendedStrategy.useHeadless !== undefined"
            label="使用浏览器自动化"
          >
            <a-tag :color="diagnosis.recommendedStrategy.useHeadless ? 'green' : 'default'">
              {{ diagnosis.recommendedStrategy.useHeadless ? '是' : '否' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item 
            v-if="diagnosis.recommendedStrategy.waitForSelector"
            label="等待选择器"
          >
            <code>{{ diagnosis.recommendedStrategy.waitForSelector }}</code>
          </a-descriptions-item>
          <a-descriptions-item 
            v-if="diagnosis.recommendedStrategy.scrollToBottom !== undefined"
            label="滚动到底部"
          >
            <a-tag :color="diagnosis.recommendedStrategy.scrollToBottom ? 'green' : 'default'">
              {{ diagnosis.recommendedStrategy.scrollToBottom ? '是' : '否' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item 
            v-if="diagnosis.recommendedStrategy.customScript"
            label="自定义脚本"
          >
            <pre class="custom-script">{{ diagnosis.recommendedStrategy.customScript }}</pre>
          </a-descriptions-item>
        </a-descriptions>

        <!-- 应用推荐策略按钮 -->
        <a-button 
          type="primary" 
          style="margin-top: 16px"
          @click="handleApplyStrategy"
        >
          应用推荐策略
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'

interface DiagnosisResult {
  reason: string
  issues?: string[]
  suggestions?: string[]
  recommendedStrategy?: {
    useHeadless?: boolean
    waitForSelector?: string
    scrollToBottom?: boolean
    customScript?: string
  }
}

interface Props {
  diagnosis: DiagnosisResult
}

interface Emits {
  (e: 'applyStrategy', strategy: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleApplyStrategy() {
  if (props.diagnosis.recommendedStrategy) {
    emit('applyStrategy', props.diagnosis.recommendedStrategy)
  }
}
</script>

<style scoped>
.diagnosis-panel {
  padding: 16px;
}

.diagnosis-section {
  margin-bottom: 24px;
}

.diagnosis-section:last-child {
  margin-bottom: 0;
}

.diagnosis-section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #262626;
}

.custom-script {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

:deep(.ant-list-item) {
  padding: 4px 0;
}

:deep(.ant-descriptions-item-label) {
  font-weight: 500;
}
</style>
