<template>
  <div class="graph-view">
    <div class="graph-full-container">
      <!-- 顶部控制栏 -->
      <div class="graph-controls-glass">
        <div class="stats-group">
          <div class="stat"><span class="val">{{ graphStats.entities }}</span><span class="lab">实体</span></div>
          <div class="stat"><span class="val">{{ graphStats.relations }}</span><span class="lab">关系</span></div>
        </div>
        <a-divider type="vertical" />
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索实体..."
          style="width: 200px"
          @search="handleSearch"
          allow-clear
        />
        <a-select v-model:value="graphFilter" placeholder="筛选类型" style="width: 120px" allow-clear>
          <a-select-option value="">全部</a-select-option>
          <a-select-option v-for="t in entityTypes" :key="t" :value="t">{{ entityTypeLabels[t] || t }}</a-select-option>
        </a-select>
        <a-divider type="vertical" />
        <a-button-group>
          <a-tooltip title="放大">
            <a-button @click="zoomIn"><ZoomInOutlined /></a-button>
          </a-tooltip>
          <a-tooltip title="缩小">
            <a-button @click="zoomOut"><ZoomOutOutlined /></a-button>
          </a-tooltip>
          <a-tooltip title="重置视图">
            <a-button @click="resetView"><FullscreenOutlined /></a-button>
          </a-tooltip>
        </a-button-group>
        <a-tooltip title="刷新">
          <a-button shape="circle" @click="refreshGraph" :loading="loading"><ReloadOutlined /></a-button>
        </a-tooltip>
      </div>

      <!-- 图谱画布 -->
      <div id="knowledge-graph" class="graph-canvas-full" ref="graphContainer"></div>

      <!-- 节点详情面板 -->
      <transition name="slide-fade">
        <div v-if="selectedEntity" class="entity-detail-panel">
          <div class="panel-header">
            <div class="entity-type-badge" :style="{ background: getEntityColor(selectedEntity.type) }">
              {{ entityTypeLabels[selectedEntity.type] || selectedEntity.type }}
            </div>
            <a-button type="text" size="small" @click="selectedEntity = null"><CloseOutlined /></a-button>
          </div>
          <div class="panel-content">
            <h3 class="entity-name">{{ selectedEntity.nameCn || selectedEntity.name }}</h3>
            <p class="entity-subname" v-if="selectedEntity.nameCn">{{ selectedEntity.name }}</p>
            <p class="entity-desc" v-if="selectedEntity.description">{{ selectedEntity.description }}</p>
            
            <div class="entity-relations" v-if="selectedEntityRelations.length > 0">
              <div class="section-title">关联实体 ({{ selectedEntityRelations.length }})</div>
              <div class="relation-list">
                <div 
                  v-for="rel in selectedEntityRelations" 
                  :key="rel.id" 
                  class="relation-item"
                  @click="focusEntity(rel.targetEntity)"
                >
                  <span class="rel-type">{{ relationTypeLabels[rel.type] || rel.type }}</span>
                  <span class="rel-target">{{ rel.targetEntity?.nameCn || rel.targetEntity?.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- 图例 -->
      <div class="graph-legend">
        <div class="legend-title">图例</div>
        <div class="legend-items">
          <div v-for="type in entityTypes" :key="type" class="legend-item">
            <span class="legend-dot" :style="{ background: getEntityColor(type) }"></span>
            <span class="legend-label">{{ entityTypeLabels[type] || type }}</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="isEmpty && !loading" class="empty-state">
        <DeploymentUnitOutlined style="font-size: 64px; color: #ccc;" />
        <h3>暂无知识图谱数据</h3>
        <p>请先导入数据源或上传文档，系统会自动提取实体和关系</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { 
  ReloadOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined,
  CloseOutlined, DeploymentUnitOutlined 
} from '@ant-design/icons-vue'
import { get, post } from '@/api/request'
import * as echarts from 'echarts'

interface Entity {
  id: string
  name: string
  nameCn?: string
  type: string
  description?: string
  properties?: Record<string, any>
}

interface Relation {
  id: string
  source: string
  target: string
  type: string
  weight?: number
}

// 实体类型标签
const entityTypeLabels: Record<string, string> = {
  table: '数据表',
  column: '字段',
  concept: '概念',
  person: '人物',
  org: '组织',
  location: '地点',
  time: '时间',
  event: '事件',
  metric: '指标',
  custom: '自定义'
}

// 关系类型标签
const relationTypeLabels: Record<string, string> = {
  has_column: '包含字段',
  references: '引用',
  belongs_to: '属于',
  related_to: '相关',
  part_of: '部分',
  instance_of: '实例',
  synonym: '同义',
  antonym: '反义',
  causes: '导致',
  follows: '跟随',
  custom: '自定义'
}

// 实体颜色配置
const entityColors: Record<string, string> = {
  table: '#7c3aed',
  column: '#3b82f6',
  concept: '#10b981',
  person: '#f59e0b',
  org: '#ef4444',
  location: '#06b6d4',
  time: '#8b5cf6',
  event: '#ec4899',
  metric: '#14b8a6',
  custom: '#6b7280'
}

// 状态
const loading = ref(false)
const graphFilter = ref('')
const searchKeyword = ref('')
const entityTypes = ref<string[]>([])
const selectedEntity = ref<Entity | null>(null)
const graphContainer = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

// 图谱数据
const graphData = ref<{ entities: Entity[], relations: Relation[] }>({ entities: [], relations: [] })

// 统计信息
const graphStats = computed(() => ({
  entities: graphData.value.entities.length,
  relations: graphData.value.relations.length
}))

// 是否为空
const isEmpty = computed(() => 
  graphData.value.entities.length === 0 && graphData.value.relations.length === 0
)

// 选中实体的关系
const selectedEntityRelations = computed(() => {
  if (!selectedEntity.value) return []
  
  return graphData.value.relations
    .filter(r => r.source === selectedEntity.value!.id || r.target === selectedEntity.value!.id)
    .map(r => {
      const targetId = r.source === selectedEntity.value!.id ? r.target : r.source
      const targetEntity = graphData.value.entities.find(e => e.id === targetId)
      return { ...r, targetEntity }
    })
    .slice(0, 10)
})

// 获取实体颜色
function getEntityColor(type: string): string {
  return entityColors[type] || entityColors.custom
}

// 加载知识图谱
async function loadKnowledgeGraph() {
  loading.value = true
  try {
    const res = await get<any>('/admin/ai-qa/rag/graph')
    if (res.success && res.data) {
      graphData.value = {
        entities: res.data.entities || [],
        relations: res.data.relations || []
      }
      entityTypes.value = [...new Set(graphData.value.entities.map(e => e.type))]
      renderGraph()
    } else {
      graphData.value = { entities: [], relations: [] }
      renderGraph()
    }
  } catch (e: any) {
    console.error('加载知识图谱失败', e)
    message.error('加载知识图谱失败')
    graphData.value = { entities: [], relations: [] }
  } finally {
    loading.value = false
  }
}

// 搜索子图
async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    loadKnowledgeGraph()
    return
  }
  
  loading.value = true
  try {
    const keywords = searchKeyword.value.split(/\s+/).filter(k => k)
    const res = await post<any>('/admin/ai-qa/rag/graph/query', { keywords, maxEntities: 50 })
    if (res.success && res.data) {
      graphData.value = {
        entities: res.data.entities || [],
        relations: res.data.relations || []
      }
      entityTypes.value = [...new Set(graphData.value.entities.map(e => e.type))]
      renderGraph()
    }
  } catch (e: any) {
    console.error('搜索知识图谱失败', e)
    message.error('搜索失败')
  } finally {
    loading.value = false
  }
}

