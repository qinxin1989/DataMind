<template>
  <div class="ai-chat-page">
    <div class="main-grid" :class="{ 'hide-left': hideLeft, 'hide-right': hideRight }">
      <!-- 左侧：数据源和数据结构 -->
      <div v-if="!hideLeft" class="left-col">
        <a-card size="small" class="ds-card">
          <template #title>
            <div class="card-title">
              <DatabaseOutlined /> 数据源
              <a-button type="link" size="small" @click="refreshDatasources">
                <ReloadOutlined />
              </a-button>
              <router-link to="/datasource">
                <a-button type="link" size="small">
                  <SettingOutlined /> 管理
                </a-button>
              </router-link>
              <a-button type="link" size="small" @click="hideLeft = true" title="隐藏">
                <LeftOutlined />
              </a-button>
            </div>
          </template>
          <a-spin :spinning="loadingDatasources">
            <div class="ds-list">
              <div
                v-for="ds in datasources"
                :key="ds.id"
                :class="['ds-item', { active: selectedDatasource?.id === ds.id }]"
                @click="selectDatasource(ds)"
              >
                <div class="name">{{ ds.name }}</div>
                <div class="type">{{ ds.type.toUpperCase() }}</div>
              </div>
              <a-empty v-if="datasources.length === 0" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无数据源" />
            </div>
          </a-spin>
        </a-card>

        <!-- 左侧垂直分隔条 -->
        <div 
          class="resize-handle horizontal" 
          @mousedown="startResize('left-vertical', $event)"
          title="拖动调整高度"
        >
          <div class="resize-handle-line"></div>
        </div>

        <a-card v-if="selectedDatasource" size="small" class="schema-card">
          <template #title>
            <div class="card-title">
              <TableOutlined /> 数据结构
              <a-button type="link" size="small" :loading="analyzing" @click="analyzeSchema">
                {{ analysisData ? '✓ 已分析' : '🔍 AI分析' }}
              </a-button>
            </div>
          </template>
          <div class="schema-list">
            <a-collapse v-model:activeKey="openTables" ghost>
              <a-collapse-panel v-for="table in schemaData" :key="table.tableName">
                <template #header>
                  <span>📋 {{ table.tableName }}</span>
                  <span v-if="getTableCn(table.tableName)" class="table-cn">{{ getTableCn(table.tableName) }}</span>
                </template>
                <div v-for="col in table.columns" :key="col.name" class="schema-col">
                  <span class="col-name">{{ col.name }}</span>
                  <span class="col-cn">{{ getColumnCn(table.tableName, col.name) || '-' }}</span>
                  <span class="col-type">{{ col.type }}</span>
                </div>
              </a-collapse-panel>
            </a-collapse>
          </div>
        </a-card>
      </div>

      <!-- 中间：对话区域 -->
      <a-card size="small" class="chat-card">
        <template #title>
          <div class="card-title">
            <a-button v-if="hideLeft" type="link" size="small" @click="hideLeft = false" title="显示数据源">
              <RightOutlined />
            </a-button>
            <RobotOutlined />
            {{ selectedDatasource ? `正在查询: ${selectedDatasource.name}` : '请选择数据源' }}
            <a-button v-if="hideRight" type="link" size="small" @click="hideRight = false" title="显示历史" style="margin-left: auto;">
              <LeftOutlined />
            </a-button>
          </div>
        </template>
        <div class="chat-messages" ref="messagesRef" :style="{ maxHeight: chatMessagesHeight + 'px' }">
          <div v-if="messages.length === 0" class="empty-chat">
            <RobotOutlined style="font-size: 48px; color: #ccc" />
            <p>选择数据源后开始提问</p>
          </div>
          <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
            <div class="bubble">
              <div v-if="msg.role === 'user'">{{ msg.content }}</div>
              <div v-else>
                <div class="md-content" v-html="renderMarkdown(msg.content)"></div>
                <div v-if="msg.sql" class="sql-block">
                  <code>{{ msg.sql }}</code>
                </div>
                <div v-if="msg.chart" :id="'chart-' + idx" class="chart-container"></div>
                <!-- 隐藏表格结果显示 -->
                <!-- <div v-if="msg.data?.length" class="data-table">
                  <a-table :columns="getTableColumns(msg.data)" :data-source="msg.data.slice(0, 20)" size="small" :pagination="false" :scroll="{ x: true }" />
                </div> -->
                <div v-if="msg.sources?.length" class="source-refs">
                  <span class="ref-label">参考来源:</span>
                  <a-tag v-for="src in msg.sources" :key="src.id" size="small">{{ src.title }}</a-tag>
                </div>
                <div class="action-btns">
                  <a-button size="small" @click="generateDashboard(msg.question)">📊 生成大屏</a-button>
                  <a-button size="small" @click="copyAnswer(msg.content)">📋 复制</a-button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="loading" class="message ai">
            <div class="bubble"><a-spin size="small" /> 思考中...</div>
          </div>
        </div>
        
        <!-- 对话区域和输入框之间的分隔条 -->
        <div 
          class="resize-handle horizontal" 
          @mousedown="startResize('chat-vertical', $event)"
          title="拖动调整对话区域高度"
        >
          <div class="resize-handle-line"></div>
        </div>
        
        <div class="chat-input" :style="{ height: chatInputHeight + 'px' }">
          <a-textarea
            v-model:value="inputText"
            placeholder="输入问题，支持自然语言查询..."
            @pressEnter="handleSend"
            :disabled="!selectedDatasource || loading"
            :maxlength="500"
            class="full-height-textarea"
            :style="{ height: (chatInputHeight - 60) + 'px' }"
          />
          <div class="chat-input-buttons">
            <a-button type="primary" @click="handleSend" :loading="loading" :disabled="!selectedDatasource">
              发送
            </a-button>
            <a-button @click="openDashboard" :disabled="!selectedDatasource">
              📊 大屏
            </a-button>
          </div>
        </div>
      </a-card>

      <!-- 右侧：历史对话和推荐问题 -->
      <div v-if="selectedDatasource && !hideRight" class="right-col">
        <a-card size="small" class="history-card">
          <template #title>
            <div class="card-title">
              <HistoryOutlined /> 历史对话
              <a-button type="link" size="small" @click="newChat">+ 新对话</a-button>
              <a-button type="link" size="small" @click="hideRight = true" title="隐藏">
                <RightOutlined />
              </a-button>
            </div>
          </template>
          <div class="history-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              :class="['history-item', { active: currentSessionId === session.id }]"
              @click="loadSession(session.id)"
            >
              <span class="preview">{{ session.preview }}</span>
              <CloseOutlined class="delete-btn" @click.stop="deleteSession(session.id)" />
            </div>
            <div v-if="sessions.length === 0" class="empty-history">暂无历史</div>
          </div>
        </a-card>

        <!-- 右侧垂直分隔条 -->
        <div 
          class="resize-handle horizontal" 
          @mousedown="startResize('right-vertical', $event)"
          title="拖动调整高度"
        >
          <div class="resize-handle-line"></div>
        </div>

        <a-card v-if="suggestedQuestions.length" size="small" class="questions-card" :style="{ height: (rightColHeight - rightTopHeight - 8) + 'px' }">
          <template #title>
            <div class="card-title"><BulbOutlined /> 推荐问题</div>
          </template>
          <div class="question-list">
            <a-tag
              v-for="(q, idx) in suggestedQuestions"
              :key="idx"
              class="q-tag"
              @click="askQuestion(q)"
            >
              {{ q }}
            </a-tag>
          </div>
        </a-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { message, Empty } from 'ant-design-vue'
