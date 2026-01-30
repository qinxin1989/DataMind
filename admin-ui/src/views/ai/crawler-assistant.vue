<template>
  <div class="crawler-assistant">
    <!-- 左侧对话区 -->
    <div class="chat-panel">
      <div class="chat-header">
        <h2>AI 爬虫助手</h2>
        <p class="subtitle">告诉我网址和需要爬取的内容，我来帮您生成爬虫模板</p>
      </div>

      <div class="messages-container" ref="messagesContainer">
        <!-- AI 欢迎消息 -->
        <div v-if="messages.length === 0" class="message ai-message">
          <div class="message-avatar">
            <span class="ai-avatar">🤖</span>
          </div>
          <div class="message-content">
            <div class="message-text">
              您好！我是 AI 爬虫助手。请告诉我：<br>
              1. 您要爬取的网址<br>
              2. 需要提取哪些内容<br><br>
              我会自动分析网页结构并生成爬虫模板。
            </div>
          </div>
        </div>

        <!-- 消息列表 -->
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role === 'user' ? 'user-message' : 'ai-message']">
          <div v-if="msg.role === 'ai'" class="message-avatar">
            <span class="ai-avatar">🤖</span>
          </div>
          <div class="message-content">
            <div v-if="msg.type === 'text'" class="message-text" v-html="msg.content"></div>
            <div v-else-if="msg.type === 'analyzing'" class="message-analyzing">
              <a-spin :spinning="true" />
              <span>正在分析网页结构...</span>
            </div>
            <div v-else-if="msg.type === 'selectors'" class="message-selectors">
              <div class="selectors-header">
                <h4>识别的选择器</h4>
                <a-button size="small" @click="handleEditSelectors">编辑</a-button>
              </div>
              <div class="selectors-list">
                <div v-for="(selector, key) in msg.content.selectors" :key="key" class="selector-item">
                  <div class="selector-label">{{ key }}</div>
                  <a-tag color="blue">{{ selector }}</a-tag>
                </div>
              </div>
              <div v-if="msg.content.department" class="selector-item department-item">
                <div class="selector-label">归属部门</div>
                <a-tag color="orange">{{ msg.content.department }}</a-tag>
              </div>
              <div class="selectors-actions">
                <a-space>
                  <a-button type="primary" size="small" @click="handlePreviewSelectors(msg.content)">预览效果</a-button>
                  <a-button size="small" @click="handleSaveTemplate">保存为模板</a-button>
                </a-space>
              </div>
            </div>
            <div v-else-if="msg.type === 'error'" class="message-error">
              <a-alert :message="msg.content" type="error" />
            </div>
          </div>
          <div v-if="msg.role === 'user'" class="message-avatar user-avatar">
            {{ userAvatar }}
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-container">
        <a-textarea
          v-model:value="inputMessage"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          placeholder="例如：帮我爬取 https://example.com 新闻列表的标题、链接和发布时间"
          @keydown.ctrl.enter="handleSend"
          :disabled="isAnalyzing"
        />
        <a-button
          type="primary"
          :loading="isAnalyzing"
          @click="handleSend"
          :disabled="!inputMessage.trim()"
        >
          发送 (Ctrl+Enter)
        </a-button>
      </div>
    </div>

    <!-- 右侧预览区 -->
    <div class="preview-panel">
      <a-tabs v-model:activeKey="activePreviewTab">
        <a-tab-pane key="webpage" tab="网页预览">
          <div v-if="previewUrl" class="webpage-preview">
            <div class="preview-header">
              <span class="preview-url">{{ previewUrl }}</span>
              <a-button size="small" @click="openInNewTab">在新窗口打开</a-button>
            </div>
            <div class="preview-content" ref="previewContent">
              <iframe
                v-if="previewUrl"
                :src="previewUrl"
                frameborder="0"
                @load="handleIframeLoad"
              ></iframe>
              <div v-else class="preview-placeholder">
                <a-empty description="等待分析网页..." />
              </div>
            </div>
          </div>
          <a-empty v-else description="暂无网页预览" />
        </a-tab-pane>

        <a-tab-pane key="selectors" tab="选择器可视化">
          <div v-if="currentSelectors" class="selectors-visualization">
            <div class="vis-header">
              <h4>元素路径可视化</h4>
            </div>
            <div class="vis-content">
              <div v-for="(selector, key) in currentSelectors" :key="key" class="vis-item">
                <div class="vis-label">{{ key }}</div>
                <div class="vis-selector">
                  <a-tag color="green">{{ selector }}</a-tag>
                  <a-button size="small" type="link" @click="copySelector(selector)">复制</a-button>
                </div>
              </div>
            </div>
          </div>
          <a-empty v-else description="暂无选择器数据" />
        </a-tab-pane>

        <a-tab-pane key="data" tab="数据预览">
          <div v-if="previewData.length > 0" class="data-preview">
            <a-table
              :columns="previewColumns"
              :data-source="previewData"
              :pagination="{ pageSize: 5 }"
              size="small"
              bordered
            >
              <template #bodyCell="{ column, text }">
                <template v-if="column.key === '链接' || (typeof text === 'string' && text.startsWith('http'))">
                  <a :href="text" target="_blank" class="table-link">{{ text }}</a>
                </template>
                <template v-else>
                  {{ text }}
                </template>
              </template>
            </a-table>
          </div>
          <a-empty v-else description="暂无数据预览" />
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 选择器编辑弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑选择器"
      width="800px"
      @ok="handleSaveEditedSelectors"
    >
      <a-form :model="editedSelectors" layout="vertical">
        <a-form-item
          v-for="(selector, key) in editedSelectors"
          :key="key"
          :label="key"
        >
          <a-input v-model:value="editedSelectors[key]" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 保存模板弹窗 -->
    <a-modal
      v-model:open="saveModalVisible"
      title="保存为模板"
      width="500px"
      @ok="handleConfirmSaveTemplate"
    >
      <a-form :model="templateForm" layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input
            v-model:value="templateForm.name"
            placeholder="例如：新闻列表爬虫"
          />
        </a-form-item>
        <a-form-item label="归属部门">
          <a-input
            v-model:value="templateForm.department"
            placeholder="例如：XX省工业和信息化厅"
          />
        </a-form-item>
        <a-form-item label="数据类型">
          <a-input
            v-model:value="templateForm.dataType"
            placeholder="例如：政策文件、行业动态"
          />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea
            v-model:value="templateForm.description"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            placeholder="简要描述这个模板的用途"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { message } from 'ant-design-vue'
