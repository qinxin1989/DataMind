<template>
  <div class="chat-view">
    <div class="chat-container">
      <!-- 消息区域 -->
      <div class="chat-messages" ref="chatScrollRef">
        <div v-if="chatHistory.length === 0" class="chat-empty">
          <div class="empty-hero">
            <div class="hero-icon"><RobotOutlined /></div>
            <h2>我是您的知识助手</h2>
            <p>您可以问我关于已导入知识库的任何问题，我将基于事实为您解答。</p>
          </div>
          <div class="suggested-questions">
            <div v-for="q in suggestedQuestions" :key="q" class="suggest-chip" @click="askQuestion(q)">
              {{ q }}
            </div>
          </div>
        </div>
        
        <div v-for="(msg, idx) in chatHistory" :key="idx" class="message-wrapper" :class="msg.role">
          <div class="message-avatar">
            <UserOutlined v-if="msg.role === 'user'" />
            <RobotOutlined v-else />
          </div>
          <div class="message-content">
            <div class="message-bubble">
              <div v-if="msg.role === 'assistant' && msg.loading" class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
              <div v-else class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
            </div>
            
            <!-- 引用来源展示 -->
            <div v-if="msg.sources?.length" class="message-sources">
              <div class="source-header"><FileTextOutlined /> 找到 {{ msg.sources.length }} 个参考来源</div>
              <div class="source-chips">
                <div v-for="src in msg.sources" :key="src.id" class="source-chip" @click="$emit('viewSource', src.documentId)">
                  {{ src.title }}
                </div>
              </div>
            </div>

            <div class="message-footer" v-if="msg.role === 'assistant' && !msg.loading">
              <span class="confidence-tag" :style="{ color: getConfidenceColor(msg.confidence || 0) }">
                置信度: {{ Math.round((msg.confidence || 0) * 100) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input-area">
        <div class="input-wrapper">
          <div class="qa-config-bar">
            <a-cascader
              v-model:value="qaScope"
              :options="qaScopeOptions"
              placeholder="所有知识库"
              size="small"
              class="mini-cascader"
            />
            <div class="divider"></div>
            <a-select v-model:value="ragDatasourceId" placeholder="关联数据源" size="small" allow-clear class="mini-select">
              <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">
                {{ ds.name }}
              </a-select-option>
            </a-select>
          </div>
          <div class="input-container">
            <a-textarea
              v-model:value="ragQuestion"
              placeholder="输入您的问题 (Shift + Enter 换行)..."
              :auto-size="{ minRows: 1, maxRows: 6 }"
              @pressEnter="handleChatEnter"
              class="chat-input"
            />
            <a-button 
              type="primary" 
              class="send-btn" 
              :loading="ragLoading"
              @click="handleRAGAsk"
            >
              <SendOutlined />
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  RobotOutlined, UserOutlined, SendOutlined, FileTextOutlined 
} from '@ant-design/icons-vue'
import { aiPost } from '@/api/request'
import { 
  datasources, qaScopeOptions, renderMarkdown, getConfidenceColor,
  loadDatasources, type ChatMessage
} from './shared'

const emit = defineEmits(['viewSource'])

// 状态
const chatScrollRef = ref<HTMLElement | null>(null)
const chatHistory = ref<ChatMessage[]>([])
const ragQuestion = ref('')
const ragLoading = ref(false)
const ragDatasourceId = ref<string>()
const qaScope = ref<string[]>(['all'])

const suggestedQuestions = [
  "本知识库包含哪些主要内容？",
  "如何接入新的数据源？",
  "最新的 API 文档在哪里查看？",
  "数据隐私安全是如何保障的？"
]

function scrollToBottom() {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

function handleChatEnter(e: KeyboardEvent) {
  if (!e.shiftKey) {
    e.preventDefault()
    handleRAGAsk()
  }
}

function askQuestion(q: string) {
  ragQuestion.value = q
  handleRAGAsk()
}

async function handleRAGAsk() {
  if (ragLoading.value) return
  const q = ragQuestion.value.trim()
  if (!q) {
    message.warning('请输入问题')
    return
  }

  // 添加用户消息
  chatHistory.value.push({
    role: 'user',
    content: q,
    time: Date.now()
  })
  
  ragQuestion.value = ''
  scrollToBottom()

  // 添加助手加载消息
  const loadingMsg: ChatMessage = {
    role: 'assistant',
    content: '',
    loading: true,
    time: Date.now()
  }
  chatHistory.value.push(loadingMsg)
  scrollToBottom()

  ragLoading.value = true
  
  try {
    const scope = qaScope.value
    let categoryId: string | undefined
    let documentId: string | undefined

    if (scope && scope.length > 0 && scope[0] !== 'all') {
      categoryId = scope[0]
      if (scope.length > 1) {
        documentId = scope[1]
      }
    }

    const res = await aiPost<any>('/admin/ai-qa/rag/ask', { 
      question: q,
      datasourceId: ragDatasourceId.value,
      categoryId,
      documentId
    })

    const lastMsg = chatHistory.value[chatHistory.value.length - 1]
    lastMsg.loading = false
    
    if (res.success) {
      lastMsg.content = res.data.answer
      lastMsg.confidence = res.data.confidence
      lastMsg.sources = res.data.sources
      lastMsg.dataContext = res.data.dataContext
    } else {
      lastMsg.content = `抱歉，遇到了一些问题：${res.error?.message || '未知错误'}`
    }

  } catch (e) {
    const lastMsg = chatHistory.value[chatHistory.value.length - 1]
    lastMsg.loading = false
    lastMsg.content = '网络请求失败，请稍后重试。'
  } finally {
    ragLoading.value = false
    scrollToBottom()
  }
}

onMounted(() => {
  loadDatasources()
})
</script>

<style scoped>
.chat-view {
  height: 100%;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-container);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  scroll-behavior: smooth;
  background: var(--bg-container);
}

.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-hero {
  text-align: center;
  margin-bottom: 40px;
}

.hero-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--primary-bg-light) 0%, #e9d5ff 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: var(--primary-color);
  margin: 0 auto 24px;
}

