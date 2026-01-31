<template>
  <div class="selector-visualization">
    <a-list :data-source="selectorList" :loading="loading">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta>
            <template #title>
              <a-space>
                <span class="selector-name">{{ item.name }}</span>
                <a-tag v-if="item.validationStatus === 'success'" color="success">
                  <template #icon><CheckCircleOutlined /></template>
                  {{ item.matchCount }} 个匹配
                </a-tag>
                <a-tag v-else-if="item.validationStatus === 'warning'" color="warning">
                  <template #icon><ExclamationCircleOutlined /></template>
                  0 个匹配
                </a-tag>
                <a-tag v-else-if="item.validationStatus === 'error'" color="error">
                  <template #icon><CloseCircleOutlined /></template>
                  验证失败
                </a-tag>
                <a-tag v-else color="default">
                  <template #icon><MinusCircleOutlined /></template>
                  未验证
                </a-tag>
              </a-space>
            </template>
            <template #description>
              <div class="selector-value">
                <code>{{ item.selector }}</code>
                <a-button 
                  type="link" 
                  size="small" 
                  @click="handleCopy(item.selector)"
                >
                  <template #icon><CopyOutlined /></template>
                  复制
                </a-button>
              </div>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>

    <a-empty v-if="!loading && selectorList.length === 0" description="暂无选择器配置" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  CloseCircleOutlined,
  MinusCircleOutlined,
  CopyOutlined 
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

// Props
interface Props {
  selectors: SelectorConfig
  validationResults?: Record<string, ValidationResult>
  loading?: boolean
}

interface SelectorConfig {
  container?: string
  fields?: Record<string, string>
}

interface ValidationResult {
  valid: boolean
  matchCount: number
  error?: string
}

interface SelectorItem {
  name: string
  selector: string
  validationStatus: 'success' | 'warning' | 'error' | 'none'
  matchCount: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Computed
const selectorList = computed<SelectorItem[]>(() => {
  const list: SelectorItem[] = []

  // 添加容器选择器
  if (props.selectors.container) {
    const validation = props.validationResults?.['container']
    list.push({
      name: '容器选择器',
      selector: props.selectors.container,
      validationStatus: getValidationStatus(validation),
      matchCount: validation?.matchCount || 0
    })
  }

  // 添加字段选择器
  if (props.selectors.fields) {
    Object.entries(props.selectors.fields).forEach(([fieldName, selector]) => {
      const validation = props.validationResults?.[fieldName]
      list.push({
        name: fieldName,
        selector,
        validationStatus: getValidationStatus(validation),
        matchCount: validation?.matchCount || 0
      })
    })
  }

  return list
})

// Methods
function getValidationStatus(validation?: ValidationResult): 'success' | 'warning' | 'error' | 'none' {
  if (!validation) return 'none'
  
  if (!validation.valid) return 'error'
  if (validation.matchCount === 0) return 'warning'
  return 'success'
}

async function handleCopy(selector: string) {
  try {
    await navigator.clipboard.writeText(selector)
    message.success('选择器已复制到剪贴板')
  } catch (err) {
    // 降级方案：使用旧的复制方法
    const textarea = document.createElement('textarea')
    textarea.value = selector
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    
    try {
      document.execCommand('copy')
      message.success('选择器已复制到剪贴板')
    } catch (e) {
      message.error('复制失败')
    }
    
    document.body.removeChild(textarea)
  }
}
</script>

<style scoped>
.selector-visualization {
  padding: 16px 0;
}

.selector-name {
  font-weight: 500;
  color: #262626;
}

.selector-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-value code {
  flex: 1;
  padding: 4px 8px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #d46b08;
  word-break: break-all;
}
</style>
