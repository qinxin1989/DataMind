<template>
  <div class="crawler-assistant">
    <!-- 左侧对话区 -->
    <div class="chat-panel">
      <div class="chat-header">
        <div class="header-top">
          <h2>AI 爬虫助手</h2>
          <div class="header-actions">
            <a-button @click="conversationsVisible = true">
              <template #icon><HistoryOutlined /></template>
              历史对话
            </a-button>
            <a-button type="primary" @click="handleNewConversation">
              <template #icon><PlusOutlined /></template>
              新建对话
            </a-button>
          </div>
        </div>
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
        <div v-for="(msg, index) in messages" :key="msg.id || index" :class="['message', msg.role === 'user' ? 'user-message' : 'ai-message']">
          <div v-if="msg.role === 'ai'" class="message-avatar">
            <span class="ai-avatar">🤖</span>
          </div>
          <div class="message-content">
            <div v-if="msg.type === 'text'" class="message-text" v-html="msg.content" @click="handleLinkClick($event)"></div>
            <div v-else-if="msg.type === 'analyzing'" class="message-analyzing">
              <a-spin :spinning="true" />
              <span>正在分析网页结构...</span>
            </div>
            <div v-else-if="msg.type === 'selectors'" class="message-selectors">
              <div class="selectors-header">
                <h4>✅ 识别结果</h4>
                <a-button size="small" @click="handleEditSelectors">编辑</a-button>
              </div>

              <!-- 网站信息 -->
              <div class="site-info-box">
                <div class="info-item">
                  <span class="info-label">网址:</span>
                  <a class="info-value info-link" :href="msg.content.url" target="_blank">{{ truncateUrl(msg.content.url) }}</a>
                </div>
                <div v-if="msg.content.department" class="info-item">
                  <span class="info-label">识别部门:</span>
                  <a-tag color="orange">{{ msg.content.department }}</a-tag>
                </div>
                <div v-if="msg.content.confidence" class="info-item">
                  <span class="info-label">置信度:</span>
                  <a-tag :color="msg.content.confidence >= 80 ? 'green' : msg.content.confidence >= 60 ? 'orange' : 'red'">
                    {{ msg.content.confidence }}%
                  </a-tag>
                </div>
                <div v-if="msg.content.pageType" class="info-item">
                  <span class="info-label">页面类型:</span>
                  <a-tag :color="msg.content.pageType === 'dynamic' ? 'purple' : 'blue'">
                    {{ msg.content.pageType === 'dynamic' ? '动态页面' : '静态页面' }}
                  </a-tag>
                </div>
              </div>

              <!-- 选择器配置 -->
              <div class="selectors-header" style="margin-top: 16px;">
                <h4>CSS选择器</h4>
              </div>
              <div class="selectors-list">
                <!-- 容器选择器 -->
                <div v-if="msg.content.selectors.container" class="selector-item">
                  <div class="selector-label">container</div>
                  <a-tag color="blue" style="font-family: monospace;">{{ msg.content.selectors.container }}</a-tag>
                </div>
                <!-- 字段选择器 -->
                <template v-if="msg.content.selectors.fields">
                  <div v-for="(selector, fieldName) in msg.content.selectors.fields" :key="fieldName" class="selector-item">
                    <div class="selector-label">{{ fieldName }}</div>
                    <a-tag color="cyan" style="font-family: monospace;">{{ selector }}</a-tag>
                  </div>
                </template>
                <!-- 其他可能的顶级字段 -->
                <template v-for="(val, key) in msg.content.selectors" :key="key">
                  <div v-if="key !== 'container' && key !== 'fields' && typeof val === 'string'" class="selector-item">
                    <div class="selector-label">{{ key }}</div>
                    <a-tag color="blue" style="font-family: monospace;">{{ val }}</a-tag>
                  </div>
                </template>
              </div>

              <div class="selectors-actions">
                <a-space>
                  <a-button type="primary" size="small" @click="handlePreviewSelectors(msg.content)">预览数据</a-button>
                  <a-button size="small" @click="handleSaveTemplate">保存为模板</a-button>
                </a-space>
              </div>

              <!-- 快捷追问按钮 -->
              <div class="quick-questions">
                <div class="quick-questions-label">💬 您可能想问：</div>
                <div class="quick-questions-buttons">
                  <a-button
                    v-for="(question, qIdx) in getQuickQuestions(msg)"
                    :key="qIdx"
                    size="small"
                    type="link"
                    @click="handleQuickQuestion(msg.id!, question)"
                  >
                    {{ question }}
                  </a-button>
                </div>
              </div>
            </div>
            <div v-else-if="msg.type === 'error'" class="message-error">
              <a-alert :message="msg.content" type="error" />
            </div>

            <!-- 追问回复 -->
            <div v-if="msg.parentId && getParentMessage(msg.parentId)" class="message-context">
              <a-tag color="blue" size="small">↩️ 回复上条消息</a-tag>
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
          <div class="webpage-preview-wrapper" style="height: 100%; display: flex; flex-direction: column; min-height: 500px;">
            <WebpagePreview 
              v-if="targetUrl && userStore.token" 
              ref="webpagePreviewRef"
              :url="targetUrl"
              :token="userStore.token || undefined"
              @elementSelected="handleElementSelected"
            />
            <a-empty v-else description="暂无预览，请在对话中发送网址" />
          </div>
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
      width="900px"
      @ok="handleSaveEditedSelectors"
    >
      <a-alert 
        message="选择器编辑说明" 
        description="请输入 CSS 选择器。例如：container='tr' 表示每行数据，fields.title='td:nth-child(1)' 表示第一列是标题"
        type="info" 
        show-icon
        style="margin-bottom: 16px"
      />
      <a-form :model="editedSelectors" layout="vertical">
        <a-form-item label="容器选择器（重复行的容器，如 tr 或 li）">
          <a-input 
            v-model:value="editedSelectors.container" 
            placeholder="例如：tr 或 li 或 .item"
          />
        </a-form-item>
        
        <a-divider>字段选择器</a-divider>
        
        <a-form-item label="标题选择器">
          <a-input 
            v-model:value="editedSelectors.fields.title" 
            placeholder="例如：td:nth-child(1) 或 .title 或 a"
          />
        </a-form-item>
        
        <a-form-item label="链接选择器">
          <a-input 
            v-model:value="editedSelectors.fields.link" 
            placeholder="例如：a::attr(href) 或 td:nth-child(2) a"
          />
        </a-form-item>
        
        <a-form-item label="发布日期选择器">
          <a-input 
            v-model:value="editedSelectors.fields.date" 
            placeholder="例如：td:nth-child(3) 或 .date 或 span.time"
          />
        </a-form-item>
        
        <template v-for="(_, fieldName) in editedSelectors.fields" :key="fieldName">
          <a-form-item 
            v-if="fieldName !== 'title' && fieldName !== 'link' && fieldName !== 'date'"
            :label="`${fieldName} 选择器`"
          >
            <a-input v-model:value="editedSelectors.fields[fieldName]" />
          </a-form-item>
        </template>
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

    <!-- 对话历史抽屉 -->
    <a-drawer
      v-model:open="conversationsVisible"
      title="对话历史"
      placement="right"
      width="400"
    >
      <a-list :data-source="conversations" :loading="false">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #title>
                <a @click="loadConversation(item.id)">{{ item.title }}</a>
              </template>
              <template #description>
                {{ formatDate(item.updated_at) }}
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-popconfirm
                title="确定删除此对话？"
                @confirm="deleteConversation(item.id)"
              >
                <a-button type="text" danger size="small">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { HistoryOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import WebpagePreview from '@/components/crawler/WebpagePreview.vue'

const userStore = useUserStore()
const router = useRouter()

interface Message {
  role: 'user' | 'ai'
  type: 'text' | 'analyzing' | 'selectors' | 'error'
  content: any
  id?: string
  parentId?: string // 父消息ID，用于对话上下文
  timestamp?: number
}

const messages = ref<Message[]>([])
const inputMessage = ref('')
const isAnalyzing = ref(false)
const messagesContainer = ref<HTMLElement>()

const isSending = ref(false)
let currentChatAbortController: AbortController | null = null

// 最近分析的 URL 缓存（避免 10 秒内重复分析）
const recentAnalysisCache = new Map<string, number>()
const ANALYSIS_CACHE_TTL = 10000 // 10秒

// 清理过期缓存
function cleanAnalysisCache() {
  const now = Date.now()
  for (const [url, timestamp] of recentAnalysisCache.entries()) {
    if (now - timestamp > ANALYSIS_CACHE_TTL) {
      recentAnalysisCache.delete(url)
    }
  }
}

// 生成唯一ID（使用更高精度的时间戳和随机数）
function generateId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 11)
  const random2 = Math.random().toString(36).substring(2, 5)
  return `msg_${timestamp}_${random}_${random2}`
}

