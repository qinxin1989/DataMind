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
              <a-tooltip v-for="ds in datasources" :key="ds.id" :title="ds.connectionStatus === 'error' ? `${ds.name} (无法使用: ${ds.errorMessage})` : ds.name">
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
            
            <!-- 图表库切换 -->
            <div v-if="selectedDatasource" style="margin-left: 12px; display: inline-flex; align-items: center; gap: 4px;">
              <div v-if="selectedDatasource" class="chat-options">
              <span class="opt-label">图表库:</span>
              <a-radio-group v-model:value="chartLib" size="small" @change="handleChartLibChange">
                <a-radio-button value="echarts">ECharts</a-radio-button>
                <a-radio-button value="g2plot">G2Plot</a-radio-button>
              </a-radio-group>
              
              <a-divider type="vertical" />
              
              <a-switch v-model:checked="noChartMode" size="small" />
              <span class="opt-label" style="margin-left: 4px;">无图模式</span>
            </div>
            </div>

            <a-button v-if="hideRight" type="link" size="small" @click="hideRight = false" title="显示历史" style="margin-left: auto;">
              <LeftOutlined />
            </a-button>
          </div>
        </template>
        <div class="chat-messages" ref="messagesRef" @scroll="handleMessagesScroll">
          <!-- 加载更多历史消息提示 -->
          <div v-if="hasMoreMessages" class="history-load-more">
            <a-spin v-if="loadingMore" size="small" />
            <a-button v-else type="link" size="small" @click="loadOlderMessages">
              ↑ 加载更早的 {{ totalMessages - messages.length }} 条消息
            </a-button>
          </div>
          <div v-if="filteredMessages.length === 0" class="empty-chat">
            <RobotOutlined style="font-size: 48px; color: #ccc" />
            <p>选择数据源后开始提问</p>
          </div>
          <div v-for="(msg, idx) in messages" :key="msg._uid ?? idx" :class="['message', msg.role, { 'has-chart': !!msg.chart && !noChartMode }]">
            <div class="bubble">
              <div v-if="msg.role === 'user'">{{ msg.content }}</div>
              <div v-else>
                <!-- 可折叠的思考过程 -->
                <div v-if="msg.thinkingSteps && msg.thinkingSteps.length" class="thinking-collapse">
                  <div class="thinking-toggle" @click="msg.showThinking = !msg.showThinking">
                    <span class="toggle-icon">{{ msg.showThinking ? '▼' : '▶' }}</span>
                    <span class="toggle-text">思考过程 ({{ getTotalThinkingTime(msg.thinkingSteps) }}ms)</span>
                  </div>
                  <div v-if="msg.showThinking" class="thinking-detail">
                    <div v-for="(step, sIdx) in msg.thinkingSteps" :key="sIdx" class="thinking-step-wrapper">
                      <div :class="['thinking-step', step.status]">
                        <span class="step-icon">
                          <span v-if="step.status === 'done'" class="done">✓</span>
                          <span v-else-if="step.status === 'error'" class="error">✗</span>
                          <span v-else>○</span>
                        </span>
                        <span class="step-text">{{ step.step }}</span>
                        <span v-if="step.duration" class="step-duration">{{ step.duration }}ms</span>
                      </div>
                      <!-- 步骤详情 -->
                      <div v-if="step.detail" class="step-detail">
                        <pre>{{ step.detail }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="md-content" v-html="renderMarkdown(msg.content)"></div>
                <div v-if="msg.sql" class="sql-block">
                  <code>{{ msg.sql }}</code>
                </div>

                <!-- 图表工具栏 (单图或多图只要有图且非无图模式就显示) -->
                <div v-if="(msg.chart || (msg.charts && msg.charts.length)) && !noChartMode" class="chart-toolbar">
                  <a-space>
                    <a-tooltip title="切换类型">
                      <a-dropdown>
                        <a-button size="small" type="text"><BarChartOutlined /></a-button>
                        <template #overlay>
                          <a-menu @click="(e: any) => updateChartConfig(idx, { type: e.key as string })">
                            <a-menu-item key="bar">柱状图</a-menu-item>
                            <a-menu-item key="line">折线图</a-menu-item>
                            <a-menu-item key="area">面积图</a-menu-item>
                            <a-menu-item key="pie">饼图</a-menu-item>
                            <a-menu-divider />
                            <a-menu-item key="scatter">散点图</a-menu-item>
                            <a-menu-item key="radar">雷达图</a-menu-item>
                            <a-menu-item key="funnel">漏斗图</a-menu-item>
                            <a-menu-item key="gauge">仪表盘</a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-tooltip>
                    
                    <a-tooltip title="旋转角度">
                      <a-dropdown>
                        <a-button size="small" type="text"><RotateRightOutlined /></a-button>
                        <template #overlay>
                          <a-menu @click="(e: any) => updateChartConfig(idx, { rotate: parseInt(e.key as string) })">
                            <a-menu-item key="0">0°</a-menu-item>
                            <a-menu-item key="30">30°</a-menu-item>
                            <a-menu-item key="45">45°</a-menu-item>
                            <a-menu-item key="90">90°</a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-tooltip>

                    <a-tooltip title="色彩主题">
                      <a-dropdown>
                        <a-button size="small" type="text"><BgColorsOutlined /></a-button>
                        <template #overlay>
                          <a-menu @click="(e: any) => updateChartConfig(idx, { colorScheme: e.key as string })">
                            <a-menu-item key="gradient">蓝靛渐变</a-menu-item>
                            <a-menu-item key="blue">经典蓝</a-menu-item>
                            <a-menu-item key="green">清新绿</a-menu-item>
                            <a-menu-item key="orange">活力橙</a-menu-item>
                            <a-menu-item key="purple">典雅紫</a-menu-item>
                            <a-menu-item key="pink">浪漫粉</a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-tooltip>
                    
                    <a-tooltip title="自定义颜色">
                      <input 
                        type="color" 
                        :value="msg.chartConfig?.customColor || '#667eea'" 
                        @input="(e: any) => updateChartConfig(idx, { customColor: e.target.value })"
                        class="color-picker-input"
                      />
                    </a-tooltip>

                    <a-tooltip title="高度">
                      <a-dropdown>
                        <a-button size="small" type="text"><ArrowsAltOutlined /></a-button>
                        <template #overlay>
                          <a-menu @click="(e: any) => updateChartConfig(idx, { height: parseInt(e.key as string) })">
                            <a-menu-item key="400">紧凑</a-menu-item>
                            <a-menu-item key="500">标准</a-menu-item>
                            <a-menu-item key="700">宽大</a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-tooltip>

                    <a-tooltip title="宽度">
                      <a-dropdown>
                        <a-button size="small" type="text"><ExpandOutlined /></a-button>
                        <template #overlay>
                          <a-menu @click="(e: any) => updateChartConfig(idx, { width: e.key as any })">
                            <a-menu-item key="600">窄屏</a-menu-item>
                            <a-menu-item key="900">中屏</a-menu-item>
                            <a-menu-item key="1200">宽屏</a-menu-item>
                            <a-menu-item key="100%">全屏</a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-tooltip>

                    <a-tooltip title="一键翻译">
                      <a-dropdown>
                        <a-button size="small" type="text" :loading="(msg as any).translating">
                          <TranslationOutlined />
                        </a-button>
                        <template #overlay>
                          <a-menu @click="(e: any) => translateChartByType(idx, e.key as 'ai' | 'direct')">
                            <a-menu-item key="direct">直接翻译 (Python)</a-menu-item>
                            <a-menu-item key="ai">AI 翻译 (大模型)</a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-tooltip>
                    
                    <a-tooltip :title="msg.chartConfig?.useTranslation === false ? '显示译文' : '显示原文'">
                      <a-button 
                        size="small" 
                        type="text" 
                        @click="toggleTranslation(idx)"
                        :disabled="!msg.chartConfig?.translations || Object.keys(msg.chartConfig.translations).length === 0"
                      >
                        <span v-if="msg.chartConfig?.useTranslation === false">译</span>
                        <span v-else>原</span>
                      </a-button>
                    </a-tooltip>
                  </a-space>
                </div>

                <!-- 图表容器 (单图) -->
                <div v-if="msg.chart && !noChartMode" :id="'chart-' + idx" class="chart-container"></div>
                
                <!-- 图表容器 (复数图表 - 综合分析模式) -->
                <div v-if="msg.charts && msg.charts.length && !noChartMode">
                  <div v-for="(c, cIdx) in msg.charts" :key="cIdx" :id="'chart-' + idx + '-' + cIdx" class="chart-container multiple-charts"></div>
                </div>

                
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
          <!-- 思考中状态（紧凑内嵌样式） -->
          <div v-if="loading" class="message ai">
            <div class="bubble">
              <div class="thinking-collapse thinking-live">
                <div class="thinking-toggle" @click="showLiveThinking = !showLiveThinking">
                  <a-spin size="small" />
                  <span class="toggle-text">思考中... {{ currentStepSummary }}</span>
                  <span class="toggle-icon">{{ showLiveThinking ? '▼' : '▶' }}</span>
                </div>
                <div v-if="showLiveThinking" class="thinking-detail">
                  <div v-for="(step, idx) in currentThinkingSteps" :key="idx" :class="['thinking-step', step.status]">
                    <span class="step-icon">
                      <a-spin v-if="step.status === 'running'" size="small" style="transform: scale(0.7);" />
                      <span v-else-if="step.status === 'done'" class="done">✓</span>
                      <span v-else-if="step.status === 'error'" class="error">✗</span>
                      <span v-else>○</span>
                    </span>
                    <span class="step-text">{{ step.step }}</span>
                    <span v-if="step.duration" class="step-duration">{{ step.duration }}ms</span>
                  </div>
                </div>
              </div>
            </div>
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
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { message, Empty } from 'ant-design-vue'
import {
  DatabaseOutlined, ReloadOutlined, RobotOutlined, TableOutlined,
  HistoryOutlined, BulbOutlined, CloseOutlined, SettingOutlined,
  LeftOutlined, RightOutlined, BarChartOutlined,
  RotateRightOutlined, BgColorsOutlined,
  ArrowsAltOutlined, ExpandOutlined, TranslationOutlined
} from '@ant-design/icons-vue'
import { get, del, aiPost, aiGet } from '@/api/request'
import * as echarts from 'echarts'
import { Column, Line, Pie, Radar, Funnel, Gauge } from '@antv/g2plot'
import { marked } from 'marked'

interface Datasource { 
  id: string; 
  name: string; 
  type: string; 
  connectionStatus?: 'unknown' | 'connected' | 'error'; 
  errorMessage?: string 
}

interface ChartConfig {
  type?: string;
  rotate?: number;
  colorScheme?: string;
  customColor?: string;
  width?: string | number;
  height?: string | number;
  translations?: Record<string, string>; // 翻译映射表
  useTranslation?: boolean; // 是否使用翻译（默认true）
}

// 思考步骤类型
interface ThinkingStep {
  step: string;       // 步骤名称
  status: 'pending' | 'running' | 'done' | 'error';
  duration?: number;  // 耗时(ms)
  detail?: string;    // 详细信息
}

interface ChatMessage { 
  role: 'user' | 'assistant' | 'system'; 
  content: string; 
  sql?: string; 
  chart?: any; 
  charts?: any[]; // 新增：支持综合分析返回的多个图表
  data?: any[]; 
  question?: string; 
  sources?: { id: string; title: string }[]; 
  hasChart?: boolean;
  chartConfig?: ChartConfig;
  thinkingSteps?: ThinkingStep[];  // 思考过程
  showThinking?: boolean;          // 是否展开思考过程
  _uid?: number;                   // 内部唯一ID，用于渐进加载动画
}
interface Session { id: string; preview: string; messageCount: number; createdAt: number }

// 分页加载配置
const MESSAGES_PER_PAGE = 20 // 每次加载的消息数量
interface TableSchema { tableName: string; columns: { name: string; type: string }[] }
interface TableAnalysis { tableName: string; tableNameCn: string; columns: { name: string; nameCn: string }[] }
interface AskResponse {
  answer: string
  sessionId?: string
  sql?: string
  chart?: any
  charts?: any[] // 新增：支持综合分析模式
  data?: any[]
  skillUsed?: string
  toolUsed?: string
  visualization?: boolean
  sources?: any[]
  error?: string
}

const datasources = ref<Datasource[]>([])
const selectedDatasource = ref<Datasource | null>(null)
const messages = ref<ChatMessage[]>([])
const sessions = ref<Session[]>([])
const currentSessionId = ref<string>('')
const hasMoreMessages = ref(false) // 是否还有更多历史消息
const totalMessages = ref(0) // 总消息数
const loadingMore = ref(false) // 是否正在加载更多消息

const chartLib = ref(localStorage.getItem('ai_chat_chart_lib') || 'echarts')
const noChartMode = ref(localStorage.getItem('ai_chat_no_chart') === 'true')

// 监听无图模式变化并持久化
watch(noChartMode, async (val: boolean) => {
  localStorage.setItem('ai_chat_no_chart', String(val))
  // 如果关闭无图模式，重新渲染所有图表
  if (!val) {
    await nextTick()
    setTimeout(() => {
      messages.value.forEach((msg, idx) => {
        if (msg.chart) renderChart(idx, msg.chart)
        if (msg.charts?.length) {
          msg.charts.forEach((c: any, cIdx: number) => renderChart(idx, c, cIdx))
        }
      })
    }, 50)
  }
})

const inputText = ref('')

// 用于存储各消息图表的清理函数
const chartCleanups: Record<number, () => void> = {}

// 渐进式加载
let _msgUid = 0
const genMsgUid = () => ++_msgUid
let _progressiveAbort: (() => void) | null = null

// 切换图表库处理
function handleChartLibChange() {
  localStorage.setItem('ai_chat_chart_lib', chartLib.value)
  message.success(`已切换为 ${chartLib.value === 'echarts' ? 'ECharts' : 'Ant Design Charts'}`)
  // 重新渲染当前所有可见的图表
  nextTick(() => {
    messages.value.forEach((msg, idx) => {
      if (msg.chart) renderChart(idx, msg.chart)
      if (msg.charts?.length) {
        msg.charts.forEach((c: any, cIdx: number) => renderChart(idx, c, cIdx))
      }
    })
  })
}
const loading = ref(false)
const loadingDatasources = ref(false)
const analyzing = ref(false)

// 思考过程状态
const currentThinkingSteps = ref<ThinkingStep[]>([])
const showLiveThinking = ref(true) // 思考过程是否展开
const currentStepSummary = computed(() => {
  const running = currentThinkingSteps.value.find(s => s.status === 'running')
  if (running) return running.step + '...'
  const done = currentThinkingSteps.value.filter(s => s.status === 'done')
  if (done.length > 0) return done[done.length - 1].step + ' ✓'
  return ''
})
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
        ds.errorMessage = typeof testRes.error === 'string' ? testRes.error : (testRes.error?.message || '连接失败')
        testingConnection.value = null
        return
      }
      ds.connectionStatus = 'connected'
    } catch (e: any) {
      ds.connectionStatus = 'error'
      ds.errorMessage = (e.response?.data?.error || e.message || '连接失败') as string
      message.error(`数据源 "${ds.name}" 连接失败: ${ds.errorMessage}`)
      testingConnection.value = null
      return
    }
    testingConnection.value = null
  }
  
  if (_progressiveAbort) { _progressiveAbort(); _progressiveAbort = null }
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

