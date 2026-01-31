<template>
  <div class="selector-validator">
    <a-input 
      v-model:value="localSelector" 
      :placeholder="placeholder"
      @input="handleInput"
      :disabled="disabled"
    >
      <template #suffix>
        <a-spin v-if="validating" size="small" />
        <CheckCircleOutlined 
          v-else-if="validationResult && validationResult.valid" 
          style="color: #52c41a" 
        />
        <CloseCircleOutlined 
          v-else-if="validationResult && !validationResult.valid" 
          style="color: #ff4d4f" 
        />
      </template>
    </a-input>
    
    <!-- 验证结果显示 -->
    <div v-if="validationResult" class="validation-result">
      <a-alert 
        v-if="validationResult.valid && validationResult.matchCount > 0"
        type="success" 
        :message="`找到 ${validationResult.matchCount} 个匹配元素`"
        show-icon
        banner
      />
      <a-alert 
        v-else-if="validationResult.valid && validationResult.matchCount === 0"
        type="warning" 
        message="未找到匹配元素，请检查选择器是否正确"
        show-icon
        banner
      />
      <a-alert 
        v-else-if="!validationResult.valid && validationResult.error"
        type="error" 
        :message="`验证失败：${validationResult.error}`"
        show-icon
        banner
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'

// Props
interface Props {
  selector: string
  url: string
  placeholder?: string
  disabled?: boolean
}

interface ValidationResult {
  valid: boolean
  matchCount: number
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入 CSS 选择器',
  disabled: false
})

// Emits
const emit = defineEmits<{
  'update:selector': [value: string]
  'validated': [result: ValidationResult]
}>()

// Local state
const localSelector = ref(props.selector)
const validating = ref(false)
const validationResult = ref<ValidationResult | null>(null)
let debounceTimer: number | null = null

// Watch for external changes
watch(() => props.selector, (newValue) => {
  localSelector.value = newValue
})

// Watch for URL changes - revalidate when URL changes
watch(() => props.url, () => {
  if (localSelector.value && props.url) {
    validateSelector()
  }
})

// Methods
function handleInput() {
  emit('update:selector', localSelector.value)
  
  // 防抖300ms
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  
  debounceTimer = window.setTimeout(() => {
    if (localSelector.value && props.url) {
      validateSelector()
    } else {
      validationResult.value = null
    }
  }, 300)
}

async function validateSelector() {
  if (!localSelector.value || !props.url) {
    validationResult.value = null
    return
  }

  validating.value = true
  
  try {
    const res = await aiApi.validateSelector({
      url: props.url,
      selector: localSelector.value
    })

    if (res.success && res.data) {
      validationResult.value = {
        valid: res.data.valid,
        matchCount: res.data.matchCount || 0,
        error: res.data.error
      }
      emit('validated', validationResult.value)
    } else {
      validationResult.value = {
        valid: false,
        matchCount: 0,
        error: '验证失败'
      }
    }
  } catch (error: any) {
    validationResult.value = {
      valid: false,
      matchCount: 0,
      error: error.message || '验证失败'
    }
  } finally {
    validating.value = false
  }
}
</script>

<style scoped>
.selector-validator {
  width: 100%;
}

.validation-result {
  margin-top: 8px;
}
</style>