// 预览相关
const activePreviewTab = ref('webpage')
const previewUrl = ref('')
const iframeLoading = ref(false)
const currentSelectors = ref<any>(null)
const previewData = ref<any[]>([])
const previewColumns = ref<any[]>([])
const targetUrl = ref('')
const webpagePreviewRef = ref(null)

// 预览防重锁
const isPreviewing = ref(false)

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

// 对话历史相关
const conversations = ref<any[]>([])
const currentConversationId = ref<string | null>(null)
const conversationsVisible = ref(false)
let saveTimer: any = null

// 加载对话列表
async function loadConversations() {
  try {
    const res = await aiApi.getCrawlerConversations()
    if (res.success && res.data) {
      conversations.value = res.data
    }
  } catch (error) {
    console.error('加载对话列表失败:', error)
  }
}

// 加载最新对话
async function loadLatestConversation() {
  try {
    const res = await aiApi.getLatestCrawlerConversation()
    if (res.success && res.data) {
      currentConversationId.value = res.data.id
      messages.value = res.data.messages || []
      await nextTick()
      scrollToBottom()
    }
  } catch (error) {
    console.error('加载最新对话失败:', error)
  }
}

// 新建对话
async function handleNewConversation() {
  try {
    // 如果当前有对话且有消息，先保存
    if (currentConversationId.value && messages.value.length > 0) {
      await saveCurrentConversation()
    }
    
    // 创建新对话
    const res = await aiApi.createCrawlerConversation({
      title: '新对话',
      messages: []
    })
    
    if (res.success && res.data) {
      currentConversationId.value = res.data.id
      messages.value = []
      message.success('已创建新对话')
    }
  } catch (error) {
    message.error('创建对话失败')
  }
}