import {
  DatabaseOutlined, ReloadOutlined, RobotOutlined, TableOutlined,
  HistoryOutlined, BulbOutlined, CloseOutlined, SettingOutlined,
  LeftOutlined, RightOutlined
} from '@ant-design/icons-vue'
import { get, post, del } from '@/api/request'
import * as echarts from 'echarts'
import { marked } from 'marked'

interface Datasource { id: string; name: string; type: string }
interface ChatMessage { role: 'user' | 'assistant'; content: string; sql?: string; chart?: any; data?: any[]; question?: string }
interface Session { id: string; preview: string; messageCount: number; createdAt: number }
interface TableSchema { tableName: string; columns: { name: string; type: string }[] }
interface TableAnalysis { tableName: string; tableNameCn: string; columns: { name: string; nameCn: string }[] }

const datasources = ref<Datasource[]>([])
const selectedDatasource = ref<Datasource | null>(null)
const messages = ref<ChatMessage[]>([])
const sessions = ref<Session[]>([])
const currentSessionId = ref<string>('')
const inputText = ref('')
const loading = ref(false)
const loadingDatasources = ref(false)
const analyzing = ref(false)
const suggestedQuestions = ref<string[]>([])
const schemaData = ref<TableSchema[]>([])
const analysisData = ref<{ tables: TableAnalysis[]; suggestedQuestions: string[] } | null>(null)
const openTables = ref<string[]>([])
const messagesRef = ref<HTMLElement>()
const hideLeft = ref(false)
const hideRight = ref(false)

