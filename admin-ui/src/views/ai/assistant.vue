<template>
  <div class="assistant-workbench">
    <aside class="assistant-sidebar">
      <section class="panel brand-panel">
        <div class="eyebrow">AI 助理工作台</div>
        <h2>单助手入口</h2>
        <p>保持一条连续会话链路，在这里处理任务、附件、进度、产物和摘要。</p>
        <div class="row">
          <a-button type="primary" :loading="creatingSession" @click="handleCreateSession">
            <PlusOutlined />
            新建对话
          </a-button>
          <a-button :loading="sessionsLoading" @click="reloadSessions()">
            <ReloadOutlined />
          </a-button>
        </div>
      </section>

      <section class="panel sessions-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">会话列表</div>
            <div class="panel-subtitle">像参考项目一样，从左侧管理上下文</div>
          </div>
          <span class="count-pill">{{ sessions.length }}</span>
        </div>

        <div class="session-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{ active: session.id === currentSessionId }"
            tabindex="0"
            @click="openSession(session.id)"
            @keydown.enter="openSession(session.id)"
          >
            <div class="session-top">
              <div class="session-main">
                <span class="session-name">{{ session.name }}</span>
                <span class="session-time">{{ formatSessionTime(session.updatedAt) }}</span>
              </div>
              <div class="row compact">
                <button class="icon-btn" @click.stop="openRenameModal(session)">
                  <EditOutlined />
                </button>
                <button class="icon-btn danger" @click.stop="confirmDeleteSession(session.id, session.name)">
                  <DeleteOutlined />
                </button>
              </div>
            </div>
            <p>{{ session.preview || '还没有消息' }}</p>
            <div class="session-meta">
              <span>{{ session.messageCount }} 条消息</span>
              <span v-if="session.summaryUpdatedAt">已摘要</span>
            </div>
          </div>

          <div v-if="!sessionsLoading && sessions.length === 0" class="empty-tip">
            还没有会话，可以直接新建一个开始。
          </div>
        </div>
      </section>

      <section class="panel legacy-panel">
        <div class="panel-title">旧版 AI 智能问答</div>
        <p>数据源绑定、SQL、图表分析继续走独立页面，不再被统一助手覆盖。</p>
        <router-link class="legacy-link" to="/ai/chat">打开旧版数据问答</router-link>
      </section>
    </aside>

    <section class="panel main-panel">
      <header class="workspace-head">
        <div>
          <div class="eyebrow">Workspace / {{ currentSession?.name || '未选择会话' }}</div>
          <div class="workspace-title">
            <RobotOutlined />
            <span>{{ currentSession?.name || 'AI 助理' }}</span>
          </div>
          <p class="workspace-desc">{{ workspaceSubtitle }}</p>
        </div>

        <div class="row wrap">
          <div class="status-pill" :class="statusState.className">
            <span class="status-dot"></span>
            <span>{{ statusState.label }}</span>
          </div>
          <a-tag color="purple">{{ modeLabelMap[chatMode] }}</a-tag>
          <a-button :disabled="!currentSessionId" :loading="summaryRefreshing" @click="openSummaryModal">
            <FileTextOutlined />
            会话摘要
          </a-button>
          <a-button :disabled="!currentSessionId" @click="openRenameModal()">
            <EditOutlined />
            重命名
          </a-button>
          <a-button :loading="creatingSession" @click="handleCreateSession">
            <ClearOutlined />
            新对话
          </a-button>
          <a-button danger :disabled="!currentSessionId" @click="confirmDeleteCurrentSession">
            <DeleteOutlined />
            删除
          </a-button>
        </div>
      </header>

      <div ref="messageScrollRef" class="conversation-panel">
        <div v-if="hasMoreMessages" class="load-more">
          <button class="link-btn" @click="loadMoreMessages">
            加载更早的消息（剩余 {{ remainingMessageCount }} 条）
          </button>
        </div>

        <div v-if="visibleMessages.length === 0" class="empty-state">
          <div class="empty-icon">
            <RobotOutlined />
          </div>
          <h3>您好，我是您的 AI 助理</h3>
          <p>从左侧切换会话，在下方直接发任务、上传文件，或切换 Standard / Fast / Plan 模式继续处理。</p>
          <div class="chips">
            <button v-for="item in suggestions" :key="item" class="chip" @click="draft = item">
              {{ item }}
            </button>
          </div>
        </div>

        <div v-for="item in visibleMessages" :key="item.id" class="message-row" :class="item.role">
          <div class="message-avatar">
            <UserOutlined v-if="item.role === 'user'" />
            <RobotOutlined v-else />
          </div>

          <div class="message-main-wrap">
            <div class="message-meta">
              <div class="row compact">
                <span>{{ item.role === 'user' ? '你' : 'AI 助理' }}</span>
                <span>{{ formatMessageTime(item.timestamp) }}</span>
              </div>
              <div v-if="item.role === 'assistant' && !item.streaming" class="row compact wrap">
                <button class="text-btn" @click="copyMessagePair(item)">
                  <CopyOutlined />
                  复制这组
                </button>
                <button
                  v-if="typeof item.pairStartIndex === 'number' && typeof item.rawEndIndex === 'number'"
                  class="text-btn danger"
                  @click="deleteMessagePair(item)"
                >
                  <DeleteOutlined />
                  删除这组
                </button>
              </div>
            </div>

            <div class="message-bubble">
              <div v-if="item.streaming && !item.content" class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
              <div v-if="item.content" class="markdown-body" v-html="renderMarkdown(item.content)"></div>
            </div>

            <div v-if="item.progress.length" class="sub-panel">
              <div class="sub-title">处理过程</div>
              <div v-for="(step, index) in item.progress" :key="`${item.id}-progress-${index}`" class="progress-line">
                {{ step }}
              </div>
            </div>

            <div v-if="item.tools.length" class="tool-list">
              <details v-for="tool in item.tools" :key="tool.id" class="tool-block" :open="tool.status === 'error'">
                <summary>
                  <span class="row compact">
                    <CodeOutlined />
                    <span>{{ tool.name }}</span>
                  </span>
                  <span class="tool-status" :class="tool.status">{{ toolStatusLabelMap[tool.status] }}</span>
                </summary>
                <pre>{{ tool.content || '执行中...' }}</pre>
              </details>
            </div>

            <div v-if="item.artifacts.length" class="sub-panel">
              <div class="sub-title">关联文件</div>
              <div class="artifact-list">
                <div v-for="artifact in item.artifacts" :key="artifact.id" class="artifact-item">
                  <div class="artifact-top">
                    <button class="artifact-name" @click="openArtifact(artifact)">
                      {{ artifact.name || fileNameFromPath(artifact.path) }}
                    </button>
                    <div class="row compact wrap">
                      <button v-if="isImageArtifact(artifact)" class="text-btn" @click="previewArtifactFile(artifact)">
                        <EyeOutlined />
                        预览
                      </button>
                      <button class="text-btn" @click="downloadArtifact(artifact)">下载</button>
                    </div>
                  </div>
                  <button v-if="isImageArtifact(artifact)" class="artifact-preview" @click="previewArtifactFile(artifact)">
                    <img :src="buildAssistantArtifactUrl(artifact.path)" :alt="artifact.name || fileNameFromPath(artifact.path)" />
                    <span>点击查看大图</span>
                  </button>
                  <div class="artifact-meta">
                    <span>{{ artifact.direction === 'input' ? '输入文件' : '输出文件' }}</span>
                    <span v-if="artifact.size">{{ formatFileSize(artifact.size) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="composer" @drop.prevent="handleDrop" @dragover.prevent>
        <div v-if="selectedArtifacts.length" class="selected-files">
          <div v-for="artifact in selectedArtifacts" :key="artifact.id" class="selected-file">
            <span>{{ artifact.name || fileNameFromPath(artifact.path) }}</span>
            <button @click="removeSelectedArtifact(artifact.id)">×</button>
          </div>
        </div>

        <a-textarea
          v-model:value="draft"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          placeholder="输入问题、任务说明，或直接结合已上传文件继续执行..."
          @pressEnter="handlePressEnter"
          @paste="handlePaste"
        />

        <div class="composer-bar">
          <div class="row wrap">
            <input ref="fileInputRef" type="file" multiple class="hidden-input" @change="handleFileChange" />
            <button class="tool-btn" :disabled="uploading || sending" @click="openFilePicker">
              <PaperClipOutlined />
              <span>{{ uploading ? '上传中...' : '附件' }}</span>
            </button>
            <a-select v-model:value="chatMode" size="small" class="mode-select">
              <a-select-option value="standard">Standard</a-select-option>
              <a-select-option value="fast">Fast</a-select-option>
              <a-select-option value="plan">Plan</a-select-option>
            </a-select>
            <span class="note">{{ toolbarNote }}</span>
          </div>

          <div class="row wrap">
            <a-button @click="clearComposer">清空</a-button>
            <a-button type="primary" :disabled="!canSend" :loading="sending" @click="handleSend">
              <SendOutlined />
              发送
            </a-button>
          </div>
        </div>
      </footer>
    </section>

    <a-modal v-model:open="renameVisible" title="重命名会话" ok-text="保存" cancel-text="取消" @ok="submitRename">
      <a-input v-model:value="renameDraft" placeholder="请输入新的会话名称" maxlength="60" />
    </a-modal>

    <a-modal
      v-model:open="summaryVisible"
      title="会话摘要"
      width="720px"
      ok-text="更新摘要"
      cancel-text="关闭"
      :confirm-loading="summaryRefreshing"
      @ok="refreshSummary"
    >
      <div class="summary-meta">
        <span>最近更新时间：{{ summaryUpdateText }}</span>
        <span v-if="sessionSummary?.messageCount">覆盖消息：{{ sessionSummary.messageCount }}</span>
      </div>
      <div class="summary-body">
        <div v-if="sessionSummary?.content" class="markdown-body" v-html="renderMarkdown(sessionSummary.content)"></div>
        <div v-else class="empty-tip">暂无摘要，点击“更新摘要”生成。</div>
      </div>
    </a-modal>

    <a-modal v-model:open="previewVisible" :title="previewArtifact?.name || '文件预览'" width="960px" :footer="null" @cancel="closePreview">
      <div v-if="previewArtifact" class="preview-body">
        <img :src="buildAssistantArtifactUrl(previewArtifact.path)" :alt="previewArtifact.name || fileNameFromPath(previewArtifact.path)" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  ClearOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { marked } from 'marked'
import {
  buildAssistantArtifactUrl,
  createAssistantSession,
  deleteAssistantSession,
  deleteAssistantSessionMessages,
  fetchAssistantSessionContext,
  fetchAssistantSessionMessages,
  fetchAssistantSessions,
  renameAssistantSession,
  streamAssistantChat,
  summarizeAssistantSession,
  type AssistantArtifact,
  type AssistantChatMode,
  type AssistantSessionListItem,
  type AssistantSessionRecord,
  type AssistantSessionSummary,
  type AssistantStoredMessage,
  uploadAssistantFiles
} from '@/api/assistant'

interface ToolDisplay {
  id: string
  name: string
  content: string
  status: 'running' | 'done' | 'error'
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  progress: string[]
  tools: ToolDisplay[]
  artifacts: AssistantArtifact[]
  streaming: boolean
  rawStartIndex?: number
  rawEndIndex?: number
  pairStartIndex?: number
  pairQuestion?: string
}

const INITIAL_MESSAGE_LIMIT = 40
const MESSAGE_LOAD_STEP = 30

const route = useRoute()
const router = useRouter()

const suggestions = [
  '先帮我梳理一下这个项目目前的模块边界',
  '读取我刚上传的文件，整理成一份执行提纲',
  '把一个业务需求拆成可落地的步骤和风险点'
]

const modeLabelMap: Record<AssistantChatMode, string> = { standard: 'Standard', fast: 'Fast', plan: 'Plan' }
const toolStatusLabelMap: Record<ToolDisplay['status'], string> = { running: '执行中', done: '已完成', error: '失败' }

const sessions = ref<AssistantSessionListItem[]>([])
const currentSessionId = ref('')
const currentSession = ref<AssistantSessionRecord | null>(null)
const rawMessages = ref<AssistantStoredMessage[]>([])
const sessionSummary = ref<AssistantSessionSummary | null>(null)
const sessionsLoading = ref(false)
const creatingSession = ref(false)
const sending = ref(false)
const uploading = ref(false)
const summaryVisible = ref(false)
const summaryRefreshing = ref(false)
const renameVisible = ref(false)
const previewVisible = ref(false)
const renameDraft = ref('')
const renameTargetSessionId = ref('')
const draft = ref('')
const chatMode = ref<AssistantChatMode>('standard')
const selectedArtifacts = ref<AssistantArtifact[]>([])
const previewArtifact = ref<AssistantArtifact | null>(null)
const messageRenderLimit = ref(INITIAL_MESSAGE_LIMIT)
const pendingUserMessage = ref<DisplayMessage | null>(null)
const streamingAssistant = ref<DisplayMessage | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const messageScrollRef = ref<HTMLElement | null>(null)

const workspaceSubtitle = computed(() => {
  if (!currentSession.value) return '用一条连续会话处理任务、附件和结果文件，旧版数据问答保持独立。'
  return sessionSummary.value?.content
    ? `当前会话共有 ${rawMessages.value.length} 条原始消息，已保留摘要上下文。`
    : `当前会话共有 ${rawMessages.value.length} 条原始消息，还可以随时生成摘要。`
})

const toolbarNote = computed(() => {
  if (selectedArtifacts.value.length) return `已附加 ${selectedArtifacts.value.length} 个文件，本轮会优先读取这些文件。`
  if (uploading.value) return '正在上传文件...'
  return '支持点击上传，也支持直接拖拽或粘贴文件到输入区。'
})

const summaryUpdateText = computed(() => sessionSummary.value?.updatedAt ? dayjs(sessionSummary.value.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '暂无')
const canSend = computed(() => !sending.value && Boolean(draft.value.trim()))
const normalizedMessages = computed(() => normalizeMessages(rawMessages.value))
const displayMessages = computed<DisplayMessage[]>(() => {
  const base = normalizedMessages.value.map((item) => ({ ...item, progress: [...item.progress], tools: item.tools.map((tool) => ({ ...tool })), artifacts: [...item.artifacts] }))
  if (pendingUserMessage.value) base.push({ ...pendingUserMessage.value, progress: [...pendingUserMessage.value.progress], tools: pendingUserMessage.value.tools.map((tool) => ({ ...tool })), artifacts: [...pendingUserMessage.value.artifacts] })
  if (streamingAssistant.value) base.push({ ...streamingAssistant.value, progress: [...streamingAssistant.value.progress], tools: streamingAssistant.value.tools.map((tool) => ({ ...tool })), artifacts: [...streamingAssistant.value.artifacts] })
  return base
})
const visibleMessages = computed(() => displayMessages.value.length <= messageRenderLimit.value ? displayMessages.value : displayMessages.value.slice(-messageRenderLimit.value))
const hasMoreMessages = computed(() => displayMessages.value.length > visibleMessages.value.length)
const remainingMessageCount = computed(() => Math.max(0, displayMessages.value.length - visibleMessages.value.length))
const statusState = computed(() => {
  if (summaryRefreshing.value) return { label: '生成摘要中', className: 'processing' }
  if (uploading.value) return { label: '上传文件中', className: 'processing' }
  if (sending.value) return { label: '处理中', className: 'processing' }
  return { label: '就绪', className: 'idle' }
})

watch(displayMessages, async () => {
  await nextTick()
  if (messageScrollRef.value) messageScrollRef.value.scrollTop = messageScrollRef.value.scrollHeight
}, { deep: true })

watch(() => route.query.session, async (value) => {
  const sessionId = Array.isArray(value) ? value[0] : value
  if (typeof sessionId === 'string' && sessionId && sessionId !== currentSessionId.value) await openSession(sessionId, false)
})

const loadMoreMessages = () => { messageRenderLimit.value += MESSAGE_LOAD_STEP }
const formatSessionTime = (timestamp: number) => dayjs(timestamp).format('MM-DD HH:mm')
const formatMessageTime = (timestamp: number) => dayjs(timestamp).format('HH:mm:ss')
const formatFileSize = (size: number) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
const fileNameFromPath = (filePath: string) => filePath.split(/[/\\]/).pop() || filePath
const isImageArtifact = (artifact: AssistantArtifact) => artifact.type === 'image' || /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(artifact.path)

function renderMarkdown(content: string) {
  if (!content) return ''
  const cleanText = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  try { return marked.parse(cleanText) as string } catch { return cleanText.replace(/\n/g, '<br>') }
}

async function reloadSessions(preferredSessionId?: string) {
  sessionsLoading.value = true
  try {
    const sessionList = await fetchAssistantSessions()
    sessions.value = sessionList
    const routeSession = Array.isArray(route.query.session) ? route.query.session[0] : route.query.session
    const target = preferredSessionId || currentSessionId.value || (typeof routeSession === 'string' ? routeSession : '') || sessionList[0]?.id
    if (target && sessionList.some((item) => item.id === target) && target !== currentSessionId.value) await openSession(target, false)
    if (sessionList.length === 0) clearSessionState()
  } finally {
    sessionsLoading.value = false
  }
}

async function openSession(sessionId: string, syncRoute = true) {
  const [{ session, messages }, context] = await Promise.all([fetchAssistantSessionMessages(sessionId), fetchAssistantSessionContext(sessionId)])
  currentSessionId.value = sessionId
  currentSession.value = session
  rawMessages.value = messages
  sessionSummary.value = context.summary
  messageRenderLimit.value = INITIAL_MESSAGE_LIMIT
  pendingUserMessage.value = null
  streamingAssistant.value = null
  if (syncRoute) await router.replace({ path: '/ai/assistant', query: { session: sessionId } })
}

function clearSessionState() {
  currentSessionId.value = ''
  currentSession.value = null
  rawMessages.value = []
  sessionSummary.value = null
  messageRenderLimit.value = INITIAL_MESSAGE_LIMIT
}

async function handleCreateSession() {
  creatingSession.value = true
  try {
    const session = await createAssistantSession('新对话')
    clearSessionState()
    currentSessionId.value = session.id
    currentSession.value = session
    sessions.value = [{ id: session.id, name: session.name, createdAt: session.createdAt, updatedAt: session.updatedAt, messageCount: 0, preview: '还没有消息' }, ...sessions.value]
    await router.replace({ path: '/ai/assistant', query: { session: session.id } })
  } finally {
    creatingSession.value = false
  }
}

async function ensureSession() {
  if (currentSessionId.value) return currentSessionId.value
  const session = await createAssistantSession(draft.value.trim().slice(0, 24) || '新对话')
  currentSessionId.value = session.id
  currentSession.value = session
  await router.replace({ path: '/ai/assistant', query: { session: session.id } })
  return session.id
}

function openRenameModal(session?: AssistantSessionListItem | AssistantSessionRecord | null) {
  const target = session || currentSession.value
  if (!target) return
  renameTargetSessionId.value = target.id
  renameDraft.value = target.name
  renameVisible.value = true
}

async function submitRename() {
  if (!renameTargetSessionId.value || !renameDraft.value.trim()) return
  const session = await renameAssistantSession(renameTargetSessionId.value, renameDraft.value.trim())
  if (currentSessionId.value === session.id) currentSession.value = session
  sessions.value = sessions.value.map((item) => item.id === session.id ? { ...item, name: session.name } : item)
  renameVisible.value = false
  renameTargetSessionId.value = ''
}

function confirmDeleteSession(sessionId: string, sessionName: string) {
  Modal.confirm({
    title: '删除会话',
    content: `确定要删除“${sessionName}”吗？`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      await deleteAssistantSession(sessionId)
      sessions.value = sessions.value.filter((item) => item.id !== sessionId)
      if (currentSessionId.value === sessionId) {
        if (sessions.value.length > 0) await openSession(sessions.value[0].id)
        else {
          clearSessionState()
          await router.replace({ path: '/ai/assistant', query: {} })
        }
      }
    }
  })
}

const confirmDeleteCurrentSession = () => { if (currentSession.value) confirmDeleteSession(currentSession.value.id, currentSession.value.name) }
const openSummaryModal = () => currentSessionId.value ? (summaryVisible.value = true) : message.warning('请先选择一个会话')

async function refreshSummary() {
  if (!currentSessionId.value) return
  summaryRefreshing.value = true
  try {
    sessionSummary.value = await summarizeAssistantSession(currentSessionId.value, 60)
    await reloadSessions(currentSessionId.value)
  } finally {
    summaryRefreshing.value = false
  }
}

const openFilePicker = () => fileInputRef.value?.click()

async function uploadFiles(files: File[]) {
  if (!files.length) return
  uploading.value = true
  try {
    const uploaded = await uploadAssistantFiles(files)
    selectedArtifacts.value = dedupeArtifacts([...selectedArtifacts.value, ...uploaded])
  } finally {
    uploading.value = false
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  try { await uploadFiles(Array.from(input.files || [])) } finally { input.value = '' }
}

async function handlePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files || [])
  if (!files.length) return
  event.preventDefault()
  await uploadFiles(files)
}

async function handleDrop(event: DragEvent) {
  await uploadFiles(Array.from(event.dataTransfer?.files || []))
}

const removeSelectedArtifact = (artifactId: string) => { selectedArtifacts.value = selectedArtifacts.value.filter((item) => item.id !== artifactId) }
const clearComposer = () => { draft.value = ''; selectedArtifacts.value = [] }
function handlePressEnter(event: KeyboardEvent) { if (!event.shiftKey) { event.preventDefault(); handleSend() } }

async function handleSend() {
  const content = draft.value.trim()
  if (!content) return message.warning('请输入内容')
  sending.value = true
  try {
    const sessionId = await ensureSession()
    const optimisticArtifacts = selectedArtifacts.value.map((item) => ({ ...item }))
    pendingUserMessage.value = { id: `pending-user-${Date.now()}`, role: 'user', content, timestamp: Date.now(), progress: [], tools: [], artifacts: optimisticArtifacts, streaming: false }
    streamingAssistant.value = { id: `pending-assistant-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() + 1, progress: [], tools: [], artifacts: [], streaming: true }
    draft.value = ''
    selectedArtifacts.value = []
    await streamAssistantChat({ message: content, sessionId, files: optimisticArtifacts, mode: chatMode.value }, (event) => {
      if (!streamingAssistant.value) return
      if (event.type === 'progress') streamingAssistant.value.progress = dedupeStrings([...streamingAssistant.value.progress, event.message])
      else if (event.type === 'content') streamingAssistant.value.content += event.content || ''
      else if (event.type === 'tool') {
        const tools = [...streamingAssistant.value.tools]
        const index = tools.findIndex((item) => (event.id && item.id === event.id) || item.name === event.name)
        const nextTool: ToolDisplay = { id: event.id || `${event.name}-${Date.now()}`, name: event.name, content: event.result || (event.status === 'running' ? '执行中...' : ''), status: event.status }
        if (index >= 0) tools.splice(index, 1, nextTool); else tools.push(nextTool)
        streamingAssistant.value.tools = tools
      } else if (event.type === 'error') streamingAssistant.value.content = streamingAssistant.value.content || `处理失败：${event.message || '未知错误'}`
      else if (event.type === 'done' && !streamingAssistant.value.content) streamingAssistant.value.content = event.content || '处理完成。'
    })
    await reloadSessions(sessionId)
    await openSession(sessionId, false)
  } catch (error: any) {
    message.error(error?.message || '发送失败')
  } finally {
    pendingUserMessage.value = null
    streamingAssistant.value = null
    sending.value = false
  }
}

function openArtifact(artifact: AssistantArtifact) {
  if (isImageArtifact(artifact)) return previewArtifactFile(artifact)
  window.open(buildAssistantArtifactUrl(artifact.path), '_blank')
}

function previewArtifactFile(artifact: AssistantArtifact) { previewArtifact.value = artifact; previewVisible.value = true }
function closePreview() { previewVisible.value = false; previewArtifact.value = null }
function downloadArtifact(artifact: AssistantArtifact) { window.open(buildAssistantArtifactUrl(artifact.path, true), '_blank') }

async function copyMessagePair(item: DisplayMessage) {
  const chunks = []
  if (item.pairQuestion) chunks.push(`用户：${item.pairQuestion}`)
  if (item.content) chunks.push(`助手：${item.content}`)
  if (!chunks.length) return
  try { await navigator.clipboard.writeText(chunks.join('\n\n')); message.success('已复制这组消息') } catch { message.error('复制失败，请重试') }
}

function deleteMessagePair(item: DisplayMessage) {
  if (!currentSessionId.value) return
  const startIndex = typeof item.pairStartIndex === 'number' ? item.pairStartIndex : item.rawStartIndex
  const endIndex = typeof item.rawEndIndex === 'number' ? item.rawEndIndex : item.rawStartIndex
  if (typeof startIndex !== 'number' || typeof endIndex !== 'number') return
  Modal.confirm({
    title: '删除这组消息',
    content: '会删除该轮用户提问、助手回答及相关工具记录，是否继续？',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      const { session, messages } = await deleteAssistantSessionMessages(currentSessionId.value, startIndex, endIndex)
      currentSession.value = session
      rawMessages.value = messages
      sessionSummary.value = null
      await reloadSessions(currentSessionId.value)
      message.success('这组消息已删除')
    }
  })
}

function dedupeArtifacts(artifacts: AssistantArtifact[]) {
  const seen = new Set<string>()
  return artifacts.filter((artifact) => { const key = `${artifact.direction || 'unknown'}::${artifact.path}`; if (seen.has(key)) return false; seen.add(key); return true })
}

const dedupeStrings = (items: string[]) => Array.from(new Set(items.filter((item) => item.trim())))

function normalizeMessages(messages: AssistantStoredMessage[]): DisplayMessage[] {
  const normalized: DisplayMessage[] = []
  let currentAssistant: DisplayMessage | null = null
  let currentUserPair: { rawIndex: number; content: string } | null = null
  let toolNameMap = new Map<string, string>()
  for (let index = 0; index < messages.length; index++) {
    const raw = messages[index]
    if (raw.role === 'system') continue
    if (raw.role === 'user') {
      currentAssistant = null
      toolNameMap = new Map<string, string>()
      currentUserPair = { rawIndex: index, content: raw.content }
      normalized.push({ id: raw.id, role: 'user', content: raw.content, timestamp: raw.timestamp, progress: [], tools: [], artifacts: dedupeArtifacts(raw.artifacts || []), streaming: false, rawStartIndex: index, rawEndIndex: index })
      continue
    }
    if (raw.role === 'assistant') {
      if (!currentAssistant) {
        currentAssistant = { id: raw.id, role: 'assistant', content: raw.content || '', timestamp: raw.timestamp, progress: [], tools: [], artifacts: dedupeArtifacts(raw.artifacts || []), streaming: false, rawStartIndex: index, rawEndIndex: index, pairStartIndex: currentUserPair?.rawIndex ?? index, pairQuestion: currentUserPair?.content || '' }
        normalized.push(currentAssistant)
      } else {
        if (raw.content) currentAssistant.content = [currentAssistant.content, raw.content].filter(Boolean).join('\n\n')
        currentAssistant.rawEndIndex = index
        currentAssistant.artifacts = dedupeArtifacts([...currentAssistant.artifacts, ...(raw.artifacts || [])])
      }
      toolNameMap = buildToolNameMap(raw.tool_calls)
      continue
    }
    if (!currentAssistant) {
      currentAssistant = { id: `assistant-${raw.id}`, role: 'assistant', content: '', timestamp: raw.timestamp, progress: [], tools: [], artifacts: [], streaming: false, rawStartIndex: index, rawEndIndex: index, pairStartIndex: currentUserPair?.rawIndex ?? index, pairQuestion: currentUserPair?.content || '' }
      normalized.push(currentAssistant)
    }
    currentAssistant.rawEndIndex = index
    currentAssistant.tools.push({ id: raw.id, name: toolNameMap.get(raw.tool_call_id || '') || raw.name || 'tool', content: raw.content || '', status: raw.content?.trim().startsWith('Error:') ? 'error' : 'done' })
  }
  return normalized
}

function buildToolNameMap(toolCalls?: any[]) {
  const nextMap = new Map<string, string>()
  if (!Array.isArray(toolCalls)) return nextMap
  toolCalls.forEach((call) => {
    const id = typeof call?.id === 'string' ? call.id : ''
    const funcName = typeof call?.function?.name === 'string' ? call.function.name : ''
    const rawArgs = typeof call?.function?.arguments === 'string' ? call.function.arguments : '{}'
    let displayName = funcName || 'tool'
    if (funcName === 'run_skill') {
      try {
        const payload = JSON.parse(rawArgs)
        if (payload?.skill && payload?.action) displayName = `${payload.skill}.${payload.action}`
      } catch {
        // ignore
      }
    }
    if (id) nextMap.set(id, displayName)
  })
  return nextMap
}

onMounted(async () => { await reloadSessions() })
</script>

<style scoped>
.assistant-workbench { height: calc(100vh - 64px - 32px); display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 16px; overflow: hidden; }
:global(.admin-content:has(.assistant-workbench)) { overflow: hidden !important; }
.assistant-sidebar, .main-panel { min-height: 0; }
.assistant-sidebar { display: flex; flex-direction: column; gap: 16px; }
.panel { background: #fff; border: 1px solid #ece6ff; border-radius: 20px; box-shadow: 0 18px 48px rgba(62, 46, 118, 0.08); }
.brand-panel, .sessions-panel, .legacy-panel { padding: 18px; }
.brand-panel { background: radial-gradient(circle at top right, rgba(137, 109, 255, 0.18), transparent 38%), linear-gradient(180deg, #fff 0%, #fbf9ff 100%); }
.brand-panel h2 { margin: 12px 0 10px; font-size: 26px; color: #20173f; }
.eyebrow, .panel-subtitle, .workspace-desc, .note, .session-meta, .message-meta, .artifact-meta, .summary-meta { color: #7b7398; font-size: 12px; line-height: 1.7; }
.row { display: flex; align-items: center; gap: 10px; }
.wrap { flex-wrap: wrap; }
.compact { gap: 8px; }
.panel-head, .session-top, .composer-bar, .artifact-top, .workspace-head, .message-meta { display: flex; justify-content: space-between; gap: 12px; }
.panel-head, .workspace-head, .composer-bar, .message-meta { align-items: flex-start; }
.panel-title { font-size: 16px; font-weight: 700; color: #261d49; }
.count-pill { min-width: 28px; height: 28px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #f1ebff; color: #6549d7; font-weight: 700; }
.sessions-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.session-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.session-item { padding: 14px; border-radius: 16px; border: 1px solid #ece6ff; background: #faf8ff; cursor: pointer; transition: all .18s ease; outline: none; }
.session-item:hover, .session-item:focus-visible { border-color: #b8a2ff; transform: translateY(-1px); }
.session-item.active { border-color: #7a5cff; background: linear-gradient(180deg, rgba(122, 92, 255, .12), rgba(122, 92, 255, .04)); box-shadow: 0 10px 26px rgba(82, 61, 160, .12); }
.session-main { min-width: 0; flex: 1; display: flex; justify-content: space-between; gap: 10px; }
.session-name { font-weight: 700; color: #281f4a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-item p { margin: 8px 0; min-height: 42px; color: #655c82; line-height: 1.6; }
.icon-btn, .text-btn, .tool-btn, .link-btn { border: 1px solid #e3dcff; background: #fff; color: #5a45b6; border-radius: 12px; cursor: pointer; }
.icon-btn { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; }
.text-btn, .tool-btn, .link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; }
.danger { color: #c54848; border-color: #f1d5d5; }
.empty-tip { padding: 16px; border-radius: 14px; background: #faf8ff; color: #7a7196; }
.legacy-link { display: inline-flex; align-items: center; margin-top: 14px; padding: 10px 14px; border-radius: 12px; background: #f1ebff; color: #5d45bb; font-weight: 600; text-decoration: none; }
.main-panel { display: flex; flex-direction: column; overflow: hidden; }
.workspace-head { padding: 22px 24px 18px; border-bottom: 1px solid #f0ebfb; }
.workspace-title { display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 24px; font-weight: 700; color: #231a44; }
.status-pill { padding: 8px 12px; border-radius: 999px; background: #f4f1ff; color: #5e48ba; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; }
.status-pill.processing { background: #eef3ff; color: #345fbd; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.conversation-panel { flex: 1; overflow-y: auto; padding: 24px; background: radial-gradient(circle at top left, rgba(122, 92, 255, .06), transparent 22%), linear-gradient(180deg, #fbfaff 0%, #fff 28%); }
.load-more { display: flex; justify-content: center; margin-bottom: 16px; }
.empty-state { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 24px; }
.empty-icon { width: 86px; height: 86px; margin-bottom: 18px; border-radius: 28px; background: linear-gradient(135deg, #eee7ff, #f8f4ff); color: #6648dc; display: flex; align-items: center; justify-content: center; font-size: 36px; }
.empty-state h3 { margin: 0 0 10px; font-size: 26px; color: #241b45; }
.chips { margin-top: 22px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.chip { padding: 10px 16px; border: 1px solid #e3dcff; border-radius: 999px; background: #fff; color: #5f49be; cursor: pointer; }
.message-row { display: flex; gap: 14px; margin-bottom: 24px; }
.message-row.user { flex-direction: row-reverse; }
.message-avatar { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f0eaff; color: #664bd6; font-size: 18px; }
.message-row.user .message-avatar { background: #eef2f9; color: #42506d; }
.message-main-wrap { max-width: min(960px, 86%); }
.message-row.user .message-main-wrap { display: flex; flex-direction: column; align-items: flex-end; }
.message-bubble { padding: 16px 18px; border-radius: 18px; border: 1px solid #ebe6f8; background: #fff; box-shadow: 0 10px 24px rgba(57, 45, 103, 0.05); }
.message-row.user .message-bubble { color: #fff; border-color: transparent; background: linear-gradient(135deg, #6e53e4, #8a68ff); }
.message-row.user .message-bubble :deep(p), .message-row.user .message-bubble :deep(li), .message-row.user .message-bubble :deep(code), .message-row.user .message-bubble :deep(strong) { color: inherit; }
.markdown-body :deep(p) { margin: 0 0 10px; line-height: 1.75; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: 10px 0; padding-left: 20px; }
.markdown-body :deep(code) { padding: 2px 6px; border-radius: 6px; background: rgba(67, 51, 131, .08); }
.sub-panel { margin-top: 12px; padding: 14px; border-radius: 16px; border: 1px solid #ece6ff; background: #f8f6ff; }
.sub-title { margin-bottom: 10px; color: #6755b6; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.progress-line { color: #59516f; line-height: 1.7; font-size: 13px; }
.tool-list, .artifact-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.tool-block { overflow: hidden; border: 1px solid #e6dfff; border-radius: 14px; background: #fff; }
.tool-block summary { padding: 12px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; list-style: none; }
.tool-block summary::-webkit-details-marker { display: none; }
.tool-block pre { margin: 0; padding: 0 14px 14px; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.6; color: #4d4468; }
.tool-status { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.tool-status.running { background: #edf6ff; color: #2972d9; }
.tool-status.done { background: #ebfff1; color: #2c8557; }
.tool-status.error { background: #fff0f0; color: #d43838; }
.artifact-item { padding: 12px; border-radius: 14px; border: 1px solid #e7e0ff; background: #fff; }
.artifact-name { border: none; background: none; padding: 0; color: #5140a8; font-weight: 700; cursor: pointer; text-align: left; }
.artifact-preview { margin-top: 12px; width: 100%; border: 1px solid #e8e1ff; border-radius: 14px; overflow: hidden; background: #faf8ff; cursor: pointer; padding: 0; }
.artifact-preview img { display: block; width: 100%; max-height: 220px; object-fit: cover; }
.artifact-preview span { display: block; padding: 10px 12px; text-align: left; color: #6b5bb0; font-size: 12px; }
.typing-indicator { display: inline-flex; gap: 6px; }
.typing-indicator span { width: 8px; height: 8px; border-radius: 50%; background: #8c79ea; animation: bounce 1.4s infinite ease-in-out both; }
.typing-indicator span:nth-child(1) { animation-delay: -.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -.16s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
.composer { padding: 18px 20px 20px; border-top: 1px solid #f0ebfb; background: #fff; }
.selected-files { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.selected-file { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 999px; background: #f4efff; color: #563fba; }
.selected-file button, .hidden-input { display: none; }
.selected-file button { display: inline; border: none; background: none; color: inherit; cursor: pointer; }
.composer-bar { margin-top: 12px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.mode-select { width: 124px; }
.summary-body { min-height: 220px; max-height: 58vh; overflow-y: auto; padding: 16px; border: 1px solid #ece6ff; border-radius: 16px; background: #faf8ff; }
.preview-body { display: flex; justify-content: center; align-items: center; min-height: 240px; }
.preview-body img { max-width: 100%; max-height: 72vh; border-radius: 16px; }
@media (max-width: 1180px) { .assistant-workbench { grid-template-columns: 1fr; height: auto; min-height: calc(100vh - 64px - 32px); overflow: auto; } .main-panel { min-height: 760px; } }
@media (max-width: 768px) { .workspace-head, .composer-bar, .message-meta, .artifact-top, .session-top, .session-main { flex-direction: column; align-items: flex-start; } .message-main-wrap { max-width: 100%; } }
</style>
