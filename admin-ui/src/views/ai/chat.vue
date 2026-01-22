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
              <a-tooltip v-for="ds in datasources" :key="ds.id" :title="ds.connectionStatus === 'error' ? `无法使用: ${ds.errorMessage}` : ''">
                <div
                  :class="['ds-item', { 
                    active: selectedDatasource?.id === ds.id, 
                    disabled: ds.connectionStatus === 'error',
                    testing: testingConnection === ds.id
                  }]"
                  @click="selectDatasource(ds)"
                >
                  <div class="name">
                    <a-spin v-if="testingConnection === ds.id" size="small" style="margin-right: 6px;" />
                    <span v-if="ds.connectionStatus === 'error'" style="color: #ff4d4f; margin-right: 4px;">⚠</span>
                    {{ ds.name }}
                  </div>
                  <div class="type">{{ ds.type.toUpperCase() }}</div>
                </div>
              </a-tooltip>
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
import { get, post, del, aiPost, aiGet } from '@/api/request'
import * as echarts from 'echarts'
import { marked } from 'marked'

interface Datasource { id: string; name: string; type: string; connectionStatus?: 'unknown' | 'connected' | 'error'; errorMessage?: string }
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
const testingConnection = ref<string | null>(null) // 正在测试连接的数据源ID
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
  // 如果数据源已知连接失败，显示错误提示
  if (ds.connectionStatus === 'error') {
    message.warning(`数据源 "${ds.name}" 无法使用: ${ds.errorMessage || '连接失败'}`)
    return
  }
  
  // 如果连接状态未知，先测试连接
  if (ds.connectionStatus === 'unknown' || !ds.connectionStatus) {
    testingConnection.value = ds.id
    try {
      const testRes = await get<any>(`/datasource/${ds.id}/test`)
      if (!testRes.success) {
        ds.connectionStatus = 'error'
        ds.errorMessage = testRes.error || '连接失败'
        message.error(`数据源 "${ds.name}" 连接失败: ${ds.errorMessage}`)
        testingConnection.value = null
        return
      }
      ds.connectionStatus = 'connected'
    } catch (e: any) {
      ds.connectionStatus = 'error'
      ds.errorMessage = e.response?.data?.error || e.message || '连接失败'
      message.error(`数据源 "${ds.name}" 连接失败: ${ds.errorMessage}`)
      testingConnection.value = null
      return
    }
    testingConnection.value = null
  }
  
  selectedDatasource.value = ds
  currentSessionId.value = ''
  messages.value = []
  schemaData.value = []
  analysisData.value = null
  suggestedQuestions.value = []
  openTables.value = []
  
  await Promise.all([loadSchema(), loadCachedAnalysis(), loadSessions()])
  
  // 自动加载最近的对话历史（如果存在真实会话）
  if (sessions.value.length > 0 && !sessions.value[0].id.startsWith('welcome-')) {
    await loadSession(sessions.value[0].id)
  }
}

// 加载 Schema
async function loadSchema() {
  if (!selectedDatasource.value) return
  try {
    const res = await get<TableSchema[]>(`/datasource/${selectedDatasource.value.id}/schema`)
    schemaData.value = Array.isArray(res) ? res : (res as any).data || []
    if (schemaData.value.length) openTables.value = [schemaData.value[0].tableName]
    // 标记连接成功
    if (selectedDatasource.value) {
      selectedDatasource.value.connectionStatus = 'connected'
    }
  } catch (e: any) { 
    console.error('加载Schema失败', e)
    const errorMsg = e.response?.data?.error || e.message || '加载失败'
    message.error(`加载数据结构失败: ${errorMsg}`)
    // 标记连接失败
    if (selectedDatasource.value) {
      selectedDatasource.value.connectionStatus = 'error'
      selectedDatasource.value.errorMessage = errorMsg
    }
  }
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
  } catch (e: any) { 
    // 如果是数据库连接错误，显示提示
    const errorMsg = e.response?.data?.error || ''
    if (errorMsg.includes('数据库连接失败')) {
      message.warning(errorMsg)
    }
    console.error('加载分析失败', e) 
  }
}

