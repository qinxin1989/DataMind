<template>
  <div class="dashboard-editor">
    <div class="editor-header">
      <div class="header-left">
        <a-button type="link" @click="goBack">
          <LeftOutlined /> 返回
        </a-button>
        <h2>{{ dashboard?.name || '大屏编辑器' }}</h2>
      </div>
      <div class="header-right">
        <a-button @click="addChart">
          <PlusOutlined /> 添加图表
        </a-button>
        <a-button type="primary" @click="saveDashboard" :loading="saving">
          保存
        </a-button>
      </div>
    </div>

    <div class="editor-content">
      <!-- 左侧工具栏 -->
      <div class="editor-sidebar">
        <h3>图表类型</h3>
        <div class="chart-types">
          <div class="chart-type-item" @click="addChartByType('bar')">
            <BarChartOutlined />
            <span>柱状图</span>
          </div>
          <div class="chart-type-item" @click="addChartByType('line')">
            <LineChartOutlined />
            <span>折线图</span>
          </div>
          <div class="chart-type-item" @click="addChartByType('pie')">
            <PieChartOutlined />
            <span>饼图</span>
          </div>
          <div class="chart-type-item" @click="addChartByType('card')">
            <DashboardOutlined />
            <span>卡片</span>
          </div>
        </div>
      </div>

      <!-- 中间画布区域 -->
      <div class="editor-canvas" :class="{ dark: dashboard?.theme === 'dark' }">
        <div
          v-for="chart in charts"
          :key="chart.id"
          class="chart-item"
          :style="{
            left: chart.x + 'px',
            top: chart.y + 'px',
            width: chart.w + 'px',
            height: chart.h + 'px',
          }"
          @mousedown="startDrag(chart, $event)"
        >
          <div class="chart-header">
            <span>{{ chart.title }}</span>
            <div class="chart-actions">
              <EditOutlined @click="editChart(chart)" />
              <DeleteOutlined @click="deleteChart(chart.id)" />
            </div>
          </div>
          <div class="chart-body" :id="'chart-' + chart.id"></div>
          <div class="resize-handle" @mousedown.stop="startResize(chart, $event)"></div>
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <div v-if="selectedChart" class="editor-properties">
        <h3>图表属性</h3>
        <a-form layout="vertical">
          <a-form-item label="标题">
            <a-input v-model:value="selectedChart.title" />
          </a-form-item>
          <a-form-item label="类型">
            <a-select v-model:value="selectedChart.type">
              <a-select-option value="bar">柱状图</a-select-option>
              <a-select-option value="line">折线图</a-select-option>
              <a-select-option value="pie">饼图</a-select-option>
              <a-select-option value="card">卡片</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="SQL查询">
            <a-textarea v-model:value="selectedChart.config.sql" :rows="4" />
          </a-form-item>
          <a-button type="primary" block @click="refreshChartData">
            刷新数据
          </a-button>
        </a-form>
      </div>
    </div>

    <!-- 添加图表弹窗 -->
    <a-modal
      v-model:open="chartModalVisible"
      title="添加图表"
      @ok="handleAddChart"
      @cancel="chartModalVisible = false"
    >
      <a-form layout="vertical">
        <a-form-item label="图表标题">
          <a-input v-model:value="newChart.title" placeholder="请输入标题" />
        </a-form-item>
        <a-form-item label="图表类型">
          <a-select v-model:value="newChart.type">
            <a-select-option value="bar">柱状图</a-select-option>
            <a-select-option value="line">折线图</a-select-option>
            <a-select-option value="pie">饼图</a-select-option>
            <a-select-option value="card">卡片</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import {
  LeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  BarChartOutlined, LineChartOutlined, PieChartOutlined, DashboardOutlined
} from '@ant-design/icons-vue';
import { getDashboard, updateDashboard, Dashboard, DashboardChart } from '@/api/dashboard';
import * as echarts from 'echarts';

const route = useRoute();
const router = useRouter();
const dashboard = ref<Dashboard | null>(null);
const charts = ref<DashboardChart[]>([]);
const selectedChart = ref<DashboardChart | null>(null);
const saving = ref(false);
const chartModalVisible = ref(false);
const newChart = ref({
  title: '',
  type: 'bar' as any,
});

// 拖拽相关
const dragging = ref(false);
const resizing = ref(false);
const dragStart = ref({ x: 0, y: 0, chartX: 0, chartY: 0 });
const currentChart = ref<DashboardChart | null>(null);

async function loadDashboard() {
  const id = route.params.id as string;
  try {
    const res = await getDashboard(id);
    dashboard.value = res as any;
    charts.value = dashboard.value?.charts || [];
    
    // 渲染所有图表
    await nextTick();
    charts.value.forEach(chart => {
      if (chart.data) {
        renderChart(chart);
      }
    });
  } catch (e: any) {
    message.error('加载大屏失败');
  }
}

function goBack() {
  router.push('/dashboard/list');
}

function addChart() {
  newChart.value = {
    title: '新图表',
    type: 'bar',
  };
  chartModalVisible.value = true;
}