import { aiApi } from '@/api/ai'

interface Message {
  role: 'user' | 'ai'
  type: 'text' | 'analyzing' | 'selectors' | 'error'
  content: any
}

const messages = ref<Message[]>([])
const inputMessage = ref('')
const isAnalyzing = ref(false)
const messagesContainer = ref<HTMLElement>()

// 预览相关
const activePreviewTab = ref('webpage')
const previewUrl = ref('')
const currentSelectors = ref<any>(null)
const previewData = ref<any[]>([])
const previewColumns = ref<any[]>([])

// 编辑相关
const editModalVisible = ref(false)
const editedSelectors = ref<any>({})
const originalSelectors = ref<any>({})

// 保存模板相关
const saveModalVisible = ref(false)
const templateForm = ref({
  name: '',
  description: '',
  department: '',
  dataType: ''
})

const userAvatar = computed(() => {
  return 'U'
})

// 发送消息
async function handleSend() {
  const content = inputMessage.value.trim()
  if (!content) return

  // 添加用户消息
  messages.value.push({
    role: 'user',
    type: 'text',
    content
  })
  inputMessage.value = ''

  // 滚动到底部
  await nextTick()
  scrollToBottom()

  // 分析消息中的网址
  const urlMatch = content.match(/(https?:\/\/[^\s]+)/)
  if (!urlMatch) {
    messages.value.push({
      role: 'ai',
      type: 'error',
      content: '请提供有效的网址（以 http:// 或 https:// 开头）'
    })
    await nextTick()
    scrollToBottom()
    return
  }

  const url = urlMatch[1]
  const description = content.replace(url, '').trim()

  // 开始分析
  isAnalyzing.value = true
  messages.value.push({
    role: 'ai',
    type: 'analyzing',
    content: null
  })
  await nextTick()
  scrollToBottom()

  try {
    // 调用 AI 分析接口
    const response = await aiApi.analyzeCrawler(url, description || '提取页面主要内容')

    // 移除分析中消息
    messages.value.pop()

    if (response.success && response.data) {
      // 显示选择器
      previewUrl.value = `/api/admin/ai/crawler/proxy?url=${encodeURIComponent(url)}`
      currentSelectors.value = response.data.selectors

      messages.value.push({
        role: 'ai',
        type: 'selectors',
        content: {
          url,
          description,
          selectors: response.data.selectors,
          department: response.data.department
        }
      })

      // 如果有预览数据，也显示
      if (response.data.preview) {
        previewData.value = response.data.preview
        const fields = Object.keys(response.data.preview[0] || {})
        previewColumns.value = fields.map(f => ({
          title: f,
          dataIndex: f,
          key: f,
          ellipsis: true
        }))
        activePreviewTab.value = 'data'
      } else {
        activePreviewTab.value = 'webpage'
      }
    } else {
      messages.value.push({
        role: 'ai',
        type: 'error',
        content: response.error?.message || '分析失败，请重试'
      })
    }
  } catch (error: any) {
    messages.value.pop()
    messages.value.push({
      role: 'ai',
      type: 'error',
      content: `分析失败: ${error.message || '未知错误'}`
    })
  } finally {
    isAnalyzing.value = false
    await nextTick()
    scrollToBottom()
  }
}