// 加载会话（懒加载：初始只加载最新的N条消息）
async function loadSession(id: string) {
  // 取消正在进行的渐进加载
  if (_progressiveAbort) { _progressiveAbort(); _progressiveAbort = null }

  currentSessionId.value = id
  hasMoreMessages.value = false
  totalMessages.value = 0
  
  try {
    // 初始只加载最新的 N 条消息
    const res = await get<any>(`/chat/session/${id}?limit=${MESSAGES_PER_PAGE}`)
    const session = res.data || res
    const loadedMessages: ChatMessage[] = session.messages || []
    
    // 记录分页信息
    hasMoreMessages.value = session.hasMore || false
    totalMessages.value = session.totalMessages || loadedMessages.length

    messages.value = []
    await nextTick()

    let cancelled = false
    _progressiveAbort = () => { cancelled = true }

    // 对加载的消息做渐进动画
    const ANIMATE_COUNT = 10
    const instantCount = Math.max(0, loadedMessages.length - ANIMATE_COUNT)

    if (instantCount > 0) {
      const batch = loadedMessages.slice(0, instantCount).map(m => ({ ...m, _uid: genMsgUid() }))
      messages.value.push(...batch)
      await nextTick()
      batch.forEach((_msg, i) => {
        if (_msg.chart && !noChartMode.value) renderChart(i, _msg.chart)
        if (_msg.charts?.length && !noChartMode.value) {
          _msg.charts.forEach((c: any, cIdx: number) => renderChart(i, c, cIdx))
        }
      })
    }

    // 逐条渐进加载剩余消息
    for (let i = instantCount; i < loadedMessages.length; i++) {
      if (cancelled) return

      const msg: ChatMessage = { ...loadedMessages[i], _uid: genMsgUid() }
      messages.value.push(msg)
      await nextTick()

      // 立即渲染图表，确保图表不丢失
      if (msg.chart && !noChartMode.value) renderChart(i, msg.chart)
      if (msg.charts?.length && !noChartMode.value) {
        msg.charts.forEach((c: any, cIdx: number) => renderChart(i, c, cIdx))
      }

      scrollToBottom()

      if (i < loadedMessages.length - 1) {
        await new Promise(r => setTimeout(r, 40))
      }
    }

    _progressiveAbort = null
  } catch (e) { message.error('加载会话失败') }
}