// 高度调整相关
const leftColHeight = ref(window.innerHeight - 64 - 48 - 16) // 页面高度 - 顶栏 - 内边距
const rightColHeight = ref(window.innerHeight - 64 - 48 - 16)
const leftTopHeight = ref(200) // 左侧数据源卡片高度
const rightTopHeight = ref(200) // 右侧历史卡片高度
const chatInputHeight = ref(130) // 输入框区域高度
const chatMessagesHeight = computed(() => window.innerHeight - 64 - 48 - chatInputHeight.value - 8) // 对话区域高度

let resizing = false
let resizeType = ''
let startY = 0
let startHeight = 0

// 开始调整大小
function startResize(type: string, event: MouseEvent) {
  resizing = true
  resizeType = type
  startY = event.clientY
  
  if (type === 'left-vertical') {
    startHeight = leftTopHeight.value
  } else if (type === 'right-vertical') {
    startHeight = rightTopHeight.value
  } else if (type === 'chat-vertical') {
    startHeight = chatInputHeight.value
  }
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  event.preventDefault()
}

// 处理调整
function handleResize(event: MouseEvent) {
  if (!resizing) return
  
  const deltaY = event.clientY - startY
  
  if (resizeType === 'left-vertical') {
    const newHeight = startHeight + deltaY
    if (newHeight >= 100 && newHeight <= leftColHeight.value - 150) {
      leftTopHeight.value = newHeight
    }
  } else if (resizeType === 'right-vertical') {
    const newHeight = startHeight + deltaY
    if (newHeight >= 100 && newHeight <= rightColHeight.value - 150) {
      rightTopHeight.value = newHeight
    }
  } else if (resizeType === 'chat-vertical') {
    const newHeight = startHeight - deltaY // 注意这里是减法，因为向上拖动应该增加输入框高度
    if (newHeight >= 80 && newHeight <= 400) {
      chatInputHeight.value = newHeight
    }
  }
}

