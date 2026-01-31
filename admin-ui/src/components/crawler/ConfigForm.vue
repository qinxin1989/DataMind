<template>
  <div class="config-form">
    <a-form :model="formData" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
      <!-- 基本信息 -->
      <a-divider orientation="left">基本信息</a-divider>
      
      <a-form-item label="模板名称" required>
        <a-input 
          v-model:value="formData.name" 
          placeholder="例如：国家数据局政策文件"
          @change="handleChange"
        />
      </a-form-item>

      <a-form-item label="目标URL" required>
        <a-space style="width: 100%">
          <a-input 
            v-model:value="formData.url" 
            placeholder="https://example.com/list"
            style="flex: 1"
            @change="handleChange"
          />
          <a-button 
            type="primary" 
            @click="handleAIAnalyze"
            :loading="aiAnalyzing"
            :disabled="!formData.url"
          >
            <template #icon>
              <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
                <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/>
              </svg>
            </template>
            AI智能分析
          </a-button>
        </a-space>
      </a-form-item>

      <a-form-item label="归属部门">
        <a-input 
          v-model:value="formData.department" 
          placeholder="例如：数据管理部"
          @change="handleChange"
        />
      </a-form-item>

      <a-form-item label="数据类型">
        <a-input 
          v-model:value="formData.dataType" 
          placeholder="例如：政策文件"
          @change="handleChange"
        />
      </a-form-item>

      <!-- 选择器配置 -->
      <a-divider orientation="left">选择器配置</a-divider>

      <a-form-item label="容器选择器" required>
        <a-input 
          v-model:value="formData.containerSelector" 
          placeholder="例如：ul.list > li"
          @change="handleChange"
        />
        <div class="help-text">
          用于定位列表项的 CSS 选择器
        </div>
      </a-form-item>

      <!-- AI推荐字段面板 -->
      <a-alert 
        v-if="aiRecommendations && aiRecommendations.fields && aiRecommendations.fields.length > 0"
        type="info"
        style="margin-bottom: 16px"
      >
        <template #message>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>AI推荐了 {{ aiRecommendations.fields.length }} 个字段</span>
            <a-button 
              type="link" 
              size="small" 
              @click="applyAIRecommendations(aiRecommendations.fields)"
            >
              应用全部推荐
            </a-button>
          </div>
        </template>
        <template #description>
          <div class="ai-recommendations">
            <div 
              v-for="(field, index) in aiRecommendations.fields" 
              :key="index"
              class="recommendation-item"
            >
              <div class="field-info">
                <strong>{{ field.name }}</strong>
                <span class="confidence">置信度: {{ (field.confidence * 100).toFixed(0) }}%</span>
              </div>
              <div class="field-selector">{{ field.selector }}</div>
              <a-button 
                type="link" 
                size="small" 
                @click="applyAIRecommendations([field])"
              >
                应用此字段
              </a-button>
            </div>
          </div>
        </template>
      </a-alert>

      <a-form-item label="字段配置" required>
        <div class="fields-config">
          <div v-for="(field, index) in formData.fields" :key="index" class="field-item">
            <a-input 
              v-model:value="field.name" 
              placeholder="字段名" 
              style="width: 150px"
              @change="handleChange"
            />
            <a-input 
              v-model:value="field.selector" 
              placeholder="选择器（如：a 或 a::attr(href)）" 
              style="width: 400px; margin-left: 8px"
              @change="handleChange"
            />
            <a-button 
              type="text" 
              danger 
              @click="removeField(index)"
              style="margin-left: 8px"
            >
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </div>
          <a-button type="dashed" block @click="addField" style="margin-top: 8px">
            <template #icon><PlusOutlined /></template>
            添加字段
          </a-button>
        </div>
      </a-form-item>

      <!-- 分页配置 -->
      <a-divider orientation="left">分页配置</a-divider>

      <PaginationConfig
        v-model="paginationData"
        @update:modelValue="handlePaginationChange"
      />
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { 
  DeleteOutlined, 
  PlusOutlined
} from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'
import PaginationConfig from './PaginationConfig.vue'

// Props
interface Props {
  modelValue: TemplateConfig
  loading?: boolean
}

interface TemplateConfig {
  name: string
  url: string
  department: string
  dataType: string
  containerSelector: string
  fields: FieldConfig[]
  paginationEnabled?: boolean
  paginationNextSelector?: string
  paginationMaxPages?: number
}

interface FieldConfig {
  name: string
  selector: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: TemplateConfig]
  'aiAnalyze': []
}>()

// Local state
const formData = ref<TemplateConfig>({ ...props.modelValue })
const aiAnalyzing = ref(false)
const aiRecommendations = ref<any>(null)

// 分页配置数据
const paginationData = computed({
  get: () => ({
    enabled: formData.value.paginationEnabled || false,
    maxPages: formData.value.paginationMaxPages || 50,
    nextPageSelector: formData.value.paginationNextSelector || ''
  }),
  set: (value) => {
    formData.value.paginationEnabled = value.enabled
    formData.value.paginationMaxPages = value.maxPages
    formData.value.paginationNextSelector = value.nextPageSelector
    handleChange()
  }
})

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  formData.value = { ...newValue }
}, { deep: true })

// Methods
function handleChange() {
  emit('update:modelValue', { ...formData.value })
}

function handlePaginationChange(value: any) {
  formData.value.paginationEnabled = value.enabled
  formData.value.paginationMaxPages = value.maxPages
  formData.value.paginationNextSelector = value.nextPageSelector
  handleChange()
}

function addField() {
  formData.value.fields.push({ name: '', selector: '' })
  handleChange()
}

function removeField(index: number) {
  formData.value.fields.splice(index, 1)
  handleChange()
}

async function handleAIAnalyze() {
  if (!formData.value.url) {
    message.error('请先输入目标URL')
    return
  }

  aiAnalyzing.value = true
  try {
    const res = await aiApi.analyzeWebpage(
      formData.value.url, 
      formData.value.dataType || '提取页面主要内容'
    )
    
    if (res.success && res.data) {
      aiRecommendations.value = res.data
      message.success('AI分析完成！请查看推荐字段')
    } else {
      message.error('AI分析失败，请稍后重试')
    }
  } catch (error: any) {
    message.error(`AI分析失败: ${error.message || '未知错误'}`)
  } finally {
    aiAnalyzing.value = false
  }
  
  emit('aiAnalyze')
}

function applyAIRecommendations(fields: any[]) {
  if (!fields || fields.length === 0) {
    message.warning('没有可应用的推荐字段')
    return
  }

  // 应用推荐字段到表单
  formData.value.fields = fields.map((field: any) => ({
    name: field.name,
    selector: field.selector
  }))

  // 如果有容器选择器推荐，也应用
  if (aiRecommendations.value?.containerSelector) {
    formData.value.containerSelector = aiRecommendations.value.containerSelector
  }

  handleChange()
  message.success(`已应用 ${fields.length} 个推荐字段`)
}
</script>

<style scoped>
.config-form {
  padding: 16px 0;
}

.fields-config {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.field-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.field-item:last-child {
  margin-bottom: 0;
}

.help-text {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.ai-recommendations {
  margin-top: 8px;
}

.recommendation-item {
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recommendation-item:last-child {
  margin-bottom: 0;
}

.field-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.confidence {
  font-size: 12px;
  color: #52c41a;
  font-weight: 500;
}

.field-selector {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #666;
  margin: 0 12px;
}
</style>