// 加载更早的历史消息（向上滚动时触发）
async function loadOlderMessages() {
  if (!currentSessionId.value || !hasMoreMessages.value || loadingMore.value) return
  
  loadingMore.value = true
  const scrollContainer = messagesRef.value
  const oldScrollHeight = scrollContainer?.scrollHeight || 0
  
  try {
    // 计算 offset：已加载的消息数量
    const offset = messages.value.length
    const res = await get<any>(`/chat/session/${currentSessionId.value}?limit=${MESSAGES_PER_PAGE}&offset=${offset}`)
    const session = res.data || res
    const olderMessages: ChatMessage[] = session.messages || []
    
    hasMoreMessages.value = session.hasMore || false
    
    if (olderMessages.length > 0) {
      // 将旧消息插入到数组开头
      const batch = olderMessages.map(m => ({ ...m, _uid: genMsgUid() }))
      messages.value.unshift(...batch)
      
      await nextTick()
      
      // 保持滚动位置：新的 scrollHeight - 旧的 scrollHeight
      if (scrollContainer) {
        const newScrollHeight = scrollContainer.scrollHeight
        scrollContainer.scrollTop = newScrollHeight - oldScrollHeight
      }
      
      // 渲染新加载消息的图表
      batch.forEach((_msg, i) => {
        if (_msg.chart && !noChartMode.value) renderChart(i, _msg.chart)
        if (_msg.charts?.length && !noChartMode.value) {
          _msg.charts.forEach((c: any, cIdx: number) => renderChart(i, c, cIdx))
        }
      })
    }
  } catch (e) {
    message.error('加载历史消息失败')
  } finally {
    loadingMore.value = false
  }
}

