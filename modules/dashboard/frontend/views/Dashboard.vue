<template>
  <div class="dashboard-management">
    <div class="header">
      <h2>大屏管理</h2>
      <a-button type="primary" @click="showCreateModal">
        <template #icon><PlusOutlined /></template>
        创建大屏
      </a-button>
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="16" class="stats-row">
      <a-col :span="6">
        <a-card>
          <a-statistic title="总数" :value="stats.total" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="草稿" :value="stats.draft" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="已发布" :value="stats.published" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="已归档" :value="stats.archived" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 过滤器 -->
    <div class="filters">
      <a-space>
        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          style="width: 120px"
          allowClear
          @change="loadDashboards"
        >
          <a-select-option value="draft">草稿</a-select-option>
          <a-select-option value="published">已发布</a-select-option>
          <a-select-option value="archived">已归档</a-select-option>
        </a-select>
        <a-input-search
          v-model:value="filters.keyword"
          placeholder="搜索大屏名称"
          style="width: 300px"
          @search="loadDashboards"
        />
      </a-space>
    </div>

    <!-- 大屏列表 -->
    <a-table
      :columns="columns"
      :data-source="dashboards"
      :loading="loading"
      :pagination="pagination"
      @change="handleTableChange"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status)">
            {{ getStatusText(record.status) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'theme'">
          <a-tag>{{ record.theme }}</a-tag>
        </template>
        <template v-else-if="column.key === 'charts'">
          {{ record.charts.length }} 个图表
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="viewDashboard(record)">查看</a-button>
            <a-button size="small" @click="editDashboard(record)">编辑</a-button>
            <a-button
              v-if="record.status === 'draft'"
              size="small"
              type="primary"
              @click="publishDashboard(record.id)"
            >
              发布
            </a-button>
            <a-button
              v-if="record.status === 'published'"
              size="small"
              @click="unpublishDashboard(record.id)"
            >
              取消发布
            </a-button>
            <a-popconfirm
              title="确定要删除这个大屏吗？"
              @confirm="deleteDashboard(record.id)"
            >
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 创建/编辑模态框 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="editingDashboard ? '编辑大屏' : '创建大屏'"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="大屏名称" required>
          <a-input v-model:value="form.name" placeholder="请输入大屏名称" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea
            v-model:value="form.description"
            placeholder="请输入大屏描述"
            :rows="3"
          />
        </a-form-item>
        <a-form-item label="数据源ID" required>
          <a-input v-model:value="form.datasourceId" placeholder="请输入数据源ID" />
        </a-form-item>
        <a-form-item label="主题">
          <a-select v-model:value="form.theme">
            <a-select-option value="light">浅色</a-select-option>
            <a-select-option value="dark">深色</a-select-option>
            <a-select-option value="blue">蓝色</a-select-option>
            <a-select-option value="tech">科技</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import * as dashboardApi from '../api';
import type { Dashboard } from '../../backend/types';

// 状态
const loading = ref(false);
const dashboards = ref<Dashboard[]>([]);
const stats = ref({
  total: 0,
  draft: 0,
  published: 0,
  archived: 0,
});

// 过滤器
const filters = reactive({
  status: undefined as string | undefined,
  keyword: '',
});

// 分页
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 模态框
const modalVisible = ref(false);
const editingDashboard = ref<Dashboard | null>(null);
const form = reactive({
  name: '',
  description: '',
  datasourceId: '',
  theme: 'dark',
});

// 表格列
const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '状态', key: 'status' },
  { title: '主题', key: 'theme' },
  { title: '图表数', key: 'charts' },
  { title: '创建时间', key: 'createdAt' },
  { title: '操作', key: 'action', width: 300 },
];

// 加载大屏列表
async function loadDashboards() {
  loading.value = true;
  try {
    const response = await dashboardApi.getDashboards({
      page: pagination.current,
      pageSize: pagination.pageSize,
      status: filters.status as any,
      keyword: filters.keyword,
    });
    dashboards.value = response.items;
    pagination.total = response.total;
  } catch (error: any) {
    message.error('加载大屏列表失败: ' + error.message);
  } finally {
    loading.value = false;
  }
}

// 加载统计信息
async function loadStats() {
  try {
    stats.value = await dashboardApi.getDashboardStats();
  } catch (error: any) {
    console.error('加载统计信息失败:', error);
  }
}

// 表格变化
function handleTableChange(pag: any) {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  loadDashboards();
}

// 显示创建模态框
function showCreateModal() {
  editingDashboard.value = null;
  form.name = '';
  form.description = '';
  form.datasourceId = '';
  form.theme = 'dark';
  modalVisible.value = true;
}

// 编辑大屏
function editDashboard(dashboard: Dashboard) {
  editingDashboard.value = dashboard;
  form.name = dashboard.name;
  form.description = dashboard.description || '';
  form.datasourceId = dashboard.datasourceId;
  form.theme = dashboard.theme;
  modalVisible.value = true;
}

// 提交表单
async function handleSubmit() {
  if (!form.name || !form.datasourceId) {
    message.error('请填写必填项');
    return;
  }

  try {
    if (editingDashboard.value) {
      await dashboardApi.updateDashboard(editingDashboard.value.id, {
        name: form.name,
        description: form.description,
        theme: form.theme as any,
      });
      message.success('更新成功');
    } else {
      await dashboardApi.createDashboard({
        name: form.name,
        description: form.description,
        datasourceId: form.datasourceId,
        theme: form.theme as any,
      });
      message.success('创建成功');
    }
    modalVisible.value = false;
    loadDashboards();
    loadStats();
  } catch (error: any) {
    message.error('操作失败: ' + error.message);
  }
}

// 取消
function handleCancel() {
  modalVisible.value = false;
}

// 查看大屏
function viewDashboard(dashboard: Dashboard) {
  message.info('查看大屏: ' + dashboard.name);
  // TODO: 跳转到大屏预览页面
}

// 发布大屏
async function publishDashboard(id: string) {
  try {
    await dashboardApi.publishDashboard(id);
    message.success('发布成功');
    loadDashboards();
    loadStats();
  } catch (error: any) {
    message.error('发布失败: ' + error.message);
  }
}

// 取消发布
async function unpublishDashboard(id: string) {
  try {
    await dashboardApi.unpublishDashboard(id);
    message.success('取消发布成功');
    loadDashboards();
    loadStats();
  } catch (error: any) {
    message.error('操作失败: ' + error.message);
  }
}

// 删除大屏
async function deleteDashboard(id: string) {
  try {
    await dashboardApi.deleteDashboard(id);
    message.success('删除成功');
    loadDashboards();
    loadStats();
  } catch (error: any) {
    message.error('删除失败: ' + error.message);
  }
}

// 获取状态颜色
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'default',
    published: 'success',
    archived: 'warning',
  };
  return colors[status] || 'default';
}

// 获取状态文本
function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  };
  return texts[status] || status;
}

// 格式化日期
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 初始化
onMounted(() => {
  loadDashboards();
  loadStats();
});
</script>

<style scoped>
.dashboard-management {
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.stats-row {
  margin-bottom: 24px;
}

.filters {
  margin-bottom: 16px;
}
</style>
