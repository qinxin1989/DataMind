<template>
  <div class="dashboard-list-page">
    <div class="page-header">
      <h2>大屏管理</h2>
      <a-button type="primary" @click="showCreateModal">
        <PlusOutlined /> 新建大屏
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="dashboards"
      :loading="loading"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'theme'">
          <a-tag :color="record.theme === 'dark' ? 'blue' : 'default'">
            {{ record.theme === 'dark' ? '深色' : '浅色' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'createdAt'">
          {{ new Date(record.createdAt).toLocaleString() }}
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="editDashboard(record)">
              编辑
            </a-button>
            <a-button type="link" size="small" @click="previewDashboard(record)">
              预览
            </a-button>
            <a-popconfirm
              title="确定删除这个大屏吗？"
              @confirm="handleDelete(record.id)"
            >
              <a-button type="link" size="small" danger>
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 创建/编辑大屏弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑大屏' : '新建大屏'"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form :model="formData" layout="vertical">
        <a-form-item label="大屏名称" required>
          <a-input v-model:value="formData.name" placeholder="请输入大屏名称" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="formData.description" placeholder="请输入描述" :rows="3" />
        </a-form-item>
        <a-form-item label="数据源" required>
          <a-select v-model:value="formData.datasourceId" placeholder="请选择数据源">
            <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">
              {{ ds.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="主题">
          <a-radio-group v-model:value="formData.theme">
            <a-radio value="light">浅色</a-radio>
            <a-radio value="dark">深色</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { getDashboards, createDashboard, updateDashboard, deleteDashboard, Dashboard } from '@/api/dashboard';
import { get } from '@/api/request';
import { useRouter } from 'vue-router';

const router = useRouter();
const dashboards = ref<Dashboard[]>([]);
const datasources = ref<any[]>([]);
const loading = ref(false);
const modalVisible = ref(false);
const editingId = ref<string>('');
const formData = ref({
  name: '',
  description: '',
  datasourceId: '',
  theme: 'dark' as 'light' | 'dark',
});

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '数据源', dataIndex: 'datasourceName', key: 'datasourceName' },
  { title: '主题', key: 'theme' },
  { title: '创建时间', key: 'createdAt' },
  { title: '操作', key: 'action', width: 200 },
];

async function loadDashboards() {
  loading.value = true;
  try {
    const res = await getDashboards();
    // 处理响应格式
    if (Array.isArray(res)) {
      dashboards.value = res;
    } else if (res && typeof res === 'object') {
      dashboards.value = (res as any).data || (res as any).items || [];
    } else {
      dashboards.value = [];
    }
  } catch (e: any) {
    message.error('加载大屏列表失败: ' + (e.message || '未知错误'));
    console.error('Dashboard API error:', e);
  } finally {
    loading.value = false;
  }
}

async function loadDatasources() {
  try {
    const res = await get<any>('/datasource');
    datasources.value = Array.isArray(res) ? res : (res as any).data || [];
  } catch (e) {
    console.error('加载数据源失败', e);
  }
}

function showCreateModal() {
  editingId.value = '';
  formData.value = {
    name: '',
    description: '',
    datasourceId: '',
    theme: 'dark',
  };
  modalVisible.value = true;
}

function editDashboard(record: Dashboard) {
  router.push(`/dashboard/editor/${record.id}`);
}

function previewDashboard(record: Dashboard) {
  const token = localStorage.getItem('token');
  window.open(`/dashboard/preview/${record.id}?token=${token}`, '_blank');
}

async function handleSubmit() {
  if (!formData.value.name || !formData.value.datasourceId) {
    message.error('请填写必填项');
    return;
  }

  try {
    const datasource = datasources.value.find(ds => ds.id === formData.value.datasourceId);
    const data = {
      ...formData.value,
      datasourceName: datasource?.name,
      charts: [],
    };

    if (editingId.value) {
      await updateDashboard(editingId.value, data);
      message.success('更新成功');
    } else {
      await createDashboard(data);
      message.success('创建成功');
    }
    modalVisible.value = false;
    loadDashboards();
  } catch (e: any) {
    message.error(e.message || '操作失败');
  }
}

function handleCancel() {
  modalVisible.value = false;
}

async function handleDelete(id: string) {
  try {
    await deleteDashboard(id);
    message.success('删除成功');
    loadDashboards();
  } catch (e: any) {
    message.error('删除失败');
  }
}

onMounted(() => {
  loadDashboards();
  loadDatasources();
});
</script>

<style scoped>
.dashboard-list-page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
</style>