// 渲染图谱
function renderGraph() {
  const dom = document.getElementById('knowledge-graph')
  if (!dom) return

  if (chartInstance) {
    chartInstance.dispose()
  }
  chartInstance = echarts.init(dom)

  let entities = graphData.value.entities
  let relations = graphData.value.relations

  // 应用筛选
  if (graphFilter.value) {
    entities = entities.filter(e => e.type === graphFilter.value)
    const entityIds = new Set(entities.map(e => e.id))
    relations = relations.filter(r => entityIds.has(r.source) && entityIds.has(r.target))
  }

  if (entities.length === 0) {
    chartInstance.setOption({
      graphic: [{
        type: 'group',
        left: 'center',
        top: 'center',
        children: [
          {
            type: 'text',
            style: {
              text: graphFilter.value ? '该类型暂无实体' : '暂无知识图谱数据',
              fill: '#999',
              fontSize: 16,
              font: 'bold 16px sans-serif'
            }
          }
        ]
      }]
    })
    return
  }

  // 构建节点
  const categories = entityTypes.value.map(type => ({
    name: entityTypeLabels[type] || type,
    itemStyle: { color: getEntityColor(type) }
  }))

  const nodes = entities.map(e => ({
    id: e.id,
    name: e.nameCn || e.name,
    value: e.name,
    category: entityTypes.value.indexOf(e.type),
    symbolSize: e.type === 'table' ? 45 : e.type === 'column' ? 25 : 35,
    label: {
      show: true,
      fontSize: e.type === 'table' ? 12 : 10
    },
    itemStyle: {
      color: getEntityColor(e.type),
      borderColor: '#fff',
      borderWidth: 2,
      shadowBlur: 10,
      shadowColor: 'rgba(0,0,0,0.2)'
    },
    // 自定义数据
    entity: e
  }))

  const links = relations
    .filter(r => {
      const hasSource = entities.some(e => e.id === r.source)
      const hasTarget = entities.some(e => e.id === r.target)
      return hasSource && hasTarget
    })
    .map(r => ({
      source: r.source,
      target: r.target,
      value: relationTypeLabels[r.type] || r.type,
      lineStyle: {
        color: '#adb5bd',
        curveness: 0.2,
        width: (r.weight || 0.5) * 3
      },
      label: {
        show: false,
        formatter: relationTypeLabels[r.type] || r.type,
        fontSize: 10
      }
    }))

  chartInstance.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const entity = params.data.entity as Entity
          return `
            <div style="font-weight: bold; margin-bottom: 4px;">${entity.nameCn || entity.name}</div>
            <div style="color: #888; font-size: 12px;">类型: ${entityTypeLabels[entity.type] || entity.type}</div>
            ${entity.description ? `<div style="margin-top: 4px; max-width: 200px;">${entity.description}</div>` : ''}
          `
        } else if (params.dataType === 'edge') {
          return `关系: ${params.data.value}`
        }
        return ''
      }
    },
    legend: {
      show: false  // 使用自定义图例
    },
    animationDuration: 800,
    animationEasingUpdate: 'quinticInOut',
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: links,
      categories: categories,
      roam: true,
      draggable: true,
      label: {
        show: true,
        position: 'right',
        distance: 5,
        fontSize: 11,
        color: '#333'
      },
      force: {
        repulsion: 300,
        gravity: 0.1,
        edgeLength: [80, 150],
        layoutAnimation: true
      },
      emphasis: {
        focus: 'adjacency',
        label: { show: true, fontSize: 13, fontWeight: 'bold' },
        lineStyle: { width: 4 },
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(0,0,0,0.5)'
        }
      },
      lineStyle: {
        opacity: 0.8,
        curveness: 0.2
      },
      edgeSymbol: ['circle', 'arrow'],
      edgeSymbolSize: [4, 8]
    }]
  })

  // 点击事件
  chartInstance.on('click', (params: any) => {
    if (params.dataType === 'node') {
      selectedEntity.value = params.data.entity
    }
  })

  // 响应式
  window.addEventListener('resize', handleResize)
}