// 保存当前对话
async function saveCurrentConversation() {
  if (!currentConversationId.value) return
  
  try {
    // 生成标题（使用第一条用户消息）
    const firstUserMsg = messages.value.find(m => m.role === 'user')
    const title = firstUserMsg ? 
      firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 
      '新对话'
    
    await aiApi.updateCrawlerConversation(currentConversationId.value, {
      title,
      messages: messages.value
    })
  } catch (error) {
    console.error('保存对话失败:', error)
  }
}

// 加载指定对话
async function loadConversation(id: string) {
  try {
    const res = await aiApi.getCrawlerConversation(id)
    if (res.success && res.data) {
      currentConversationId.value = res.data.id
      messages.value = res.data.messages || []
      conversationsVisible.value = false
      await nextTick()
      scrollToBottom()
    }
  } catch (error) {
    message.error('加载对话失败')
  }
}

// 删除对话
async function deleteConversation(id: string) {
  try {
    await aiApi.deleteCrawlerConversation(id)
    message.success('删除成功')
    loadConversations()
    
    // 如果删除的是当前对话，创建新对话
    if (id === currentConversationId.value) {
      handleNewConversation()
    }
  } catch (error) {
    message.error('删除失败')
  }
}

// 格式化日期
function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return days + '天前'
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

// 在组件挂载时加载最新对话
onMounted(async () => {
  await loadLatestConversation()
  await loadConversations()
})

// 监听消息变化，自动保存
watch(messages, () => {
  if (currentConversationId.value && messages.value.length > 0) {
    // 防抖保存
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveCurrentConversation()
    }, 2000)
  }
}, { deep: true })

// 处理消息内的链接点击
function handleLinkClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('a')
  if (link && link.hasAttribute('data-path')) {
    e.preventDefault()
    const path = link.getAttribute('data-path')
    if (path) router.push(path)
  }
}

