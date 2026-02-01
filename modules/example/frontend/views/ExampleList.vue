<template>
  <div class="example-list">
    <a-card title="示例列表" :bordered="false">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-space>
          <a-input
            v-model:value="searchKeyword"
            placeholder="搜索标题或描述"
            style="width: 200px"
            @pressEnter="handleSearch"
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
          
          <a-select
            v-model:value="searchStatus"
            placeholder="状态"
            style="width: 120px"
            allowClear
            @change="handleSearch"
          >
            <a-select-option value="active">激活</a-select-option>
            <a-select-option value="inactive">未激活</a-select-option>
          </a-select>
          
          <a-button type="primary" @click="handleSearch">
            <SearchOutlined />
            搜索
          </a-button>
          
          <a-button @click="handleReset">
            <ReloadOutlined />
            重置
          </a-button>
          
          <a-button type="primary" @click="handleCreate">
            <PlusOutlined />
            新建
          </a-button>
          
          <a-button
            danger
            :disabled="selectedRowKeys.length === 0"
            @click="handleBatchDelete"
          >
            <DeleteOutlined />
            批量删除
          </a-button>
        </a-space>
      </div>

      <!-- 表格 -->
      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="pagination"
        :row-selection="rowSelection"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'default'">
              {{ record.status === 'active' ? '激活' : '未激活' }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="handleView(record)">
                查看
              </a-button>
              <a-button type="link" size="small" @click="handleEdit(record)">
                编辑
              </a-button>
              <a-popconfirm
                title="确定要删除吗？"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 表单弹窗 -->
    <ExampleForm
      v-model:visible="formVisible"
      :record="currentRecord"
      @success="handleFormSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue';
import { exampleApi } from '../api';
import ExampleForm from '../components/ExampleForm.vue';
import type { ExampleItem } from '../../backend/types';

// 搜索条件
const searchKeyword = ref('');
const searchStatus = ref<'active' | 'inactive' | undefined>();

// 表格数据
const dataSource = ref<ExampleItem[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
});

// 表格列定义
const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 280
  },
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title'
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180
  },
  {
    title: '操作',
    key: 'action',
    width: 200
  }
];

// 行选择
const selectedRowKeys = ref<string[]>([]);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: string[]) => {
    selectedRowKeys.value = keys;
  }
}));

// 表单
const formVisible = ref(false);
const currentRecord = ref<ExampleItem | undefined>();

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const result = await exampleApi.getList({
      page: pagination.current,
      pageSize: pagination.pageSize,
      status: searchStatus.value,
      keyword: searchKeyword.value || undefined
    });

    dataSource.value = result.items;
    pagination.total = result.total;
  } catch (error: any) {
    message.error(error.message || '加载数据失败');
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  pagination.current = 1;
  loadData();
};

// 重置
const handleReset = () => {
  searchKeyword.value = '';
  searchStatus.value = undefined;
  pagination.current = 1;
  loadData();
};

// 表格变化
const handleTableChange = (pag: any) => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  loadData();
};

// 新建
const handleCreate = () => {
  currentRecord.value = undefined;
  formVisible.value = true;
};

// 查看
const handleView = (record: ExampleItem) => {
  message.info('查看功能待实现');
};

// 编辑
const handleEdit = (record: ExampleItem) => {
  currentRecord.value = record;
  formVisible.value = true;
};

// 删除
const handleDelete = async (record: ExampleItem) => {
  try {
    await exampleApi.delete(record.id);
    message.success('删除成功');
    loadData();
  } catch (error: any) {
    message.error(error.message || '删除失败');
  }
};

// 批量删除
const handleBatchDelete = async () => {
  try {
    const count = await exampleApi.batchDelete(selectedRowKeys.value);
    message.success(`成功删除 ${count} 条记录`);
    selectedRowKeys.value = [];
    loadData();
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  }
};

// 表单成功
const handleFormSuccess = () => {
  formVisible.value = false;
  loadData();
};

// 初始化
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.example-list {
  padding: 24px;
}

.search-bar {
  margin-bottom: 16px;
}
</style>
