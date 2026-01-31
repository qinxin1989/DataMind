<template>
  <div class="webpage-preview">
    <!-- 工具栏 -->
    <div class="preview-toolbar">
      <a-space>
        <a-button @click="handleRefresh" :loading="loading" size="small">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button @click="handleOpenInNewWindow" size="small" :disabled="!url">
          <template #icon><ExportOutlined /></template>
          新窗口打开
        </a-button>
        <a-divider type="vertical" />
        <a-button 
          @click="toggleElementPicker" 
          size="small" 
          :type="pickerEnabled ? 'primary' : 'default'"
          :disabled="!url || loading"
        >
          <template #icon><AimOutlined /></template>
          {{ pickerEnabled ? '停止选择' : '启用元素选择' }}
        </a-button>
        <a-divider type="vertical" />
        <span class="url-display">{{ url || '未设置URL' }}</span>
      </a-space>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <a-spin size="large" tip="正在加载网页..." />
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-container">
      <a-result
        status="error"
        title="加载失败"
        :sub-title="error"
      >
        <template #extra>
          <a-button type="primary" @click="handleRefresh">
            重新加载
          </a-button>
        </template>
      </a-result>
    </div>

    <!-- iframe预览 -->
    <div v-else-if="url" class="iframe-container">
      <iframe
        ref="iframeRef"
        :src="proxyUrl"
        frameborder="0"
        @load="handleIframeLoad"
        @error="handleIframeError"
      />
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-container">
      <a-empty description="请先输入目标URL" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ReloadOutlined, ExportOutlined, AimOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { createElementPicker, type ElementPicker } from '@/utils/elementPicker'

// Props
interface Props {
  url: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'loaded': []
  'error': [error: string]
  'elementSelected': [selector: string]
}>()

// Local state
const iframeRef = ref<HTMLIFrameElement | null>(null)
const loading = ref(false)
const error = ref<string>('')
const pickerEnabled = ref(false)
let elementPicker: ElementPicker | null = null

// Computed
const proxyUrl = computed(() => {
  if (!props.url) return ''
  // 使用后端代理服务加载网页，避免跨域问题
  return `/api/admin/ai/crawler/proxy?url=${encodeURIComponent(props.url)}`
})

// Watch URL changes
watch(() => props.url, (newUrl) => {
  if (newUrl) {
    loadPage()
  } else {
    error.value = ''
  }
})

// Methods
function loadPage() {
  if (!props.url) return
  
  loading.value = true
  error.value = ''
}

function handleIframeLoad() {
  loading.value = false
  error.value = ''
  emit('loaded')
  
  // iframe加载完成后，初始化元素选择器
  initElementPicker()
}

function handleIframeError() {
  loading.value = false
  error.value = '网页加载失败，请检查URL是否正确或网络连接'
  emit('error', error.value)
}

function handleRefresh() {
  if (!props.url) {
    message.warning('请先输入目标URL')
    return
  }
  
  // 停用元素选择器
  if (pickerEnabled.value) {
    toggleElementPicker()
  }
  
  loadPage()
  
  // 重新加载iframe
  if (iframeRef.value) {
    iframeRef.value.src = proxyUrl.value
  }
}

function handleOpenInNewWindow() {
  if (!props.url) {
    message.warning('请先输入目标URL')
    return
  }
  
  window.open(props.url, '_blank')
}

/**
 * 初始化元素选择器
 */
function initElementPicker() {
  try {
    if (!iframeRef.value || !iframeRef.value.contentWindow) return

    const iframeDoc = iframeRef.value.contentWindow.document

    // 在iframe中创建元素选择器
    elementPicker = createElementPicker({
      onElementSelected: (selector: string, element: HTMLElement) => {
        message.success(`已选择元素: ${selector}`)
        emit('elementSelected', selector)
        // 选择后自动停用
        pickerEnabled.value = false
        if (elementPicker) {
          elementPicker.disable()
        }
      }
    })
  } catch (err) {
    console.error('初始化元素选择器失败:', err)
  }
}

/**
 * 切换元素选择器状态
 */
function toggleElementPicker() {
  if (!elementPicker) {
    message.warning('元素选择器未初始化，请等待页面加载完成')
    return
  }

  pickerEnabled.value = !pickerEnabled.value

  if (pickerEnabled.value) {
    elementPicker.enable()
    message.info('元素选择器已启用，点击网页中的元素即可选择')
  } else {
    elementPicker.disable()
    message.info('元素选择器已停用')
  }
}

// 组件卸载时清理
onUnmounted(() => {
  if (elementPicker && pickerEnabled.value) {
    elementPicker.disable()
  }
})

// 暴露方法给父组件
defineExpose({
  refresh: handleRefresh,
  getIframe: () => iframeRef.value
})
</script>

<style scoped>
.webpage-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.preview-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.url-display {
  color: #666;
  font-size: 12px;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}

.loading-container,
.error-container,
.empty-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.iframe-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
