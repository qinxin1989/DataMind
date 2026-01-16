<template>
  <div class="user-management">
    <div class="page-header">
      <h1>用户管理</h1>
    </div>

    <!-- 搜索表单 -->
    <div class="search-form">
      <a-form layout="inline" :model="searchForm">
        <a-form-item label="关键词">
          <a-input v-model:value="searchForm.keyword" placeholder="用户名/邮箱" allow-clear />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="searchForm.status" placeholder="全部" allow-clear style="width: 120px">
            <a-select-option value="active">正常</a-select-option>
            <a-select-option value="inactive">禁用</a-select-option>
            <a-select-option value="suspended">锁定</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch"><SearchOutlined /> 搜索</a-button>
            <a-button @click="handleReset">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </div>

    <!-- 操作栏 -->
    <div class="table-toolbar">
      <div class="table-toolbar-left">
        <a-button type="primary" @click="handleAdd" v-permission="'user:create'">
          <template #icon><PlusOutlined /></template>
          新增用户
        </a-button>
        <a-button
          :disabled="!selectedRowKeys.length"
          @click="handleBatchDisable"
          v-permission="'user:update'"
        >
          批量禁用
        </a-button>
      </div>
      <div class="table-toolbar-right">
        <a-button @click="handleRefresh">
          <template #icon><ReloadOutlined /></template>
        </a-button>
      </div>
    </div>

    <!-- 用户表格 -->
    <a-table
      :columns="columns"
      :data-source="users"
      :loading="loading"
      :pagination="pagination"
      :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
      row-key="id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status)">
            {{ getStatusText(record.status) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'role'">
          <a-tag color="blue">{{ getRoleText(record.role) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleEdit(record)" v-permission="'user:update'">
              编辑
            </a-button>
            <a-button type="link" size="small" @click="handleResetPassword(record)" v-permission="'user:update'">
              重置密码
            </a-button>
            <a-popconfirm title="确定删除该用户？" @confirm="handleDelete(record)" v-permission="'user:delete'">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingUser ? '编辑用户' : '新增用户'"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
    >
      <a-form :model="formState" :rules="formRules" ref="formRef" layout="vertical">
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="formState.username" :disabled="!!editingUser" />
        </a-form-item>
        <a-form-item label="邮箱" name="email">
          <a-input v-model:value="formState.email" />
        </a-form-item>
        <a-form-item label="姓名" name="fullName">
          <a-input v-model:value="formState.fullName" />
        </a-form-item>
        <a-form-item v-if="!editingUser" label="密码" name="password">
          <a-input-password v-model:value="formState.password" />
        </a-form-item>
        <a-form-item label="角色" name="role">
          <a-select v-model:value="formState.role">
            <a-select-option value="admin">管理员</a-select-option>
            <a-select-option value="user">普通用户</a-select-option>
            <a-select-option value="viewer">只读用户</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-select v-model:value="formState.status">
            <a-select-option value="active">正常</a-select-option>
            <a-select-option value="inactive">禁用</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { userApi } from '@/api/user'
import type { User } from '@/types'

const loading = ref(false)
const users = ref<User[]>([])
const selectedRowKeys = ref<string[]>([])
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingUser = ref<User | null>(null)
const formRef = ref()

const searchForm = reactive({
  keyword: '',
  status: undefined as string | undefined,
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const formState = reactive({
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'user' as 'admin' | 'user' | 'viewer',
  status: 'active' as 'active' | 'inactive',
})

const formRules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色' }],
}

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '姓名', dataIndex: 'fullName', key: 'fullName' },
  { title: '角色', dataIndex: 'role', key: 'role' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action', width: 200 },
]

onMounted(() => {
  fetchUsers()
})

async function fetchUsers() {
  loading.value = true
  try {
    const res = await userApi.getList({
      ...searchForm,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    if (res.success && res.data) {
      users.value = res.data.list
      pagination.total = res.data.total
    }
  } catch (error) {
    // 使用模拟数据
    users.value = [
      { id: '1', username: 'admin', email: 'admin@example.com', fullName: '管理员', role: 'admin', status: 'active', roleIds: [], createdAt: Date.now(), updatedAt: Date.now() },
      { id: '2', username: 'user1', email: 'user1@example.com', fullName: '用户1', role: 'user', status: 'active', roleIds: [], createdAt: Date.now(), updatedAt: Date.now() },
    ]
    pagination.total = 2
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.current = 1
  fetchUsers()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  handleSearch()
}

function handleRefresh() {
  fetchUsers()
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchUsers()
}

function onSelectChange(keys: string[]) {
  selectedRowKeys.value = keys
}

function handleAdd() {
  editingUser.value = null
  Object.assign(formState, { username: '', email: '', fullName: '', password: '', role: 'user', status: 'active' })
  modalVisible.value = true
}

function handleEdit(record: User) {
  editingUser.value = record
  Object.assign(formState, { ...record, password: '' })
  modalVisible.value = true
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    
    if (editingUser.value) {
      await userApi.update(editingUser.value.id, formState)
      message.success('更新成功')
    } else {
      await userApi.create(formState)
      message.success('创建成功')
    }
    
    modalVisible.value = false
    fetchUsers()
  } catch (error) {
    // 验证失败或API错误
  } finally {
    modalLoading.value = false
  }
}

async function handleDelete(record: User) {
  try {
    await userApi.delete(record.id)
    message.success('删除成功')
    fetchUsers()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleResetPassword(record: User) {
  try {
    const res = await userApi.resetPassword(record.id)
    if (res.success && res.data) {
      message.success(`密码已重置为: ${res.data.password}`)
    }
  } catch (error) {
    message.error('重置密码失败')
  }
}

async function handleBatchDisable() {
  try {
    await userApi.batchUpdateStatus(selectedRowKeys.value, 'inactive')
    message.success('批量禁用成功')
    selectedRowKeys.value = []
    fetchUsers()
  } catch (error) {
    message.error('批量禁用失败')
  }
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = { active: 'green', inactive: 'red', suspended: 'orange', pending: 'blue' }
  return colors[status] || 'default'
}

function getStatusText(status: string) {
  const texts: Record<string, string> = { active: '正常', inactive: '禁用', suspended: '锁定', pending: '待激活' }
  return texts[status] || status
}

function getRoleText(role: string) {
  const texts: Record<string, string> = { admin: '管理员', user: '普通用户', viewer: '只读用户' }
  return texts[role] || role
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}
</script>

<style scoped>
.user-management {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.search-form {
  background: #fafafa;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.table-toolbar-left {
  display: flex;
  gap: 8px;
}
</style>
