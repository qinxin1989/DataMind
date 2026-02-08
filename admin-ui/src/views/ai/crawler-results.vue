<template>
  <div class="app-container p-6">
    <div class="mb-4 flex justify-between items-center">
      <h2 class="text-xl font-bold">采集结果库</h2>
      <div class="flex gap-4">
        <a-input v-model:value="searchForm.title" placeholder="标题搜索" style="width: 200px" allowClear @pressEnter="handleSearch" />
        <a-select 
          v-model:value="searchForm.department" 
          placeholder="归属部门" 
          style="width: 200px" 
          allowClear 
          show-search
          :options="departmentOptions"
          @change="handleSearch"
        />
        <a-select 
          v-model:value="searchForm.dataType" 
          placeholder="数据类型" 
          style="width: 150px" 
          allowClear 
          show-search
          :options="dataTypeOptions"
          @change="handleSearch"
        />
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </div>
    </div>

    <a-table 
      :columns="columns" 
      :data-source="data" 
      :loading="loading" 
      :pagination="pagination"
      @change="handleTableChange"
      rowKey="id"
      class="ant-table-striped"
      :row-class-name="(_record: any, index: number) => (index % 2 === 1 ? 'table-striped' : null)"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'title'">
          <div class="flex items-center">
            <a :href="record.link || '#'" target="_blank" class="text-blue-600 hover:underline truncate max-w-md block" :title="record.title">{{ record.title || '无标题' }}</a>
            <a-tag v-if="isNew(record.publish_date)" color="green" class="ml-2 flex-shrink-0 text-xs">New</a-tag>
          </div>
        </template>
        <template v-if="column.key === 'publish_date'">
          {{ formatDate(record.publish_date) }}
        </template>
        <template v-if="column.key === 'action'">
           <!-- Actions if needed -->
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { aiApi } from '@/api/ai'
import dayjs from 'dayjs'

const loading = ref(false)
const data = ref([])
const departmentOptions = ref<{ label: string; value: string }[]>([])
const dataTypeOptions = ref<{ label: string; value: string }[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const searchForm = reactive({
  title: '',
  department: undefined,
  dataType: undefined
})

const columns = [
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '发布日期', dataIndex: 'publish_date', key: 'publish_date', width: 150 },
  { title: '数据类型', dataIndex: 'data_type', key: 'data_type', width: 150 },
  { title: '归属部门', dataIndex: 'department', key: 'department', width: 200 },
  { title: '所属模板', dataIndex: 'template_name', key: 'template_name', width: 200, ellipsis: true },
]

// 1个月以内的标记一个新
const isNew = (dateStr: string) => {
  // Use created_at for "New" status logic since it reflects when WE got it
  // But checking record.publish_date might be better?
  // User wants "New" for recent items. created_at is strictly recent.
  if (!dateStr) return false
  const date = dayjs(dateStr)
  const oneMonthAgo = dayjs().subtract(1, 'month')
  return date.isAfter(oneMonthAgo)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD')
}

const loadOptions = async () => {
  try {
    const res: any = await aiApi.getCrawlerOptions()
    if (res.success && res.data) {
      departmentOptions.value = res.data.departments.map((d: string) => ({ label: d, value: d }))
      dataTypeOptions.value = res.data.dataTypes.map((t: string) => ({ label: t, value: t }))
    }
  } catch (err) {
    console.error('加载筛选选项失败', err)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const res: any = await aiApi.getCrawlerItems({
      page: pagination.current,
      pageSize: pagination.pageSize,
      department: searchForm.department,
      dataType: searchForm.dataType,
      title: searchForm.title
    })
    
    if (res.success) {
        data.value = res.data
        pagination.total = res.total
    } else {
         data.value = []
         pagination.total = 0
    }
    
  } catch (err) {
    console.error(err)
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.current = 1
  loadData()
}

const handleReset = () => {
  searchForm.title = ''
  searchForm.department = undefined
  searchForm.dataType = undefined
  handleSearch()
}

const handleTableChange = (pag: any) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadData()
}

onMounted(() => {
  loadOptions()
  loadData()
})
</script>

<style scoped>
.app-container {
  min-height: 100%;
}
.table-striped {
  background-color: #fafafa;
}
</style>