// AI 分析 Schema
async function analyzeSchema() {
  if (!selectedDatasource.value || analyzing.value) return
  analyzing.value = true
  try {
    const res = await aiGet<any>(`/datasource/${selectedDatasource.value.id}/schema/analyze?refresh=true`)
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
    // 调用数据源查询接口（使用 aiPost，超时时间更长）
    const res = await aiPost<any>('/ask', {
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
async function askQuestion(q: string) {
  inputText.value = q
  await nextTick() // 等待 DOM 更新
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

  // 设置图表容器的最小高度和宽度，确保图表能够更大地显示
  dom.style.minHeight = '500px'
  dom.style.width = '100%'
  dom.style.maxWidth = '900px'
  dom.style.margin = '0 auto'

  const chart = echarts.init(dom)
  const { type, data, config, title } = chartData
  
  // 定义现代化配色方案（更专业的商务配色）
  const colorPalette = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]
  
  // 智能单位格式化函数
  function formatValue(value: number, fieldName?: string) {
    // 检查字段名，判断数据类型
    const isCurrency = fieldName && /(金额|货币|收入|支出|GNP|GDP|生产总值|产值|利润|薪资|工资)/i.test(fieldName)
    const isPopulation = fieldName && /(人口|人数|居民|市民)/i.test(fieldName)
    const isArea = fieldName && /(面积|国土|土地|区域)/i.test(fieldName)
    const isPercentage = fieldName && /(百分比|占比|比例|率)/i.test(fieldName)
    
    // 百分比数据直接显示
    if (isPercentage) {
      return value.toFixed(2) + '%'
    }
    
    // 人口数据
    if (isPopulation) {
      if (value >= 100000000) {
        return (value / 100000000).toFixed(1) + '亿人'
      } else if (value >= 10000) {
        return (value / 10000).toFixed(1) + '万人'
      } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + '千人'
      } else {
        return value.toLocaleString() + '人'
      }
    }
    
    // 面积数据
    if (isArea) {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + '万平方公里'
      } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + '千平方公里'
      } else {
        return value.toLocaleString() + '平方公里'
      }
    }
    
    // 货币/金额数据
    if (isCurrency) {
      // 检查是否需要转换单位（如果数据是百万美元）
      let actualValue = value
      if (fieldName && /(GNP|GDP)/i.test(fieldName) && value > 100) {
        // GNP/GDP数据通常以百万美元为单位
        actualValue = value / 100 // 转换为亿美元
      }
      
      if (actualValue >= 10000) {
        return (actualValue / 10000).toFixed(1) + '万亿元'
      } else if (actualValue >= 1) {
        return actualValue.toFixed(1) + '亿元'
      } else if (actualValue >= 0.0001) {
        return (actualValue * 10000).toFixed(1) + '万元'
      } else {
        return (actualValue * 100000000).toFixed(1) + '元'
      }
    }
    
    // 通用数据
    if (value >= 100000000) {
      return (value / 100000000).toFixed(1) + '亿'
    } else if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万'
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + '千'
    } else {
      return value.toLocaleString()
    }
  }
  
  // 使用更合适的默认标题和图例，根据数据动态调整
  const chartTitle = title || `${config.yField || '数据'}分布`
  const legendName = config.yField || '数据值' // 使用y轴字段作为图例名称
  
  let option: any = {
    title: {
      text: chartTitle,
      left: 'center',
      textStyle: {
        fontSize: 20, // 增大标题字体
        fontWeight: 'bold',
        color: '#2d3748',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      padding: [20, 0, 30, 0] // 增加标题边距
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(0, 0, 0, 0.05)',
          blur: 8
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      textStyle: {
        color: '#2d3748',
        fontSize: 16, // 增大提示框字体
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      formatter: function(params: any) {
        let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>`
        params.forEach((param: any) => {
          // 使用智能单位格式化函数
          const formattedValue = formatValue(param.value, config.yField)
          result += `<div style="margin-bottom: 5px;">${param.marker} ${param.seriesName}: ${formattedValue}</div>`
        })
        return result
      },
      position: function(point: number[], params: any, dom: any, rect: any, size: any) {
        // 优化tooltip位置，避免超出图表区域
        const obj = { top: 80 }
        obj[['left', 'right'][point[0] > size.viewSize[0] / 2 ? 1 : 0]] = 15
        return obj
      }
    },
    legend: {
      type: 'scroll',
      data: [legendName],
      bottom: 15,
      itemWidth: 16, // 增大图例标记
      itemHeight: 16,
      itemGap: 20,
      textStyle: {
        fontSize: 14, // 增大图例字体
        color: '#4a5568',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      pageIconSize: 12,
      pageTextStyle: {
        color: '#718096',
        fontSize: 12
      }
    },
    grid: {
      left: '8%',
      right: '8%',
      top: '18%', // 减少顶部边距，让图表区域更大
      bottom: '20%', // 调整底部边距
      containLabel: true
    },
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    color: colorPalette
  }

  // 处理不同类型的图表
  if (type === 'pie') {
    option.series = [{ 
      name: title || '数据',
      type: 'pie', 
      radius: ['45%', '75%'], 
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}: {d}%',
        fontSize: 12,
        color: '#666'
      },
      labelLine: {
        length: 15,
        length2: 20,
        lineStyle: {
          color: '#ddd'
        }
      },
      emphasis: {
        scale: true,
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        label: {
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: data.map((d: any, index: number) => ({
        name: d[config.labelField || config.xField], 
        value: d[config.valueField || config.yField],
        itemStyle: {
          color: colorPalette[index % colorPalette.length]
        }
      }))
    }]
  } else if (type === 'scatter') {
    // 散点图
    option.xAxis = {
      type: 'value',
      name: config.xField,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      },
      axisLabel: {
        fontSize: 11,
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#ccc'
        }
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f5f5f5',
          type: 'dashed'
        }
      }
    }
    option.yAxis = {
      type: 'value',
      name: config.yField,
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      },
      axisLabel: {
        fontSize: 11,
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#ccc'
        }
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f5f5f5',
          type: 'dashed'
        }
      }
    }
    option.series = [{ 
      name: title || '数据',
      type: 'scatter',
      symbolSize: 8,
      data: data.map((d: any) => [d[config.xField], d[config.yField]]),
      emphasis: {
        itemStyle: {
          borderWidth: 3,
          borderColor: '#fff'
        },
        symbolSize: 12,
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.2)'
      }
    }]
  } else if (type === 'radar') {
    // 雷达图
    const radarIndicator = Object.keys(data[0]).map(key => ({ name: key, max: Math.max(...data.map((d: any) => d[key])) }))
    
    option.radar = {
      indicator: radarIndicator,
      center: ['50%', '60%'],
      radius: '65%',
      shape: 'circle',
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: 11
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(255, 255, 255, 0.8)', 'rgba(240, 240, 240, 0.5)']
        }
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    }
    option.series = [{ 
      name: title || '数据',
      type: 'radar',
      data: data.map((d: any, index: number) => ({
        value: Object.values(d),
        name: `数据${index + 1}`,
        areaStyle: {
          opacity: 0.3
        },
        lineStyle: {
          width: 2
        },
        itemStyle: {
          color: colorPalette[index % colorPalette.length]
        }
      }))
    }]
  } else if (type === 'funnel') {
    // 漏斗图
    option.title = {
      ...option.title,
      left: 'left'
    }
    option.tooltip = {
      ...option.tooltip,
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c} ({d}%)'
    }
    option.legend = {
      ...option.legend,
      left: 'right',
      orient: 'vertical'
    }
    option.series = [{ 
      name: title || '数据',
      type: 'funnel',
      left: '10%',
      top: 100,
      bottom: 60,
      width: '80%',
      min: 0,
      max: 100,
      minSize: '0%',
      maxSize: '100%',
      sort: 'descending',
      gap: 2,
      label: {
        show: true,
        position: 'inside',
        formatter: '{b}: {c}',
        fontSize: 12,
        color: '#fff'
      },
      labelLine: {
        length: 10,
        lineStyle: {
          width: 1,
          type: 'solid'
        }
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        label: {
          fontSize: 14,
          fontWeight: 'bold'
        },
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      data: data.map((d: any, index: number) => ({
        name: d[config.labelField || config.xField],
        value: d[config.valueField || config.yField],
        itemStyle: {
          color: colorPalette[index % colorPalette.length]
        }
      }))
    }]
  } else if (type === 'gauge') {
    // 仪表盘
    option.title = {
      ...option.title,
      top: '10%'
    }
    option.series = [{ 
      name: title || '指标',
      type: 'gauge',
      radius: '80%',
      center: ['50%', '60%'],
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: Math.max(...data.map((d: any) => d[config.valueField || config.yField])) * 1.2,
      splitNumber: 8,
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.3, '#667eea'],
            [0.7, '#43e97b'],
            [1, '#fa709a']
          ]
        }
      },
      pointer: {
        icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
        length: '60%',
        width: 12,
        offsetCenter: [0, '-25%'],
        itemStyle: {
          color: '#333'
        }
      },
      axisTick: {
        length: 12,
        lineStyle: {
          color: 'auto',
          width: 2
        }
      },
      splitLine: {
        length: 20,
        lineStyle: {
          color: 'auto',
          width: 5
        }
      },
      axisLabel: {
        color: '#666',
        fontSize: 12,
        distance: -30
      },
      title: {
        offsetCenter: [0, '30%'],
        fontSize: 14,
        color: '#666'
      },
      detail: {
        fontSize: 28,
        offsetCenter: [0, '55%'],
        valueAnimation: true,
        formatter: '{value}',
        color: '#333'
      },
      data: [{
        value: data[0][config.valueField || config.yField],
        name: config.yField
      }]
    }]
  } else {
    // 柱状图、折线图、面积图
    const isLineType = ['line', 'area'].includes(type || 'bar')
    
    // 优化横坐标标签显示，根据文字长度动态调整倾斜角度
    const xLabels = data.map((d: any) => String(d[config.xField] || ''))
    const maxLabelLength = Math.max(...xLabels.map((l: string) => l.length))
    // 根据标签最大长度动态调整旋转角度
    const rotateAngle = maxLabelLength > 8 ? 45 : maxLabelLength > 5 ? 30 : 0;
    
    option.grid = {
      left: '12%',
      right: '12%',
      top: '22%',
      bottom: '35%', // 大幅增加底部边距以确保标签完整显示
      containLabel: true
    }
    
    option.xAxis = {
      type: 'category',
      data: data.map((d: any) => d[config.xField]),
      name: config.xField,
      nameLocation: 'middle',
      nameGap: rotateAngle > 0 ? 100 : 60, // 根据旋转角度调整名称间距
      nameTextStyle: {
        fontSize: 12,
        color: '#4a5568',
        padding: rotateAngle > 0 ? [40, 0, 0, 0] : [20, 0, 0, 0],
        fontFamily: 'system-ui, -apple-system, sans-serif'
      },
      axisLabel: {
        rotate: rotateAngle,
        fontSize: rotateAngle > 0 ? 12 : 14, // 增大字体大小
        color: '#718096',
        overflow: 'truncate',
        margin: rotateAngle > 0 ? 35 : 20, // 增加边距
        // 智能标签间隔，确保标签不重叠
        interval: function(index: number, value: string) {
          // 根据数据量和容器宽度动态调整显示的标签数量
          const maxLabels = Math.min(10, Math.floor(dom.clientWidth / (rotateAngle > 0 ? 50 : 70)));
          const skipStep = Math.ceil(data.length / maxLabels);
          return index % skipStep === 0;
        },
        formatter: function(value: string) {
          // 根据旋转角度调整标签截断长度
          const maxLength = rotateAngle > 0 ? 25 : 20;
          return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
        }
      },
      axisLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },
      axisTick: {
        show: false
      },
      boundaryGap: !isLineType
    }
    // 处理y轴配置，优化显示效果
    const yValues = data.map((d: any) => d[config.yField])
    const maxValue = Math.max(...yValues)
    const minValue = Math.min(...yValues)
    const valueRange = maxValue - minValue
    
    // 判断是否需要使用对数刻度（当最大值是最小值的100倍以上时）
    const useLogScale = maxValue > 0 && minValue > 0 && (maxValue / minValue) > 100
    
    option.yAxis = {
      type: 'value',
      name: config.yField ? `单位：${config.yField}` : '',  // 单位显示在左上角
      nameLocation: 'end',  // 名称放在轴的顶部
      nameGap: 15,
      nameTextStyle: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        align: 'left'
      },
      axisLabel: {
        fontSize: 14, // 增大字体大小
        color: '#718096',
        margin: 20, // 增加与轴线的间距
        // 使用智能单位格式化函数
        formatter: function(value: number) {
          return formatValue(value, config.yField)
        }
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f1f5f9',
          type: 'dashed'
        }
      },
      // 使用对数刻度处理差异过大的数据
      logBase: useLogScale ? 10 : undefined,
      // 优化刻度显示
      minInterval: 1,
      splitNumber: 5, // 减少刻度数量，避免重叠
      // 确保刻度从0开始
      min: useLogScale ? undefined : 0
    }
    
    option.series = []
    
    // 如果是多字段数据，先获取其他字段
    const otherFields = Object.keys(data[0]).filter(key => key !== config.xField && key !== config.yField)
    
    // 处理多系列数据
    const seriesCount = otherFields.length + 1; // 计算系列数量（包括默认系列）
    
    // 自动计算柱形宽度，根据数据数量和系列数量动态调整
    let barWidth = 'auto';
    if (type === 'bar') {
      const dataCount = data.length;
      const maxWidth = 100; // 增大最大宽度
      const minWidth = 30; // 增大最小宽度
      const spacing = 15;   // 柱形间距
      
      // 根据数据数量和系列数量计算合适的宽度
      const calculatedWidth = Math.min(
        maxWidth,
        Math.max(
          minWidth,
          (dom.clientWidth * 0.8) / (dataCount * seriesCount) - spacing
        )
      );
      
      barWidth = calculatedWidth;
    }
    
    // 数据标签配置 - 根据数据量決定是否显示
    const showLabels = type === 'bar' && data.length <= 6;  // 减少显示标签的数据量阈值
    const labelConfig = {
      show: showLabels,
      position: 'top' as const,
      formatter: function(params: any) {
        return formatValue(params.value, config.yField)
      },
      fontSize: 12,
      color: '#4a5568',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      distance: 8  // 标签与柱子的距离
    }
    
    const seriesConfig = {
      name: legendName, // 使用图例名称，确保与legend保持一致
      type: type || 'bar',
      data: data.map((d: any) => d[config.yField]),
      smooth: isLineType,
      symbol: isLineType ? 'circle' : undefined,
      symbolSize: isLineType ? 7 : undefined,
      lineStyle: isLineType ? { 
        width: 3,
        cap: 'round',
        join: 'round'
      } : undefined,
      areaStyle: type === 'area' ? {
        opacity: 0.3,
        // 添加渐变色
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: colorPalette[0] },
          { offset: 1, color: colorPalette[0] + '20' }
        ])
      } : undefined,
      itemStyle: {
        borderRadius: type === 'bar' ? [8, 8, 0, 0] : undefined,
        // 优化柱形效果
        borderWidth: type === 'bar' ? 0 : undefined
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 15,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        },
        scale: type === 'bar',
        focus: 'series'
      },
      barWidth: barWidth,
      label: labelConfig,
      // 添加动画效果
      animationDelay: function (idx: number) {
        return idx * 50;
      },
      animationEasing: 'elasticOut'
    }
    
    option.series.push(seriesConfig)
    
    // 如果是多字段数据，添加更多系列
    if (otherFields.length > 0) {
      otherFields.forEach((field, index) => {
        option.series.push({
          name: field,
          type: type || 'bar',
          data: data.map((d: any) => d[field]),
          smooth: isLineType,
          symbol: isLineType ? 'circle' : undefined,
          symbolSize: isLineType ? 6 : undefined,
          lineStyle: isLineType ? { width: 3 } : undefined,
          areaStyle: type === 'area' ? {
            opacity: 0.2
          } : undefined,
          itemStyle: {
            borderRadius: type === 'bar' ? [8, 8, 0, 0] : undefined
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            scale: type === 'bar'
          }
        })
      })
    }
  }
  
  chart.setOption(option)
  
  // 添加窗口大小变化的响应式
  const resizeHandler = () => chart.resize()
  window.addEventListener('resize', resizeHandler)
  
  // 清理函数
  return () => {
    window.removeEventListener('resize', resizeHandler)
    chart.dispose()
  }
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
.ds-item.disabled {
  background: #f0f0f0;
  color: #999;
  cursor: not-allowed;
  opacity: 0.7;
}
.ds-item.disabled:hover {
  background: #f0f0f0;
  border-color: transparent;
}
.ds-item.disabled .name {
  color: #999;
}
.ds-item.disabled .type {
  background: rgba(0, 0, 0, 0.03);
  color: #bbb;
}
.ds-item.testing {
  background: #fff7e6;
  border-color: #ffd591;
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

.chart-container { width: 100%; height: 500px; margin: 15px 0; padding: 10px; background: #ffffff; border: 1px solid #f0f0f0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }

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