.empty-hero h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-hero p {
  color: var(--text-tertiary);
  font-size: 16px;
}

.suggested-questions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  max-width: 600px;
}

.suggest-chip {
  padding: 8px 16px;
  background: var(--bg-page);
  border: 1px solid var(--border-color-light);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.suggest-chip:hover {
  background: var(--primary-bg-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.message-wrapper {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.assistant .message-avatar {
  background: var(--primary-bg-light);
  color: var(--primary-color);
}

.user .message-avatar {
  background: var(--bg-page);
  color: var(--text-secondary);
}

.message-content {
  max-width: 80%;
}

.message-bubble {
  padding: 16px 20px;
  border-radius: 16px;
  line-height: 1.6;
  font-size: 15px;
}

.assistant .message-bubble {
  background: var(--bg-page);
  color: var(--text-primary);
  border-top-left-radius: 2px;
}

.user .message-bubble {
  background: var(--primary-color);
  color: white;
  border-top-right-radius: 2px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
}

.message-sources {
  margin-top: 12px;
  background: var(--bg-page);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color-light);
}

.source-header {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.source-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-chip {
  font-size: 12px;
  background: var(--bg-container);
  border: 1px solid var(--border-color-light);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.source-chip:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.message-footer {
  margin-top: 4px;
  font-size: 12px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #ccc;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.chat-input-area {
  padding: 24px;
  background: var(--bg-container);
  border-top: 1px solid var(--border-color-light);
}

.input-wrapper {
  max-width: 900px;
  margin: 0 auto;
  border: 1px solid var(--border-color-base);
  border-radius: 12px;
  padding: 12px 16px;
  background: var(--bg-container);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s;
}

.input-wrapper:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.1);
}

.qa-config-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border-color-light);
}

.mini-cascader, .mini-select {
  width: 140px;
  font-size: 12px;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border-color-light);
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.chat-input {
  flex: 1;
  border: none !important;
  box-shadow: none !important;
  padding: 0;
  font-size: 14px;
  resize: none;
  background: transparent;
  color: var(--text-primary);
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