// 监听滚动事件，到顶部时加载更多
function handleMessagesScroll(e: Event) {
  const target = e.target as HTMLElement
  // 当滚动到顶部附近（50px）时触发加载
  if (target.scrollTop < 50 && hasMoreMessages.value && !loadingMore.value) {
    loadOlderMessages()
  }
}


// 新建对话
function newChat() {
  if (_progressiveAbort) { _progressiveAbort(); _progressiveAbort = null }
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

// 计算思考总时间
function getTotalThinkingTime(steps: ThinkingStep[]): number {
  return steps.reduce((sum, s) => sum + (s.duration || 0), 0)
}

// 更新思考步骤
function updateThinkingStep(stepName: string, status: 'pending' | 'running' | 'done' | 'error', duration?: number) {
  const step = currentThinkingSteps.value.find(s => s.step === stepName)
  if (step) {
    step.status = status
    if (duration !== undefined) step.duration = duration
  }
}

// 发送消息
async function handleSend(e?: KeyboardEvent) {
  if (loading.value) return
  console.log('=== handleSend called - VERSION 2.0 ===')
  if (e?.shiftKey) return
  e?.preventDefault()
  
  const question = inputText.value.trim()
  if (!question || !selectedDatasource.value) return

  inputText.value = ''
  messages.value.push({ role: 'user', content: question, _uid: genMsgUid() })
  scrollToBottom()

  // 初始化思考步骤（4步流程）
  currentThinkingSteps.value = [
    { step: '理解问题', status: 'running' },
    { step: '生成SQL', status: 'pending' },
    { step: '执行查询', status: 'pending' },
    { step: '生成回答', status: 'pending' },
  ]
  
  const stepTimers: Record<string, number> = {}
  stepTimers['理解问题'] = Date.now()

  loading.value = true
  try {
    // 模拟步骤更新：理解问题 → 生成SQL → 执行查询 → 生成回答
    setTimeout(() => {
      if (currentThinkingSteps.value.find(s => s.step === '理解问题')?.status === 'running') {
        updateThinkingStep('理解问题', 'done', Date.now() - stepTimers['理解问题'])
        updateThinkingStep('生成SQL', 'running')
        stepTimers['生成SQL'] = Date.now()
      }
    }, 800)
    setTimeout(() => {
      if (currentThinkingSteps.value.find(s => s.step === '生成SQL')?.status === 'running') {
        updateThinkingStep('生成SQL', 'done', Date.now() - stepTimers['生成SQL'])
        updateThinkingStep('执行查询', 'running')
        stepTimers['执行查询'] = Date.now()
      }
    }, 3000)
    setTimeout(() => {
      if (currentThinkingSteps.value.find(s => s.step === '执行查询')?.status === 'running') {
        updateThinkingStep('执行查询', 'done', Date.now() - stepTimers['执行查询'])
        updateThinkingStep('生成回答', 'running')
        stepTimers['生成回答'] = Date.now()
      }
    }, 5000)

    // 调用数据源查询接口（使用 aiPost，超时时间更长）
    const res = await aiPost<AskResponse>('/ask', {
      datasourceId: selectedDatasource.value.id,
      question,
      sessionId: currentSessionId.value || undefined,
      noChart: noChartMode.value
    })

    // 标记所有步骤完成
    currentThinkingSteps.value.forEach(s => {
      if (s.status !== 'done') {
        s.status = 'done'
        if (!s.duration && stepTimers[s.step]) {
          s.duration = Date.now() - stepTimers[s.step]
        }
      }
    })

    console.log('=== Frontend received response ===')
    
    const resBody = res.data
    
    if (resBody?.sessionId) currentSessionId.value = resBody.sessionId

    const askRes = resBody as any
    const answerContent = askRes.answer || '无法回答'

    // 保存思考步骤到消息中
    const finalSteps = [...currentThinkingSteps.value]

    messages.value.push({
      role: 'assistant',
      content: answerContent,
      sql: askRes.sql,
      chart: noChartMode.value ? undefined : askRes.chart, 
      charts: noChartMode.value ? undefined : askRes.charts,
      data: askRes.data,
      sources: askRes.sources,
      question,
      hasChart: !noChartMode.value && (!!askRes.chart || (askRes.charts && askRes.charts.length > 0)),
      thinkingSteps: finalSteps,
      showThinking: false,
      _uid: genMsgUid()
    })

    if (askRes.chart) {
      await nextTick()
      renderChart(messages.value.length - 1, askRes.chart)
    }

    if (askRes.charts && askRes.charts.length) {
      await nextTick()
      askRes.charts.forEach((c: any, cIdx: number) => {
        renderChart(messages.value.length - 1, c, cIdx)
      })
    }
    
    loadSessions()
  } catch (e: any) {
    // 标记当前步骤为错误
    currentThinkingSteps.value.forEach(s => {
      if (s.status === 'running') s.status = 'error'
    })
    messages.value.push({ 
      role: 'assistant', 
      content: e.message || '请求失败',
      thinkingSteps: [...currentThinkingSteps.value],
      showThinking: false,
      _uid: genMsgUid()
    })
  } finally {
    loading.value = false
    currentThinkingSteps.value = []
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
  // 移除 <think>...</think> 标签及其内容
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  try { return marked.parse(cleanText) as string }
  catch { return cleanText.replace(/\n/g, '<br>') }
}

// ECharts 渲染逻辑 (经典定制)
// --- 图表渲染公共工具函数 ---
function formatValue(value: number, fieldName?: string, scale: number = 1) {
  const isCurrency = fieldName && /(金额|货币|收入|支出|GNP|GDP|生产总值|产值|利润|薪资|工资)/i.test(fieldName)
  const isPopulation = fieldName && /(人口|人数|居民|市民)/i.test(fieldName)
  const isArea = fieldName && /(面积|国土|土地|区域)/i.test(fieldName)
  const isPercentage = fieldName && /(百分比|占比|比例|率)/i.test(fieldName)
  const isCount = fieldName && /(数量|个数|种类|语言|Count|Number|Total)/i.test(fieldName)
  
  if (isPercentage) return value.toFixed(2) + '%'
  
  const displayVal = value / scale
  const formattedVal = displayVal.toLocaleString(undefined, { maximumFractionDigits: 2 })

  if (isPopulation) {
    return formattedVal + (scale >= 100000000 ? '亿人' : (scale >= 10000 ? '万人' : '人'))
  }
  
  if (isArea) {
    return formattedVal + (scale >= 1000000 ? '万平方公里' : '平方公里')
  }
  
  if (isCurrency) {
    let unit = '元'
    if (scale >= 100000000) unit = '亿元'
    else if (scale >= 10000) unit = '万元'
    return formattedVal + unit
  }

  if (isCount) {
    const isLangOrType = fieldName && /(语言|种类|类型|Species|Type|Language)/i.test(fieldName)
    return formattedVal + (isLangOrType ? '种' : '个')
  }
  
  return formattedVal
}

function getUnitInfo(field: string, maxVal: number) {
  const isCurrency = /(金额|货币|收入|支出|GNP|GDP|生产总值|产值|利润|薪资|工资|Revenue|Cost|Price|Amount)/i.test(field)
  const isPopulation = /(人口|人数|居民|市民|Population)/i.test(field)
  const isCount = /(数量|个数|种类|语言|Count|Number|Total)/i.test(field)
  const isArea = /(面积|国土|土地|区域|SurfaceArea|Space)/i.test(field)
  const isPercentage = /(百分比|占比|比例|率|Percentage|Rate)/i.test(field)
  
  let unitName = '', scale = 1
  
  // 按照图中左上角的单位逻辑重新定义：10^8 -> 亿元, 10^4 -> 万元
  if (maxVal >= 100000000) { unitName = '亿'; scale = 100000000; }
  else if (maxVal >= 10000) { unitName = '万'; scale = 10000; }
  else { unitName = ''; scale = 1; }
  
  if (isCurrency) {
    unitName = unitName ? unitName + '元' : '元'
  } else if (isPopulation) {
    unitName = unitName ? unitName + '人' : '人'
  } else if (isArea) {
    unitName = unitName ? unitName + '平方公里' : '平方公里'
    if (scale >= 1000000) { unitName = '万平方公里'; scale = 1000000; }
  } else if (isCount) {
    const isLangOrType = /(语言|种类|类型|Species|Type|Language)/i.test(field)
    unitName = unitName ? unitName + (isLangOrType ? '种' : '个') : (isLangOrType ? '种' : '个')
  } else if (isPercentage) {
    unitName = '%'; scale = 1;
  } else if (!unitName) {
    unitName = ''
  }
  
  return { unitName, scale }
}

function getColorPalette(colorScheme: string, customColor?: string) {
  if (customColor) return [customColor]
  switch (colorScheme) {
    case 'blue': return ['#3b82f6', '#60a5fa', '#93c5fd', '#1e40af', '#2563eb']
    case 'green': return ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857']
    case 'orange': return ['#f59e0b', '#fbbf24', '#fcd34d', '#d97706', '#b45309']
    case 'purple': return ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9']
    case 'pink': return ['#ec4899', '#f472b6', '#f9a8d4', '#db2777', '#be185d']
    default: return ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']
  }
}

function renderECharts(dom: HTMLElement, chartData: any, customConfig?: ChartConfig) {
  const chart = echarts.init(dom)
  const { data, config, title, unitName, scale } = chartData
  const type = customConfig?.type || chartData.type
  const rotate = customConfig?.rotate ?? 0
  const colorScheme = customConfig?.colorScheme || 'gradient'
  const customColor = customConfig?.customColor
  
  const colorPalette = getColorPalette(colorScheme, customColor)
  const chartTitle = (title || '').replace(/[-\u2013\u2014\u2212]+/g, ' ').trim() || `${config.yField}统计`
  const legendName = config.yField || '数据值'

  let option: any = {
    title: { text: chartTitle, left: 'center', textStyle: { fontSize: 20, fontWeight: 'bold', color: '#2d3748' }, padding: [20, 0, 30, 0] },
    tooltip: {
      trigger: type === 'pie' || type === 'gauge' ? 'item' : 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      formatter: (params: any) => {
        if (!Array.isArray(params)) params = [params]
        let res = `<div style="font-weight:600;margin-bottom:8px;">${params[0].name || chartTitle}</div>`
        params.forEach((p: any) => { 
          const val = typeof p.value === 'object' ? (Array.isArray(p.value) ? p.value[p.encode?.y?.[0] || 0] : p.value) : p.value
          res += `<div>${p.marker} ${p.seriesName}: ${formatValue(val, config.yField, scale)}</div>` 
        })
        return res
      }
    },
    legend: { show: type === 'pie' || type === 'radar', bottom: 0 },
    grid: { left: 40, right: 40, top: 100, bottom: 120, containLabel: true },
    color: colorPalette,
    series: []
  }

  // 根据不同类型定制配置
  if (type === 'pie') {
    option.xAxis = undefined;
    option.yAxis = undefined;
    option.series = [{
      name: legendName,
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}: {d}%' },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      data: data.map((d: any) => ({ name: d[config.xField], value: d[config.yField] }))
    }]
  } else if (type === 'radar') {
    option.xAxis = undefined;
    option.yAxis = undefined;
    const maxValue = Math.max(...data.map((d: any) => d[config.yField])) * 1.2
    option.radar = {
      indicator: data.map((d: any) => ({ name: d[config.xField], max: maxValue })),
      center: ['50%', '55%'],
      radius: '65%'
    }
    option.series = [{
      name: legendName,
      type: 'radar',
      data: [{
        value: data.map((d: any) => d[config.yField]),
        name: legendName,
        areaStyle: { color: colorPalette[0], opacity: 0.3 },
        lineStyle: { width: 2 }
      }]
    }]
  } else if (type === 'funnel') {
    option.xAxis = undefined;
    option.yAxis = undefined;
    option.series = [{
      name: legendName,
      type: 'funnel',
      left: '10%', top: 100, bottom: 60, width: '80%',
      min: 0, max: Math.max(...data.map((d: any) => d[config.yField])),
      sort: 'descending', gap: 2,
      label: { show: true, position: 'inside' },
      data: data.map((d: any) => ({ name: d[config.xField], value: d[config.yField] }))
    }]
  } else if (type === 'gauge') {
    option.xAxis = undefined;
    option.yAxis = undefined;
    // 仪表盘通常显示汇总值或第一个值
    const displayValue = data[0]?.[config.yField] || 0
    option.series = [{
      name: legendName,
      type: 'gauge',
      progress: { show: true, width: 18 },
      axisLine: { lineStyle: { width: 18 } },
      axisTick: { show: false },
      splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
      axisLabel: { distance: 25, color: '#999', fontSize: 14 },
      anchor: { show: true, showAbove: true, size: 25, itemStyle: { borderWidth: 10 } },
      title: { show: false },
      detail: { valueAnimation: true, fontSize: 30, offsetCenter: [0, '70%'], formatter: (v: number) => formatValue(v, config.yField, scale) },
      data: [{ value: displayValue, name: data[0]?.[config.xField] || legendName }]
    }]
  } else {
    // 标准坐标系图表 (bar, line, area)
    const defaultRotate = data.length > 5 ? 35 : 0; // 智能旋转：数据多时自动倾斜
    option.xAxis = { 
      type: 'category', 
      data: data.map((d: any) => d[config.xField]), 
      axisLabel: { 
        fontSize: 12, 
        color: '#718096', 
        rotate: rotate || defaultRotate,
        interval: 0 // 强制显示所有标签
      } 
    };
    option.yAxis = {
      type: 'value',
      name: unitName ? `单位：${unitName}` : '',
      nameTextStyle: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', padding: [0, 0, 0, -45], align: 'left' },
      axisLabel: { fontSize: 14, color: '#718096', formatter: (v: number) => (v / scale).toLocaleString() },
      splitLine: { lineStyle: { type: 'dashed' } }
    };
    option.series = [{
      name: legendName,
      type: type === 'area' ? 'line' : (type || 'bar'),
      data: data.map((d: any) => d[config.yField]),
      areaStyle: type === 'area' ? {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: colorPalette[0] },
          { offset: 1, color: 'rgba(255,255,255,0.1)' }
        ])
      } : undefined,
      itemStyle: {
        borderRadius: type === 'bar' ? [8, 8, 0, 0] : 0,
        color: customColor ? customColor : (
          colorScheme === 'gradient' 
            ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: colorPalette[0] }, { offset: 1, color: colorPalette[1] || colorPalette[0] }])
            : colorPalette[0]
        )
      },
      barMaxWidth: 60,
      smooth: type === 'line' || type === 'area'
    }]
  }

  chart.setOption(option)
  
  // 确保在 DOM 准备好后进行 resize
  setTimeout(() => {
    chart.resize()
  }, 50)
  
  return chart
}