function addChartByType(type: string) {
  const chart: DashboardChart = {
    id: Date.now().toString(),
    type: type as any,
    title: `新${type}图表`,
    x: 50,
    y: 50,
    w: 400,
    h: 300,
    config: { sql: '' },
  };
  charts.value.push(chart);
  selectedChart.value = chart;
}

function handleAddChart() {
  const chart: DashboardChart = {
    id: Date.now().toString(),
    type: newChart.value.type,
    title: newChart.value.title,
    x: 50,
    y: 50,
    w: 400,
    h: 300,
    config: { sql: '' },
  };
  charts.value.push(chart);
  chartModalVisible.value = false;
  selectedChart.value = chart;
}

function editChart(chart: DashboardChart) {
  selectedChart.value = chart;
}

function deleteChart(id: string) {
  charts.value = charts.value.filter(c => c.id !== id);
  if (selectedChart.value?.id === id) {
    selectedChart.value = null;
  }
}

// 拖拽功能
function startDrag(chart: DashboardChart, e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
  
  dragging.value = true;
  currentChart.value = chart;
  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    chartX: chart.x,
    chartY: chart.y,
  };
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}

function onDrag(e: MouseEvent) {
  if (!dragging.value || !currentChart.value) return;
  
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  
  currentChart.value.x = dragStart.value.chartX + dx;
  currentChart.value.y = dragStart.value.chartY + dy;
}

function stopDrag() {
  dragging.value = false;
  currentChart.value = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// 调整大小功能
function startResize(chart: DashboardChart, e: MouseEvent) {
  resizing.value = true;
  currentChart.value = chart;
  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    chartX: chart.w,
    chartY: chart.h,
  };
  
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}

function onResize(e: MouseEvent) {
  if (!resizing.value || !currentChart.value) return;
  
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  
  currentChart.value.w = Math.max(200, dragStart.value.chartX + dx);
  currentChart.value.h = Math.max(150, dragStart.value.chartY + dy);
  
  // 重新渲染图表
  if (currentChart.value.data) {
    nextTick(() => renderChart(currentChart.value!));
  }
}

function stopResize() {
  resizing.value = false;
  currentChart.value = null;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

function renderChart(chart: DashboardChart) {
  const dom = document.getElementById('chart-' + chart.id);
  if (!dom || !chart.data) return;
  
  const chartInstance = echarts.init(dom);
  const option: any = {
    title: { text: chart.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {},
  };
  
  if (chart.type === 'pie') {
    option.series = [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: chart.data.map((d: any) => ({
        name: Object.values(d)[0],
        value: Object.values(d)[1],
      })),
    }];
  } else if (chart.type === 'card') {
    // 卡片类型显示数值
    dom.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
      <div style="font-size:48px;font-weight:bold;color:#1890ff;">${chart.data[0] ? Object.values(chart.data[0])[0] : 0}</div>
      <div style="font-size:16px;color:#666;margin-top:8px;">${chart.title}</div>
    </div>`;
    return;
  } else {
    const keys = chart.data.length > 0 ? Object.keys(chart.data[0]) : [];
    option.xAxis = {
      type: 'category',
      data: chart.data.map((d: any) => d[keys[0]]),
    };
    option.yAxis = { type: 'value' };
    option.series = [{
      type: chart.type,
      data: chart.data.map((d: any) => d[keys[1]]),
      smooth: chart.type === 'line',
    }];
  }
  
  chartInstance.setOption(option);
}

async function refreshChartData() {
  if (!selectedChart.value || !selectedChart.value.config.sql) {
    message.error('请输入SQL查询');
    return;
  }
  
  // TODO: 调用后端API执行SQL查询
  message.info('功能开发中');
}

async function saveDashboard() {
  if (!dashboard.value) return;
  
  saving.value = true;
  try {
    await updateDashboard(dashboard.value.id, {
      charts: charts.value,
    });
    message.success('保存成功');
  } catch (e: any) {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadDashboard();
});
</script>

<style scoped>
.dashboard-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid #e8e8e8;
  padding: 16px;
  overflow-y: auto;
}

.editor-sidebar h3 {
  font-size: 14px;
  margin-bottom: 12px;
}

.chart-types {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.chart-type-item:hover {
  border-color: #1890ff;
  background: #e6f7ff;
}

.editor-canvas {
  flex: 1;
  position: relative;
  background: #fafafa;
  overflow: auto;
}

.editor-canvas.dark {
  background: #1a1a1a;
}

.chart-item {
  position: absolute;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: move;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.chart-item:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24,144,255,0.3);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 500;
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.chart-actions > * {
  cursor: pointer;
  color: #666;
}

.chart-actions > *:hover {
  color: #1890ff;
}

.chart-body {
  height: calc(100% - 40px);
  padding: 8px;
}

.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #1890ff 50%);
}

.editor-properties {
  width: 300px;
  background: white;
  border-left: 1px solid #e8e8e8;
  padding: 16px;
  overflow-y: auto;
}

.editor-properties h3 {
  font-size: 14px;
  margin-bottom: 16px;
}
</style>