// 编辑选择器
function handleEditSelectors() {
  const lastSelectorMsg = [...messages.value].reverse().find(m => m.type === 'selectors')
  if (lastSelectorMsg && lastSelectorMsg.content.selectors) {
    editedSelectors.value = { ...lastSelectorMsg.content.selectors }
    originalSelectors.value = { ...lastSelectorMsg.content.selectors }
    editModalVisible.value = true
  }
}

// 保存编辑后的选择器
function handleSaveEditedSelectors() {
  const lastSelectorMsg = [...messages.value].reverse().find(m => m.type === 'selectors')
  if (lastSelectorMsg) {
    lastSelectorMsg.content.selectors = { ...editedSelectors.value }
    currentSelectors.value = { ...editedSelectors.value }
  }
  editModalVisible.value = false
  message.success('选择器已更新')
}

// 预览选择器效果
async function handlePreviewSelectors(content: any) {
  try {
    const response = await aiApi.previewCrawler(content.url, content.selectors)
    if (response.success && response.data) {
      previewData.value = response.data
      const fields = Object.keys(response.data[0] || {})
      previewColumns.value = fields.map(f => ({
        title: f,
        dataIndex: f,
        key: f,
        ellipsis: true
      }))
      activePreviewTab.value = 'data'
      message.success('预览数据已更新')
    }
  } catch (error: any) {
    message.error('预览失败: ' + (error.message || '未知错误'))
  }
}

// 保存为模板
function handleSaveTemplate() {
  const lastSelectorMsg = [...messages.value].reverse().find(m => m.type === 'selectors')
  if (!lastSelectorMsg) {
    message.warning('没有可保存的选择器')
    return
  }

  const url = lastSelectorMsg.content.url
  const description = lastSelectorMsg.content.description

  // 自动生成模板名称
  const domain = new URL(url).hostname.replace('www.', '')
  templateForm.value.name = `${domain} 爬虫`
  templateForm.value.description = description
  templateForm.value.department = lastSelectorMsg.content.department || ''
  templateForm.value.dataType = ''

  saveModalVisible.value = true
}