// G2Plot 渲染逻辑 (现代化)
function renderG2Plot(dom: HTMLElement, chartData: any, customConfig?: ChartConfig) {
  const { data, config, title, unitName, scale } = chartData
  const type = customConfig?.type || chartData.type
  const rotate = customConfig?.rotate ?? 0
  const colorScheme = customConfig?.colorScheme || 'gradient'
  const customColor = customConfig?.customColor
  
  const colorPalette = getColorPalette(colorScheme, customColor)
  const chartTitle = (title || '').replace(/[-\u2013\u2014\u2212]+/g, ' ').trim() || `${config.yField}统计`
  const legendName = config.yField || '数据值'
  
  // const yValues = data.map((d: any) => d[config.yField]).filter((v: any) => typeof v === 'number')
  // const maxValue = yValues.length > 0 ? Math.max(...yValues) : 0
  // const { unitName, scale } = getUnitInfo(config.yField, maxValue) // Removed as unitName and scale are passed in

  const titleDiv = document.createElement('div')
  Object.assign(titleDiv.style, { textAlign: 'center', fontSize: '20px', fontWeight: 'bold', color: '#2d3748', marginBottom: '15px' })
  titleDiv.innerText = chartTitle
  dom.appendChild(titleDiv)

  if (unitName) {
    const unitDiv = document.createElement('div')
    Object.assign(unitDiv.style, { fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textAlign: 'left', paddingLeft: '10px', marginBottom: '-5px', position: 'relative', zIndex: '1' })
    unitDiv.innerText = `单位：${unitName}`
    dom.appendChild(unitDiv)
  }

  const canvasDiv = document.createElement('div')
  Object.assign(canvasDiv.style, { width: '100%', height: '420px' })
  dom.appendChild(canvasDiv)

  const commonConfig: any = {
    data, xField: config.xField, yField: config.yField, legend: false, 
    padding: [20, 20, 130, 20], // 增加底部空间
    xAxis: { label: { rotate: rotate ? (rotate * Math.PI) / 180 : (data.length > 5 ? Math.PI / 5 : 0), autoHide: false, autoRotate: false } },
    yAxis: { label: { formatter: (v: string) => (parseFloat(v) / scale).toLocaleString() } },
    animation: true
  }

  let plot: any
  if (type === 'pie') {
    plot = new Pie(canvasDiv, {
      data,
      angleField: config.yField,
      colorField: config.xField,
      radius: 0.8,
      innerRadius: 0.6,
      label: { type: 'inner', offset: '-50%', content: '{value}', style: { textAlign: 'center', fontSize: 14 } },
      interactions: [{ type: 'element-selected' }, { type: 'element-active' }],
      statistic: { title: false, content: { style: { whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis' }, content: legendName } }
    })
  } else if (type === 'radar') {
    plot = new Radar(canvasDiv, {
      data,
      xField: config.xField,
      yField: config.yField,
      meta: { [config.yField]: { min: 0, nice: true } },
      xAxis: { line: null, tickLine: null, grid: { line: { style: { lineDash: [4, 4] } } } },
      yAxis: { line: null, tickLine: null, grid: { line: { type: 'line', style: { lineDash: [4, 4] } } } },
      area: {},
      point: { size: 2 }
    })
  } else if (type === 'funnel') {
    plot = new Funnel(canvasDiv, {
      data,
      xField: config.xField,
      yField: config.yField,
      dynamicHeight: true,
      legend: false
    })
    const yVal = data[0]?.[config.yField] || 0
    plot = new Gauge(canvasDiv, {
      percent: yVal / 100, // G2Plot Gauge percent is 0-1. If unit is 亿元, we assume data already scaled or handle here.
      range: { color: colorPalette[0] },
      indicator: { pointer: { style: { stroke: '#D0D0D0' } }, pin: { style: { stroke: '#D0D0D0' } } },
      axis: { label: { formatter: (v: any) => formatValue(v * 100, config.yField, scale) }, subTickLine: { count: 3 } },
      statistic: { content: { formatter: () => formatValue(yVal, config.yField, scale), style: { fontSize: '24px', color: '#4B535E' } } }
    })
  } else if (type === 'line' || type === 'area') {
    plot = new Line(canvasDiv, { ...commonConfig, smooth: true, area: type === 'area' ? {} : undefined })
  } else {
    plot = new Column(canvasDiv, { ...commonConfig, columnWidthRatio: 0.6 })
  }

  plot.render()
  return plot
}

// 渲染分发器
function renderChart(idx: number, chartData: any, subIdx?: number) {
  const containerId = subIdx !== undefined ? `chart-${idx}-${subIdx}` : `chart-${idx}`
  const container = document.getElementById(containerId)
  if (!container || !chartData) return

  const msg = messages.value[idx]
  if (!msg.chartConfig) {
    msg.chartConfig = { ...chartData.config, type: chartData.type, rotate: 0, colorScheme: 'gradient', width: '100%', height: 450 }
  }

  // 1. 数据预处理：翻译和缩放
  const translations = msg.chartConfig!.translations || {}
  const useTranslation = msg.chartConfig!.useTranslation !== false // 默认使用翻译
  const processedData = JSON.parse(JSON.stringify(chartData.data)).map((item: any) => {
    const newItem = { ...item }
    // 翻译 X 轴标签（如果启用翻译）
    const xVal = String(item[chartData.config.xField])
    if (useTranslation && translations[xVal]) {
      newItem[chartData.config.xField] = translations[xVal]
    }
    return newItem
  })

  // 获取数值范围并计算最合适的单位和比例
  const yValues = processedData.map((d: any) => d[chartData.config.yField]).filter((v: any) => typeof v === 'number')
  const maxValue = yValues.length > 0 ? Math.max(...yValues) : 0
  const { unitName, scale } = getUnitInfo(chartData.config.yField, maxValue)

  // 2. 清理现有实例
  if (chartCleanups[idx]) {
    chartCleanups[idx]()
    delete chartCleanups[idx]
  }

  // 3. 彻底清理并重建挂载点
  container.innerHTML = ''
  const dom = document.createElement('div')
  dom.className = 'chart-render-mount'
  dom.style.width = '100%'
  dom.style.height = '100%'
  container.appendChild(dom)
  
  // 4. 应用宽度限制和样式（强制块级显示以撑开宽度）
  const bubble = container.closest('.bubble') as HTMLElement
  if (bubble) {
    bubble.style.width = '100%'
    bubble.style.display = 'block'
  }

  const config = msg.chartConfig!
  const width = config.width || '100%'
  container.style.width = '100%'
  container.style.maxWidth = width === '100%' ? '100%' : (typeof width === 'number' ? `${width}px` : (width.endsWith('%') ? width : `${width}px`))
  container.style.height = typeof config.height === 'number' ? `${config.height}px` : config.height as string
  container.style.margin = '0 auto'

  const enhancedChartData = {
    ...chartData,
    data: processedData,
    unitName,
    scale
  }

  let chartInstance: any
  if (chartLib.value === 'echarts') {
    chartInstance = renderECharts(dom, enhancedChartData, config)
  } else {
    chartInstance = renderG2Plot(dom, enhancedChartData, config)
  }

  const resizeHandler = () => {
    if (chartLib.value === 'echarts') {
      chartInstance?.resize()
    } else {
      chartInstance?.update({ width: dom.clientWidth, height: dom.clientHeight })
    }
  }
  
  const resizeObserver = new ResizeObserver(() => { resizeHandler() })
  resizeObserver.observe(dom)
  
  const createdWithLib = chartLib.value
  chartCleanups[idx] = () => {
    resizeObserver.disconnect()
    if (createdWithLib === 'echarts') {
      try { echarts.dispose(dom) } catch (e) {}
    } else {
      try { chartInstance?.destroy() } catch (e) {}
    }
  }
}

// 生成大屏
function generateDashboard(question?: string) {
  if (!selectedDatasource.value) return
  const topic = question || prompt('请输入大屏主题')
  if (!topic) return
  
  // 获取token并添加到URL中
  const token = localStorage.getItem('token')
  const url = `/api/ai-qa/agent/dashboard/preview?datasourceId=${selectedDatasource.value.id}&topic=${encodeURIComponent(topic)}&theme=dark&token=${token}`
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

// 切换图表配置
async function updateChartConfig(idx: number, config: Partial<ChartConfig>, persist: boolean = false) {
  const msg = messages.value[idx]
  if (!msg.chartConfig) {
    msg.chartConfig = { ...msg.chart?.config }
  }
  msg.chartConfig = { ...msg.chartConfig, ...config }
  
  // 强制重新渲染图表
  nextTick(() => {
    if (msg.chart) {
      renderChart(idx, msg.chart)
    }
  })

  // 如果需要持久化且有会话ID，调用后端接口
  if (persist && currentSessionId.value) {
    try {
      await aiPost(`/chat/session/${currentSessionId.value}/message/${idx}/config`, config)
    } catch (e) {
      console.error('Failed to persist chart config:', e)
    }
  }
}

/**
 * 一键图表标签翻译
 */
/**
 * 一键图表标签翻译 (支持多种模式)
 */
async function translateChartByType(idx: number, mode: 'ai' | 'direct' = 'ai') {
  const msg = messages.value[idx]
  if (!msg.chart || !msg.chart.data) return

  const chartData = msg.chart
  const config = chartData.config
  const data = chartData.data

  // 提取需要翻译的英文文本 (X轴标签和图例名)
  const textsToTranslate: string[] = []
  data.forEach((d: any) => {
    if (d[config.xField]) textsToTranslate.push(String(d[config.xField]))
  })
  if (config.yField) textsToTranslate.push(config.yField)
  
  if (textsToTranslate.length === 0) return

  ;(msg as any).translating = true
  try {
    const endpoint = mode === 'direct' ? '/ai/translate/direct' : '/ai/translate'
    const res = await aiPost<any>(endpoint, { texts: textsToTranslate })
    const mapping = res.data || res
    if (mapping) {
      // 翻译完成后更新图表并持久化
      await updateChartConfig(idx, { translations: mapping }, true)
      message.success(mode === 'direct' ? '直接翻译完成' : 'AI 翻译完成')
    }
  } catch (e: any) {
    // 拦截器已经处理了大部分通用错误提示，这里仅做兜底日志或特定处理
    console.error('Translation failed:', e)
  } finally {
    ;(msg as any).translating = false
  }
}

// 保留原函数名以防止其他地方调用，但跳转到新函数
async function translateChart(idx: number) {
  return translateChartByType(idx, 'ai')
}

/**
 * 切换原文/译文显示
 */
async function toggleTranslation(idx: number) {
  const msg = messages.value[idx]
  if (!msg.chartConfig?.translations) return
  
  const useTranslation = msg.chartConfig.useTranslation === false ? true : false
  await updateChartConfig(idx, { useTranslation }, true)
  message.success(useTranslation ? '已切换到译文' : '已切换到原文')
}

// 历史记录过滤（已不再需要，改用分页加载）
const showAllHistory = ref(false)
const filteredMessages = computed(() => messages.value)

function loadMoreHistory() {
  // 触发加载更早的消息
  loadOlderMessages()
}

onMounted(() => { refreshDatasources() })
</script>


<style scoped>
.ai-chat-page {
  height: calc(100vh - 64px - 32px); /* 视口高度 - 顶部导航64px - admin-content上下padding(16px*2) */
  overflow: hidden;
  padding: 0;
  margin: 0; 
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
  grid-template-columns: 200px minmax(0, 1fr) 280px; /* 使用 minmax 防止溢出 */
  gap: 12px;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  align-items: stretch;
  grid-template-rows: 1fr;
}

.main-grid.hide-left {
  grid-template-columns: 1fr 280px;
}

.main-grid.hide-right {
  grid-template-columns: 200px 1fr; /* 保持一致 */
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
  white-space: nowrap; /* 强制不换行 */
  overflow: hidden;
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
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}
.ds-item .type { 
  font-size: 10px;
  background: rgba(0,0,0,0.05);
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0.7;
  flex-shrink: 0;
}
.ds-item.active .type {
  background: rgba(255,255,255,0.2);
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
  height: 100%;
}
.chat-card :deep(.ant-card-body) { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  padding: 0; 
  min-height: 0;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fafbfc;
  min-height: 0;
}

.history-load-more {
  text-align: center;
  padding: 12px 0 16px;
  color: #999;
  font-size: 13px;
  border-bottom: 1px dashed #e8e8e8;
  margin-bottom: 16px;
}
.history-load-more :deep(.ant-btn-link) {
  color: #667eea;
  font-size: 13px;
}
.history-load-more :deep(.ant-btn-link:hover) {
  color: #764ba2;
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

.message { margin-bottom: 16px; animation: msgSlideIn 0.3s ease-out both; }
@keyframes msgSlideIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}
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
.message.ai.has-chart .bubble { 
  width: 100%; 
  max-width: 100%; 
  display: flex;
  flex-direction: column;
} 

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

.chart-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
  padding: 4px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  position: relative;
  z-index: 100;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.chart-container { 
  width: 100%; 
  min-height: 600px; 
  height: auto;
  margin: 15px 0 30px 0; 
  padding: 10px; 
  background: #ffffff; 
  border: 1px solid #f0f0f0; 
  border-radius: 8px; 
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); 
  overflow: visible; /* 允许下拉菜单溢出 */
  position: relative;
}

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
  gap: 12px;
  margin-top: 30px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
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

.color-picker-input {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  background: transparent;
  vertical-align: middle;
}
.color-picker-input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.color-picker-input::-webkit-color-swatch {
  border: 2px solid #e2e8f0;
  border-radius: 50%;
}

/* 思考过程样式 - 紧凑折叠样式 */
.thinking-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.3s;
}

.thinking-step.pending { color: #bbb; }
.thinking-step.running { color: #667eea; }
.thinking-step.done { color: #52c41a; }
.thinking-step.error { color: #f5222d; }

.step-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.step-icon .done { color: #52c41a; }
.step-icon .error { color: #f5222d; }

.step-text { flex: 1; }

.step-duration {
  font-size: 10px;
  color: #999;
  font-family: monospace;
}

/* 可折叠思考过程（完成后和实时思考共用） */
.thinking-collapse {
  margin-bottom: 8px;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}

.thinking-collapse.thinking-live {
  border-color: #667eea44;
  background: #fafbff;
}

.thinking-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fafafa;
  cursor: pointer;
  font-size: 12px;
  color: #888;
  transition: all 0.2s;
}

.thinking-live .thinking-toggle {
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  color: #667eea;
}

.thinking-toggle:hover {
  background: #f0f0f0;
  color: #333;
}

.toggle-icon {
  font-size: 10px;
  color: #999;
  margin-left: auto;
}

.toggle-text {
  font-weight: 500;
  flex: 1;
}

.thinking-detail {
  padding: 6px 10px;
  background: white;
  border-top: 1px solid #f0f0f0;
}

.thinking-live .thinking-detail {
  background: #fcfcff;
}

.thinking-detail .thinking-step {
  padding: 2px 6px;
  background: transparent;
  font-size: 11px;
}

</style>