// 发送消息
async function handleSend(parentMsgId?: string) {
  if (isSending.value) return
  const content = inputMessage.value.trim()
  if (!content) return

  // 清理过期缓存
  cleanAnalysisCache()

  // 检查是否是重复分析（10秒内同一URL）
  const urlMatches = content.match(/https?:\/\/[^\s]+/)
  if (urlMatches && urlMatches[0]) {
    const url = urlMatches[0]
    const lastAnalysisTime = recentAnalysisCache.get(url)
    if (lastAnalysisTime && Date.now() - lastAnalysisTime < ANALYSIS_CACHE_TTL) {
      message.warning('该网址刚刚分析过，请稍等 10 秒后再试')
      return
    }
    // 记录本次分析时间
    recentAnalysisCache.set(url, Date.now())
  }

  isSending.value = true

  if (currentChatAbortController) {
    try {
      currentChatAbortController.abort()
    } catch (e) {
    }
    currentChatAbortController = null
  }

  // 确保有当前对话ID
  if (!currentConversationId.value) {
    try {
      const res = await aiApi.createCrawlerConversation({
        title: content.substring(0, 20) || '新对话',
        messages: []
      })
      if (res.success && res.data) {
        currentConversationId.value = res.data.id
      }
    } catch (e) {
      console.error('创建对话失败', e)
    }
  }

  // 尝试从输入中提取URL以更新预览
  const urlMatchForPreview = content.match(/https?:\/\/[^\s]+/)
  if (urlMatchForPreview && urlMatchForPreview[0]) {
    targetUrl.value = urlMatchForPreview[0]
  }

  const userMsgId = generateId()

  // 添加用户消息
  messages.value.push({
    id: userMsgId,
    role: 'user',
    type: 'text',
    content,
    parentId: parentMsgId,
    timestamp: Date.now()
  })
  inputMessage.value = ''

  // 滚动到底部
  await nextTick()
  scrollToBottom()

  // 开始处理
  isAnalyzing.value = true
  const analyzingMsgId = generateId()
  messages.value.push({
    id: analyzingMsgId,
    role: 'ai',
    type: 'analyzing',
    content: null,
    parentId: userMsgId,
    timestamp: Date.now()
  })
  await nextTick()
  scrollToBottom()

  try {
    // 准备上下文消息（最近15条）
    const contextMessages = messages.value
      .filter(m => m.type !== 'analyzing')
      .slice(-15)
      .map(m => ({
        role: m.role,
        content: m.type === 'selectors' ? 
          `已分析网址: ${m.content.url}, 选择器配置: ${JSON.stringify(m.content.selectors)}` : 
          String(m.content)
      }))

    // 调用智能爬虫对话接口 (流式输出，逐个确认)
    const token = userStore.token || localStorage.getItem('token')
    currentChatAbortController = new AbortController()
    const response = await fetch('/api/admin/ai/crawler/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: currentChatAbortController.signal,
      body: JSON.stringify({
        messages: contextMessages,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('ReadableStream not supported')

    const decoder = new TextDecoder()
    let buffer = ''
    
    // 移除分析中占位
    messages.value = messages.value.filter(m => m.id !== analyzingMsgId)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim()
          if (!dataStr) continue
          
          try {
            const data = JSON.parse(dataStr)
            
            if (data.type === 'done') {
              console.log('[CrawlerAssistant] Streaming completed')
              continue
            }

            if (data.type === 'error') {
              messages.value.push({
                id: generateId(),
                role: 'ai',
                type: 'error',
                content: data.content,
                parentId: userMsgId,
                timestamp: Date.now()
              })
              continue
            }

            if (data.type === 'text') {
              messages.value.push({
                id: generateId(),
                role: 'ai',
                type: 'text',
                content: data.content,
                parentId: userMsgId,
                timestamp: Date.now()
              })
              continue
            }

            if (data.type === 'result') {
              const res = data.content
              if (res.error) {
                messages.value.push({
                  id: generateId(),
                  role: 'ai',
                  type: 'error',
                  content: `网址 ${res.url} 分析失败: ${res.error}`,
                  parentId: userMsgId,
                  timestamp: Date.now()
                })
              } else {
                let url = res.url
                // 如果AI未返回URL，尝试使用上下文中提取的URL
                if (!url && targetUrl.value) {
                  url = targetUrl.value
                }
                if (url) targetUrl.value = url
                
                // 设置为当前预览
                iframeLoading.value = true
                previewUrl.value = `/api/admin/ai/crawler/proxy?url=${encodeURIComponent(url)}${token ? `&token=${token}` : ''}`
                currentSelectors.value = res.selectors

                messages.value.push({
                  id: generateId(),
                  role: 'ai',
                  type: 'selectors',
                  content: {
                    url,
                    selectors: res.selectors,
                    department: res.department,
                    confidence: res.confidence,
                    pageType: res.pageType,
                    preview: res.preview
                  },
                  parentId: userMsgId,
                  timestamp: Date.now()
                })

                // 如果有预览数据，更新表格
                if (res.preview && res.preview.length > 0) {
                  // 只保留标题、链接、发布日期三个字段
                  const filteredData = res.preview.map((item: any) => {
                    const filtered: any = {}
                    
                    // 查找标题字段
                    const titleKey = Object.keys(item).find(k => 
                      k.toLowerCase().includes('title') || 
                      k.toLowerCase().includes('标题') ||
                      k.toLowerCase().includes('name') ||
                      k.toLowerCase().includes('名称')
                    )
                    if (titleKey) filtered['标题'] = item[titleKey]
                    
                    // 查找链接字段
                    const linkKey = Object.keys(item).find(k => 
                      k.toLowerCase().includes('link') || 
                      k.toLowerCase().includes('url') ||
                      k.toLowerCase().includes('href') ||
                      k.toLowerCase().includes('链接')
                    )
                    if (linkKey) filtered['链接'] = item[linkKey]
                    
                    // 查找发布日期字段
                    const dateKey = Object.keys(item).find(k => 
                      k.toLowerCase().includes('date') || 
                      k.toLowerCase().includes('time') ||
                      k.toLowerCase().includes('发布') ||
                      k.toLowerCase().includes('日期') ||
                      k.toLowerCase().includes('时间')
                    )
                    if (dateKey) filtered['发布日期'] = item[dateKey]
                    
                    return filtered
                  })
                  
                  previewData.value = filteredData
                  previewColumns.value = [
                    { title: '标题', dataIndex: '标题', key: '标题', ellipsis: true, width: '40%' },
                    { title: '链接', dataIndex: '链接', key: '链接', ellipsis: true, width: '35%' },
                    { title: '发布日期', dataIndex: '发布日期', key: '发布日期', ellipsis: true, width: '25%' }
                  ]
                  activePreviewTab.value = 'data'
                }
              }
              // 自动滚动到底部
              nextTick(() => {
                const container = document.querySelector('.messages-container')
                if (container) container.scrollTop = container.scrollHeight
              })
            }
          } catch (e) {
            console.error('[CrawlerAssistant] Failed to parse SSE chunk:', dataStr, e)
          }
        }
      }
    }
  } catch (error: any) {
    messages.value = messages.value.filter(m => m.id !== analyzingMsgId)
    messages.value.push({
      id: generateId(),
      role: 'ai',
      type: 'error',
      content: error?.name === 'AbortError' ? '请求已取消' : `系统异常: ${error.message || '未知错误'}`,
      parentId: userMsgId,
      timestamp: Date.now()
    })
  } finally {
    isAnalyzing.value = false
    isSending.value = false
    currentChatAbortController = null
    nextTick(() => {
      const container = document.querySelector('.messages-container')
      if (container) container.scrollTop = container.scrollHeight
    })
  }
}

