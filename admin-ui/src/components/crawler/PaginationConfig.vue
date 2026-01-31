<template>
  <div class="pagination-config">
    <a-divider orientation="left">分页配置</a-divider>

    <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
      <!-- 启用分页开关 -->
      <a-form-item label="启用分页">
        <a-switch 
          v-model:checked="paginationData.enabled" 
          @change="handleChange"
        />
        <span v-if="paginationData.enabled" style="margin-left: 12px; color: #52c41a">
          已启用
        </span>
        <span v-else style="margin-left: 12px; color: #999">
          已禁用
        </span>
      </a-form-item>

      <!-- 条件显示：仅在启用分页时显示以下配置 -->
      <template v-if="paginationData.enabled">
        <!-- 最大页数 -->
        <a-form-item label="最大页数">
          <a-input-number 
            v-model:value="paginationData.maxPages" 
            :min="1" 
            :max="100"
            style="width: 150px"
            @change="handleChange"
          />
          <span style="margin-left: 8px; color: #999">
            默认 50 页，最多 100 页
          </span>
        </a-form-item>

        <!-- URL模式 -->
        <a-form-item label="URL模式">
          <a-input 
            v-model:value="paginationData.urlPattern" 
            placeholder="例如：https://example.com/list?page={page}"
            @change="handleChange"
          />
          <div class="help-text">
            使用 {page} 作为页码占位符，留空则自动检测
          </div>
        </a-form-item>

        <!-- 分页选择器 -->
        <a-form-item label="分页选择器">
          <a-input 
            v-model:value="paginationData.nextPageSelector" 
            placeholder="例如：a.next 或 .pagination .next"
            @change="handleChange"
          />
          <div class="help-text">
            下一页按钮或页码链接的 CSS 选择器，留空则自动检测
          </div>
        </a-form-item>
      </template>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

// Props
interface Props {
  modelValue: PaginationConfig
}

interface PaginationConfig {
  enabled: boolean
  maxPages: number
  urlPattern?: string
  nextPageSelector?: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: PaginationConfig]
}>()

// Local state
const paginationData = ref<PaginationConfig>({ ...props.modelValue })

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  paginationData.value = { ...newValue }
}, { deep: true })

// Methods
function handleChange() {
  emit('update:modelValue', { ...paginationData.value })
}
</script>

<style scoped>
.pagination-config {
  padding: 16px 0;
}

.help-text {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