function handleResize() {
  chartInstance?.resize()
}

// 缩放控制
function zoomIn() {
  if (chartInstance) {
    const option = chartInstance.getOption() as any
    const zoom = (option.series?.[0]?.zoom || 1) * 1.2
    chartInstance.setOption({ series: [{ zoom: Math.min(zoom, 5) }] })
  }
}

function zoomOut() {
  if (chartInstance) {
    const option = chartInstance.getOption() as any
    const zoom = (option.series?.[0]?.zoom || 1) / 1.2
    chartInstance.setOption({ series: [{ zoom: Math.max(zoom, 0.3) }] })
  }
}

function resetView() {
  renderGraph()
}

function refreshGraph() {
  loadKnowledgeGraph()
}

// 聚焦到某个实体
function focusEntity(entity?: Entity) {
  if (!entity || !chartInstance) return
  selectedEntity.value = entity
  // 可以添加高亮效果
}

// 监听筛选变化
watch(graphFilter, () => {
  renderGraph()
})

onMounted(() => {
  nextTick(() => {
    loadKnowledgeGraph()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.graph-view {
  height: 100%;
}

.graph-full-container {
  height: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow-sm);
}

.graph-controls-glass {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  padding: 12px 16px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

.stats-group {
  display: flex;
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat .val { 
  font-weight: 700; 
  font-size: 18px; 
  line-height: 1; 
  color: var(--primary-color);
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.stat .lab { 
  font-size: 11px; 
  color: var(--text-tertiary); 
  margin-top: 2px;
}

.graph-canvas-full {
  width: 100%;
  height: 100%;
}

/* 节点详情面板 */
.entity-detail-panel {
  position: absolute;
  right: 16px;
  top: 80px;
  width: 280px;
  max-height: calc(100% - 100px);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.8);
  overflow: hidden;
  z-index: 10;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-light);
}

.entity-type-badge {
  padding: 4px 12px;
  border-radius: 20px;
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
  max-height: 400px;
}

.entity-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.entity-subname {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.entity-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.relation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.relation-item:hover {
  background: var(--primary-bg-light);
}

.rel-type {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--border-color-light);
  border-radius: 4px;
  color: var(--text-tertiary);
}

.rel-target {
  font-size: 13px;
  color: var(--text-primary);
}

/* 图例 */
.graph-legend {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.legend-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 空状态 */
.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-tertiary);
}

.empty-state h3 {
  margin: 16px 0 8px;
  color: var(--text-secondary);
}

.empty-state p {
  font-size: 14px;
  max-width: 300px;
}

/* 动画 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