function handleElementSelected(selector: string) {
  message.success('已捕获选择器')
  inputMessage.value = `我选择了页面元素: ${selector}，请帮我分析`
}

// 获取快捷追问问题
function getQuickQuestions(msg: Message): string[] {
  if (msg.type === 'selectors') {
    const questions = [
      '只抓取前10条数据',
      '同时抓取所有分页',
      '帮我提取发布日期字段',
      '检查选择器是否正确'
    ]
    return questions
  }
  return []
}

// 处理快捷提问
async function handleQuickQuestion(parentMsgId: string, question: string) {
  inputMessage.value = question
  await handleSend(parentMsgId)
}

// 获取父消息
function getParentMessage(parentId: string): Message | undefined {
  return messages.value.find(m => m.id === parentId)
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
  if (isPreviewing.value) return
  isPreviewing.value = true
  
  try {
    // 确保有URL
    const url = content.url || targetUrl.value

    console.log('=== 预览数据开始 ===')
    console.log('URL:', url)
    console.log('选择器:', JSON.stringify(content.selectors, null, 2))
    
    if (!url) {
      message.error('无法预览：缺少URL')
      return
    }
    
    const response = await aiApi.previewCrawler(url, content.selectors)
    console.log('预览响应:', response)
    
    if (response.success && response.data) {
      // 处理响应格式：可能是 { data: [...], total, ... } 或直接是数组
      let dataArray = Array.isArray(response.data) ? response.data : (response.data.data || [])
      
      console.log('提取的数据数组:', dataArray)
      console.log('数据条数:', dataArray.length)
      
      // 只保留标题、链接、发布日期三个字段
      const filteredData = dataArray.map((item: any) => {
        const filtered: any = {}
        
        // 查找标题字段（可能的名称）
        const titleKey = Object.keys(item).find(k => 
          k.toLowerCase().includes('title') || 
          k.toLowerCase().includes('标题') ||
          k.toLowerCase().includes('name') ||
          k.toLowerCase().includes('名称')
        )
        if (titleKey) filtered['标题'] = item[titleKey]
        
        // 查找链接字段（可能的名称）
        const linkKey = Object.keys(item).find(k => 
          k.toLowerCase().includes('link') || 
          k.toLowerCase().includes('url') ||
          k.toLowerCase().includes('href') ||
          k.toLowerCase().includes('链接')
        )
        if (linkKey) filtered['链接'] = item[linkKey]
        
        // 查找发布日期字段（可能的名称）
        const dateKey = Object.keys(item).find(k => 
          k.toLowerCase().includes('date') || 
          k.toLowerCase().includes('time') ||
          k.toLowerCase().includes('发布') ||
          k.toLowerCase().includes('日期') ||
          k.toLowerCase().includes('时间')
        )
        if (dateKey) filtered['发布日期'] = item[dateKey]
        
        return filtered
      })
      
      previewData.value = filteredData
      
      if (previewData.value.length > 0) {
        // 只显示标题、链接、发布日期三列
        previewColumns.value = [
          { title: '标题', dataIndex: '标题', key: '标题', ellipsis: true, width: '40%' },
          { title: '链接', dataIndex: '链接', key: '链接', ellipsis: true, width: '35%' },
          { title: '发布日期', dataIndex: '发布日期', key: '发布日期', ellipsis: true, width: '25%' }
        ]
        activePreviewTab.value = 'data'
        message.success(`预览数据已更新 (${previewData.value.length} 条)`)
      } else {
        message.warning('预览数据为空，请检查选择器是否正确')
      }
    } else {
      message.error('预览失败: ' + (response.error?.message || '未知错误'))
    }
    console.log('=== 预览数据结束 ===')
  } catch (error: any) {
    console.error('预览异常:', error)
    message.error('预览失败: ' + (error.message || '未知错误'))
  } finally {
    isPreviewing.value = false
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
    // 构造符合 crawler-template-config 模块要求的请求体
    const payload = {
      name: templateForm.value.name,
      description: templateForm.value.description,
      url: lastSelectorMsg.content.url,
      department: templateForm.value.department,
      dataType: templateForm.value.dataType, 
      containerSelector: lastSelectorMsg.content.selectors.container,
      fields: lastSelectorMsg.content.selectors.fields,
      // 保留 selectors 以防万一，但主要依赖上述字段
      selectors: lastSelectorMsg.content.selectors
    };
    
    console.log('[AI Assistant] Saving template with payload:', payload);

    const response = await aiApi.saveCrawlerTemplate(payload as any)

    if (response.success) {
      message.success('模板保存成功！')
      saveModalVisible.value = false

      // 添加成功消息，包含跳转链接
      messages.value.push({
        role: 'ai',
        type: 'text',
        content: `✅ 模板"${templateForm.value.name}"已保存成功！<br><br>
          <div style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-left: 3px solid #1890ff; border-radius: 4px;">
            <div style="margin-bottom: 8px;">📋 您可以在以下位置管理此模板：</div>
            <div style="display: flex; gap: 8px;">
              <a href="javascript:;" data-path="/ai/crawler-template-config" style="color: #1890ff; text-decoration: none; font-weight: 500;">
                → 采集模板配置
              </a>
              <span style="color: #999;">|</span>
              <a href="javascript:;" data-path="/ai/crawler" style="color: #1890ff; text-decoration: none; font-weight: 500;">
                → 爬虫管理
              </a>
            </div>
          </div>`
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

// 截断URL显示
function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength) + '...'
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

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .ant-btn {
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
}

.header-actions .ant-btn:hover {
  border-color: white;
  background: rgba(255, 255, 255, 0.2);
}

.header-actions .ant-btn-primary {
  background: rgba(255, 255, 255, 0.2);
  border-color: white;
}

.header-actions .ant-btn-primary:hover {
  background: rgba(255, 255, 255, 0.3);
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

.input-container .ant-btn-primary {
  color: white;
}

/* 右侧预览区 */
.preview-panel {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 600px;
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
  width: 100%;
}

.webpage-preview {
  height: 100%;
  width: 100%;
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

/* 快捷追问样式 */
.quick-questions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}

.quick-questions-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  font-weight: 500;
}

.quick-questions-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-questions-buttons .ant-btn-link {
  padding: 4px 8px;
  font-size: 12px;
  height: auto;
  color: #3b82f6;
  background: #eff6ff;
  border-radius: 4px;
  transition: all 0.2s;
}

.quick-questions-buttons .ant-btn-link:hover {
  background: #3b82f6;
  color: white;
}

/* 消息上下文标签 */
.message-context {
  margin-top: 8px;
  font-size: 12px;
}
</style>
