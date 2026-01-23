<template>
  <div class="graph-view">
    <div class="graph-full-container">
      <div class="graph-controls-glass">
        <div class="stats-group">
          <div class="stat"><span class="val">{{ stats.entityCount }}</span><span class="lab">实体</span></div>
          <div class="stat"><span class="val">{{ stats.relationCount }}</span><span class="lab">关系</span></div>
        </div>
        <a-select v-model:value="graphFilter" placeholder="过滤实体类型" style="width: 140px" class="glass-select">
          <a-select-option value="">全部</a-select-option>
          <a-select-option v-for="t in entityTypes" :key="t" :value="t">{{ t }}</a-select-option>
        </a-select>
        <a-button shape="circle" @click="refreshGraph"><ReloadOutlined /></a-button>
      </div>
      <div id="knowledge-graph" class="graph-canvas-full"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { get } from '@/api/request'
import { stats } from './shared'
import * as echarts from 'echarts'

const graphFilter = ref('')
const entityTypes = ref<string[]>([])

async function loadKnowledgeGraph() {
  try {
    const res = await get<any>('/admin/ai-qa/rag/graph')
    if (res.success) {
      renderGraph(res.data)
      entityTypes.value = [...new Set(res.data?.entities?.map((e: any) => e.type) || [])] as string[]
    } else {
      renderGraph({ entities: [], relations: [] })
    }
  } catch (e: any) {
    console.error('加载知识图谱失败', e)
    renderGraph({ entities: [], relations: [] })
  }
}

function renderGraph(data: { entities?: any[], relations?: any[] } | null | undefined) {
  const dom = document.getElementById('knowledge-graph')
  if (!dom) return

  const existingChart = echarts.getInstanceByDom(dom)
  if (existingChart) {
    existingChart.dispose()
  }

  const chart = echarts.init(dom)
  
  const entities = data?.entities || []
  const relations = data?.relations || []
  
  // 筛选实体
  const filteredEntities = graphFilter.value 
    ? entities.filter((e: any) => e.type === graphFilter.value)
    : entities
  
  if (filteredEntities.length === 0) {
    chart.setOption({
      title: { text: '暂无知识图谱数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
    })
    return
  }

  const nodes = filteredEntities.map((e: any) => ({
    id: e.id,
    name: e.nameCn || e.name,
    category: e.type,
    symbolSize: 30
  }))

  const links = relations
    .filter((r: any) => {
      const hasSource = filteredEntities.some((e: any) => e.id === r.source)
      const hasTarget = filteredEntities.some((e: any) => e.id === r.target)
      return hasSource && hasTarget
    })
    .map((r: any) => ({
      source: r.source,
      target: r.target,
      value: r.type
    }))

  const categories = [...new Set(filteredEntities.map((e: any) => e.type))].map(t => ({ name: t }))

  chart.setOption({
    tooltip: {},
    legend: { data: categories.map(c => c.name), top: 10 },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: links,
      categories: categories,
      roam: true,
      label: { show: true, position: 'right' },
      force: { repulsion: 100, edgeLength: 80 },
      lineStyle: { color: 'source', curveness: 0.3 }
    }]
  })
}

function refreshGraph() {
  loadKnowledgeGraph()
}

watch(graphFilter, () => {
  loadKnowledgeGraph()
})

onMounted(() => {
  nextTick(() => {
    loadKnowledgeGraph()
  })
})
</script>

<style scoped>
.graph-view {
  height: 100%;
}

.graph-full-container {
  height: 100%;
  background: var(--bg-container);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow-sm);
}

.graph-controls-glass {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 5;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  padding: 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color-light);
}

.stats-group {
  display: flex;
  gap: 12px;
  padding: 0 8px;
  border-right: 1px solid var(--border-color-light);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat .val { 
  font-weight: bold; 
  font-size: 14px; 
  line-height: 1; 
  color: var(--text-primary);
}
.stat .lab { 
  font-size: 10px; 
  color: var(--text-tertiary); 
}

.graph-canvas-full {
  width: 100%;
  height: 100%;
}
</style>