// 停止调整
function stopResize() {
  resizing = false
  resizeType = ''
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// 监听窗口大小变化
onMounted(() => {
  window.addEventListener('resize', () => {
    leftColHeight.value = window.innerHeight - 64 - 48 - 16
    rightColHeight.value = window.innerHeight - 64 - 48 - 16
  })
})

// 加载数据源
async function refreshDatasources() {
  loadingDatasources.value = true
  try {
    const res = await get<any>('/datasource')
    datasources.value = Array.isArray(res) ? res : (res.data || [])
  } catch (e) {
    message.error('加载数据源失败')
  } finally {
    loadingDatasources.value = false
  }
}

// 选择数据源
async function selectDatasource(ds: Datasource) {
  selectedDatasource.value = ds
  messages.value = []
  currentSessionId.value = ''
  schemaData.value = []
  analysisData.value = null
  suggestedQuestions.value = []
  openTables.value = []
  
  await Promise.all([loadSchema(), loadCachedAnalysis(), loadSessions()])
}

// 加载 Schema
async function loadSchema() {
  if (!selectedDatasource.value) return
  try {
    const res = await get<TableSchema[]>(`/datasource/${selectedDatasource.value.id}/schema`)
    schemaData.value = Array.isArray(res) ? res : (res as any).data || []
    if (schemaData.value.length) openTables.value = [schemaData.value[0].tableName]
  } catch (e) { console.error('加载Schema失败', e) }
}

// 加载缓存的分析结果
async function loadCachedAnalysis() {
  if (!selectedDatasource.value) return
  try {
    const res = await get<any>(`/datasource/${selectedDatasource.value.id}/schema/analyze`)
    const data = res.data || res
    if (data.tables?.length) {
      analysisData.value = data
      suggestedQuestions.value = data.suggestedQuestions || []
    }
  } catch (e) { console.error('加载分析失败', e) }
}

// AI 分析 Schema
async function analyzeSchema() {
  if (!selectedDatasource.value || analyzing.value) return
  analyzing.value = true
  try {
    const res = await get<any>(`/datasource/${selectedDatasource.value.id}/schema/analyze?refresh=true`)
    const data = res.data || res
    analysisData.value = data
    suggestedQuestions.value = data.suggestedQuestions || []
    message.success('分析完成')
  } catch (e: any) { 
    console.error('AI分析失败:', e)
    const errorMsg = e.response?.data?.error || e.message || '分析失败'
    message.error(`分析失败: ${errorMsg}`)
  }
  finally { analyzing.value = false }
}

// 获取表中文名
function getTableCn(tableName: string): string {
  return analysisData.value?.tables?.find(t => t.tableName === tableName)?.tableNameCn || ''
}

// 获取列中文名
function getColumnCn(tableName: string, colName: string): string {
  const table = analysisData.value?.tables?.find(t => t.tableName === tableName)
  return table?.columns?.find(c => c.name === colName)?.nameCn || ''
}

// 加载会话列表
async function loadSessions() {
  if (!selectedDatasource.value?.id) return
  try {
    const res = await get<Session[]>(`/chat/sessions/${selectedDatasource.value.id}`)
    sessions.value = Array.isArray(res) ? res : (res as any).data || []
  } catch (e) { sessions.value = [] }
}

// 加载会话
async function loadSession(id: string) {
  currentSessionId.value = id
  try {
    const res = await get<any>(`/chat/session/${id}`)
    const session = res.data || res
    messages.value = session.messages || []
    scrollToBottom()
  } catch (e) { message.error('加载会话失败') }
}

// 新建对话
function newChat() {
  currentSessionId.value = ''
  messages.value = []
}

// 删除会话
async function deleteSession(id: string) {
  try {
    await del(`/chat/session/${id}`)
    if (currentSessionId.value === id) newChat()
    await loadSessions()
  } catch (e) { message.error('删除失败') }
}

// 发送消息
async function handleSend(e?: KeyboardEvent) {
  console.log('=== handleSend called - VERSION 2.0 ===')
  if (e?.shiftKey) return
  e?.preventDefault()
  
  const question = inputText.value.trim()
  if (!question || !selectedDatasource.value) return

  inputText.value = ''
  messages.value.push({ role: 'user', content: question })
  scrollToBottom()

  loading.value = true
  try {
    // 调用数据源查询接口
    const res = await post<any>('/ask', {
      datasourceId: selectedDatasource.value.id,
      question,
      sessionId: currentSessionId.value || undefined
    })

    console.log('=== Frontend received response ===')
    console.log('res:', res)
    console.log('res.data:', res?.data)
    console.log('res.answer:', res?.answer)

    // 修复：直接使用res，不要用res.data
    // 因为axios拦截器已经返回了response.data，所以res就是后端返回的对象
    const data = res
    console.log('data:', data)
    console.log('data.answer:', data?.answer)
    console.log('data.answer type:', typeof data?.answer)
    console.log('data.answer length:', data?.answer?.length)
    
    if (data?.sessionId) currentSessionId.value = data.sessionId

    const answerContent = data?.answer || data?.error || '无法回答'
    console.log('Final content to display:', answerContent)

    messages.value.push({
      role: 'assistant',
      content: answerContent,
      sql: data?.sql,
      chart: data?.chart,
      data: data?.data,
      question
    })

    if (data?.chart) {
      await nextTick()
      renderChart(messages.value.length - 1, data.chart)
    }
    
    loadSessions()
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: e.message || '请求失败' })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

// 点击推荐问题
function askQuestion(q: string) {
  inputText.value = q
  handleSend()
}

// 渲染 Markdown
function renderMarkdown(text: string): string {
  if (!text) return ''
  try { return marked.parse(text) as string }
  catch { return text.replace(/\n/g, '<br>') }
}

// 渲染图表
function renderChart(idx: number, chartData: any) {
  const dom = document.getElementById(`chart-${idx}`)
  if (!dom || !chartData) return

  const chart = echarts.init(dom)
  const { type, data, config, title } = chartData
  let option: any = { title: { text: title, left: 'center', textStyle: { fontSize: 14 } }, tooltip: {} }

  if (type === 'pie') {
    option.series = [{ type: 'pie', radius: ['40%', '70%'], data: data.map((d: any) => ({ name: d[config.labelField || config.xField], value: d[config.valueField || config.yField] })) }]
  } else {
    option.xAxis = { type: 'category', data: data.map((d: any) => d[config.xField]), axisLabel: { rotate: data.length > 8 ? 45 : 0 } }
    option.yAxis = { type: 'value' }
    option.series = [{ type: type || 'bar', data: data.map((d: any) => d[config.yField]), smooth: type === 'line', areaStyle: type === 'area' ? {} : undefined, itemStyle: { color: '#667eea' } }]
  }
  chart.setOption(option)
}

// 获取表格列
function getTableColumns(data: any[]) {
  if (!data?.length) return []
  return Object.keys(data[0]).map(key => ({ title: key, dataIndex: key, key, ellipsis: true }))
}

// 生成大屏
function generateDashboard(question?: string) {
  if (!selectedDatasource.value) return
  const topic = question || prompt('请输入大屏主题')
  if (!topic) return
  
  // 获取token并添加到URL中
  const token = localStorage.getItem('token')
  const url = `/api/agent/dashboard/preview?datasourceId=${selectedDatasource.value.id}&topic=${encodeURIComponent(topic)}&theme=dark&token=${token}`
  window.open(url, '_blank')
}

function openDashboard() {
  generateDashboard()
}

// 复制答案
function copyAnswer(text: string) {
  navigator.clipboard.writeText(text).then(() => message.success('已复制'))
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

onMounted(() => { refreshDatasources() })
</script>


<style scoped>
.ai-chat-page {
  height: calc(100vh - 64px - 48px); /* 视口高度 - 顶部导航64px - admin-content的margin 48px */
  overflow: hidden;
  padding: 0;
  margin: -24px; /* 抵消admin-content的padding */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* 只在这个页面禁止外层滚动 */
:global(.admin-content:has(.ai-chat-page)) {
  overflow: hidden !important;
}

.main-grid {
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  align-items: stretch; /* 让所有列等高 */
  grid-template-rows: 1fr; /* 确保只有一行，所有列等高 */
}

.main-grid.hide-left {
  grid-template-columns: 1fr 280px;
}

.main-grid.hide-right {
  grid-template-columns: 260px 1fr;
}

.main-grid.hide-left.hide-right {
  grid-template-columns: 1fr;
}

.left-col, .right-col {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  height: auto; /* 自动高度，由grid控制 */
  align-self: stretch; /* 确保拉伸到grid单元格高度 */
}

.ds-card, .history-card {
  flex-shrink: 0;
  overflow: hidden;
}

.ds-card :deep(.ant-card-body) { 
  height: calc(100% - 40px);
  overflow-y: auto;
  padding: 8px;
}

.history-card :deep(.ant-card-body) { 
  height: calc(100% - 40px);
  overflow-y: auto;
  padding: 8px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.ds-list, .history-list { 
  height: 100%;
  overflow-y: auto;
  padding: 4px 0; 
}
.ds-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8f9fa;
  border: 1px solid transparent;
}
.ds-item:hover { 
  background: #e8ebf5;
  border-color: #d0d7f0;
}
.ds-item.active { 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
}
.ds-item .name { 
  flex: 1; 
  font-weight: 500;
  font-size: 13px;
}
.ds-item .type { 
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
}
.ds-item.active .type {
  background: rgba(255, 255, 255, 0.3);
}

.source-card { max-height: 280px; }
.source-card :deep(.ant-card-body) { overflow-y: auto; max-height: 220px; padding: 8px; }

.detail-card { flex: 1; min-height: 0; overflow: hidden; }
.detail-card :deep(.ant-card-body) { overflow-y: auto; max-height: calc(100% - 40px); }

.tree-title { display: flex; align-items: center; gap: 6px; }
.tree-title.is-category { font-weight: 500; }
.tree-title :deep(.ant-tag) { font-size: 10px; line-height: 16px; padding: 0 4px; }

.schema-card { 
  flex: 1; /* 占据剩余空间 */
  overflow: hidden; 
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.schema-card :deep(.ant-card-body) { 
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 8px;
  min-height: 0;
}

.questions-card {
  flex: 1; /* 占据剩余空间 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.questions-card :deep(.ant-card-body) { 
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.schema-list { 
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.schema-list :deep(.ant-collapse-header) { padding: 6px 8px !important; font-size: 12px; }
.schema-list :deep(.ant-collapse-content-box) { padding: 0 !important; }
.table-cn { color: #667eea; font-weight: normal; margin-left: 8px; font-size: 11px; }

.schema-col {
  display: grid;
  grid-template-columns: 1fr 1fr 60px;
  padding: 4px 10px;
  border-top: 1px solid #f0f0f0;
  font-size: 11px;
}
.schema-col:hover { background: #fafbfc; }
.col-name { font-family: monospace; }
.col-cn { color: #667eea; }
.col-type { color: #888; text-align: right; }

.doc-list { padding: 4px 0; }
.doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.doc-item:hover { background: #f5f5f5; }
.doc-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chat-card { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  min-height: 0;
  height: auto; /* 自动高度，由grid控制 */
  align-self: stretch; /* 确保拉伸到grid单元格高度 */
}
.chat-card :deep(.ant-card-body) { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  padding: 0; 
  min-height: 0;
  overflow: hidden; /* 防止溢出 */
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fafbfc;
  min-height: 0;
  max-height: calc(100vh - 64px - 48px - 130px); /* 进一步减小对话区域高度 */
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}
.empty-chat .hint { font-size: 12px; color: #bbb; margin-top: 8px; }

.message { margin-bottom: 16px; }
.message.user { text-align: right; }
.message .bubble {
  display: inline-block;
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  text-align: left;
}
.message.user .bubble { background: #667eea; color: white; }
.message.ai .bubble { background: white; border: 1px solid #eee; }

.md-content :deep(h1), .md-content :deep(h2), .md-content :deep(h3) { font-size: 15px; margin: 10px 0 5px; }
.md-content :deep(p) { margin: 8px 0; line-height: 1.6; }
.md-content :deep(ul), .md-content :deep(ol) { margin: 8px 0; padding-left: 20px; }
.md-content :deep(strong) { color: #667eea; }
.md-content :deep(code) { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
.md-content :deep(table) { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
.md-content :deep(th), .md-content :deep(td) { padding: 6px 10px; border: 1px solid #eee; }
.md-content :deep(th) { background: #f8f9fa; }

.sql-block {
  background: #2d3748;
  color: #a0aec0;
  padding: 10px;
  border-radius: 6px;
  margin-top: 10px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-x: auto;
}

.chart-container { width: 100%; height: 200px; margin: 10px 0; background: #fafbfc; border-radius: 6px; }

.data-table { margin-top: 10px; overflow-x: auto; }
.data-table :deep(.ant-table) { font-size: 12px; }

.source-refs {
  margin-top: 10px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
}
.ref-label { color: #666; margin-right: 8px; }

.action-btns {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #eee;
  background: white;
  align-items: flex-start; /* 按钮靠上 */
  flex-shrink: 0;
  height: 80px;
}
.chat-input :deep(.ant-input-textarea) {
  flex: 1;
  min-width: 0;
  height: 100%;
}
.chat-input :deep(textarea) {
  resize: none;
  font-size: 14px;
  height: 100% !important;
}
.chat-input-buttons {
  display: flex;
  flex-direction: column; /* 垂直排列 */
  gap: 4px;
  flex-shrink: 0;
  align-items: stretch;
  justify-content: flex-start; /* 靠上对齐，紧挨着 */
}

.history-card { 
  max-height: 220px;
  flex-shrink: 0; /* 防止被压缩 */
}
.history-card :deep(.ant-card-body) { 
  max-height: 150px; 
  overflow-y: auto; 
}

.history-list { }
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 5px;
  margin-bottom: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #555;
  background: #f8f9fa;
}
.history-item:hover { background: #eef0f5; }
.history-item.active { background: #e8ebf5; color: #667eea; }
.history-item .preview { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-item .delete-btn { opacity: 0; color: #e74c3c; cursor: pointer; }
.history-item:hover .delete-btn { opacity: 1; }
.empty-history { text-align: center; color: #999; font-size: 12px; padding: 20px; }

.questions-card { 
  flex: 1; 
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.questions-card :deep(.ant-card-body) { 
  flex: 1;
  overflow-y: auto; 
  min-height: 0;
}

.question-list { display: flex; flex-wrap: wrap; gap: 6px; }
.q-tag {
  cursor: pointer;
  padding: 4px 10px;
  background: #f0f2f5;
  border: none;
  border-radius: 14px;
  font-size: 11px;
}
.q-tag:hover { background: #667eea; color: white; }

/* 调整大小的分隔条 */
.resize-handle {
  position: relative;
  cursor: ns-resize;
  user-select: none;
  z-index: 10;
}

.resize-handle.horizontal {
  height: 8px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.resize-handle-line {
  width: 60px;
  height: 3px;
  background: #d9d9d9;
  border-radius: 2px;
  transition: all 0.2s;
}

.resize-handle:hover .resize-handle-line {
  background: #667eea;
  height: 4px;
  width: 80px;
}

.resize-handle:active .resize-handle-line {
  background: #5568d3;
}
</style>