// 确认保存模板
async function handleConfirmSaveTemplate() {
  if (!templateForm.value.name.trim()) {
    message.warning('请输入模板名称')
    return
  }

  const lastSelectorMsg = [...messages.value].reverse().find(m => m.type === 'selectors')
  if (!lastSelectorMsg) return

  try {
    const response = await aiApi.saveCrawlerTemplate({
      name: templateForm.value.name,
      description: templateForm.value.description,
      url: lastSelectorMsg.content.url,
      department: templateForm.value.department,
      data_type: templateForm.value.dataType, // 确保传递了数据类型
      selectors: lastSelectorMsg.content.selectors
    } as any)

    if (response.success) {
      message.success('模板保存成功！')
      saveModalVisible.value = false

      // 添加成功消息
      messages.value.push({
        role: 'ai',
        type: 'text',
        content: `✅ 模板"${templateForm.value.name}"已保存成功！<br>您可以在"爬虫管理"页面查看和管理此模板。`
      })
      await nextTick()
      scrollToBottom()
    }
  } catch (error: any) {
    message.error('保存失败: ' + (error.message || '未知错误'))
  }
}

// iframe 加载完成
function handleIframeLoad() {
  // 可以在这里添加高亮逻辑
}

// 在新窗口打开
function openInNewTab() {
  if (previewUrl.value) {
    window.open(previewUrl.value, '_blank')
  }
}

// 复制选择器
function copySelector(selector: string) {
  navigator.clipboard.writeText(selector).then(() => {
    message.success('已复制到剪贴板')
  })
}

// 滚动到底部
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>

<style scoped>
.crawler-assistant {
  display: flex;
  height: calc(100vh - 140px);
  gap: 16px;
  padding: 0;
}

/* 左侧对话区 */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  min-width: 400px;
}

.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.chat-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.subtitle {
  margin: 8px 0 0 0;
  font-size: 13px;
  opacity: 0.9;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f9fafb;
}

.message {
  display: flex;
  margin-bottom: 20px;
  gap: 12px;
}

.user-message {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar {
  background: #3b82f6;
}

.message-content {
  flex: 1;
  max-width: 80%;
}

.message-text {
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  line-height: 1.6;
  font-size: 14px;
}

.user-message .message-text {
  background: #3b82f6;
  color: white;
}

.message-analyzing {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-selectors {
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.selectors-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.selectors-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.selectors-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.selector-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 8px;
}

.selector-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.selectors-actions {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.message-error {
  padding: 0;
}

.input-container {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.input-container textarea {
  flex: 1;
}

/* 右侧预览区 */
.preview-panel {
  width: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-panel :deep(.ant-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-panel :deep(.ant-tabs-content-holder) {
  flex: 1;
  overflow: auto;
}

.preview-panel :deep(.ant-tabs-tabpane) {
  height: 100%;
}

.webpage-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.preview-url {
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.preview-content {
  flex: 1;
  background: white;
}

.preview-content iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.selectors-visualization {
  padding: 16px;
}

.vis-header {
  margin-bottom: 16px;
}

.vis-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.vis-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vis-item {
  padding: 12px;
  background: #f3f4f6;
  border-radius: 8px;
}

.vis-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.vis-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-preview {
  padding: 16px;
}

.table-link {
  color: #3b82f6;
  text-decoration: none;
  word-break: break-all;
  font-size: 13px;
  transition: color 0.2s;
}

.table-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* 滚动条样式 */
.messages-container::-webkit-scrollbar,
.preview-panel :deep(.ant-tabs-content-holder)::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track,
.preview-panel :deep(.ant-tabs-content-holder)::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb,
.preview-panel :deep(.ant-tabs-content-holder)::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover,
.preview-panel :deep(.ant-tabs-content-holder)::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
