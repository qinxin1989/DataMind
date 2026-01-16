<template>
  <div class="datasource-management">
    <div class="page-header">
      <h1>数据源管理</h1>
    </div>

    <div class="table-toolbar">
      <a-space>
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          新增数据源
        </a-button>
        <a-select v-model:value="filterVisibility" placeholder="可见性筛选" style="width: 120px" allowClear @change="fetchDatasources">
          <a-select-option value="private">私有</a-select-option>
          <a-select-option value="public">公共</a-select-option>
        </a-select>
      </a-space>
    </div>

    <a-table 
      :columns="columns" 
      :data-source="datasources" 
      :loading="loading" 
      row-key="id"
      :scroll="{ y: 'calc(100vh - 280px)' }"
      :pagination="{ pageSize: 20 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="getTypeColor(record.type)">{{ record.type.toUpperCase() }}</a-tag>
        </template>
        <template v-else-if="column.key === 'connection'">
          {{ record.host || '-' }}
        </template>
        <template v-else-if="column.key === 'visibility'">
          <a-tag :color="record.visibility === 'public' ? 'blue' : 'default'">
            {{ record.visibility === 'public' ? '公共' : '私有' }}
          </a-tag>
          <template v-if="record.visibility === 'public' && record.approvalStatus">
            <a-tag :color="getApprovalStatusColor(record.approvalStatus)">
              {{ getApprovalStatusText(record.approvalStatus) }}
            </a-tag>
          </template>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleTest(record)">
              测试连接
            </a-button>
            <a-button type="link" size="small" @click="handleEdit(record)">
              编辑
            </a-button>
            <a-dropdown>
              <a-button type="link" size="small">
                更多 <DownOutlined />
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="handleToggleVisibility(record)">
                    {{ record.visibility === 'public' ? '设为私有' : '设为公共' }}
                  </a-menu-item>
                  <a-menu-item danger @click="handleDelete(record)">
                    删除
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingDs ? '编辑数据源' : '新增数据源'"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
      width="600px"
    >
      <a-form :model="formState" :rules="formRules" ref="formRef" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="名称" name="name">
              <a-input v-model:value="formState.name" placeholder="数据源名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="类型" name="type">
              <a-select v-model:value="formState.type" @change="handleTypeChange">
                <a-select-opt-group label="数据库">
                  <a-select-option value="mysql">MySQL</a-select-option>
                  <a-select-option value="postgresql">PostgreSQL</a-select-option>
                  <a-select-option value="sqlserver">SQL Server</a-select-option>
                  <a-select-option value="sqlite">SQLite</a-select-option>
                </a-select-opt-group>
                <a-select-opt-group label="文件">
                  <a-select-option value="structured">结构化数据 (Excel/CSV/JSON)</a-select-option>
                  <a-select-option value="document">文档 (TXT/Word/PDF/Markdown)</a-select-option>
                </a-select-opt-group>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <!-- 数据库类型配置 -->
        <template v-if="!isFileType">
          <a-row :gutter="16">
            <a-col :span="16">
              <a-form-item label="主机" name="host">
                <a-input v-model:value="formState.host" placeholder="localhost" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="端口" name="port">
                <a-input-number v-model:value="formState.port" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="数据库" name="database">
            <a-input v-model:value="formState.database" placeholder="数据库名" />
          </a-form-item>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="用户名" name="username">
                <a-input v-model:value="formState.username" placeholder="root" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="密码" name="password">
                <a-input-password 
                  v-model:value="formState.password" 
                  :placeholder="editingDs ? (formState.password ? '已设置密码，留空则不修改' : '留空则不修改') : '密码'" 
                />
                <div v-if="editingDs && formState.password" style="font-size: 12px; color: #999; margin-top: 4px;">
                  当前已设置密码，如需修改请重新输入
                </div>
              </a-form-item>
            </a-col>
          </a-row>
        </template>
        <!-- 文件类型配置 -->
        <template v-else>
          <a-form-item label="上传文件（支持多选）" name="file">
            <a-upload-dragger
              v-model:file-list="fileList"
              :before-upload="beforeUpload"
              :accept="fileAccept"
              multiple
            >
              <p class="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p class="ant-upload-hint">{{ getFileTypeTip }}，最大 50MB/文件，支持多文件上传</p>
            </a-upload-dragger>
          </a-form-item>
        </template>
        <a-form-item label="可见性" name="visibility">
          <a-radio-group v-model:value="formState.visibility">
            <a-radio value="private">私有（仅自己可见）</a-radio>
            <a-radio value="public">公共（需管理员审核）</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, DownOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons-vue'
import { datasourceApi } from '@/api/datasource'
import type { DatasourceVisibility, ApprovalStatus } from '@/types'
import type { UploadProps } from 'ant-design-vue'

interface DatasourceItem {
  id: string
  name: string
  type: string
  host?: string
  ownerId?: string
  visibility: DatasourceVisibility
  approvalStatus?: ApprovalStatus
}

const loading = ref(false)
const datasources = ref<DatasourceItem[]>([])
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingDs = ref<DatasourceItem | null>(null)
const formRef = ref()
const filterVisibility = ref<DatasourceVisibility | undefined>(undefined)
const fileList = ref<any[]>([])

// 文件类型判断
const structuredFileTypes = ['structured']
const documentFileTypes = ['document']
const allFileTypes = [...structuredFileTypes, ...documentFileTypes]
const isFileType = computed(() => allFileTypes.includes(formState.type))

const fileAccept = computed(() => {
  const accepts: Record<string, string> = {
    structured: '.csv,.json,.xlsx,.xls',
    document: '.txt,.doc,.docx,.pdf,.md'
  }
  return accepts[formState.type] || ''
})

const getFileTypeTip = computed(() => {
  const tips: Record<string, string> = {
    structured: '支持 Excel (.xlsx, .xls)、CSV (.csv)、JSON (.json)',
    document: '支持 TXT (.txt)、Word (.doc, .docx)、PDF (.pdf)、Markdown (.md)'
  }
  return tips[formState.type] || ''
})

const formState = reactive({
  name: '',
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  database: '',
  username: 'root',
  password: '',
  visibility: 'private' as DatasourceVisibility,
})

const formRules = {
  name: [{ required: true, message: '请输入名称' }],
  type: [{ required: true, message: '请选择类型' }],
  host: [{ required: true, message: '请输入主机', validator: (_: any, value: string) => {
    if (isFileType.value) return Promise.resolve()
    return value ? Promise.resolve() : Promise.reject('请输入主机')
  }}],
  database: [{ required: true, message: '请输入数据库', validator: (_: any, value: string) => {
    if (isFileType.value) return Promise.resolve()
    return value ? Promise.resolve() : Promise.reject('请输入数据库')
  }}],
}

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', key: 'type', width: 120 },
  { title: '连接信息', key: 'connection' },
  { title: '可见性', key: 'visibility', width: 180 },
  { title: '操作', key: 'action', width: 200 },
]

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    mysql: 'blue',
    postgresql: 'green',
    sqlserver: 'orange',
    sqlite: 'purple',
    structured: 'cyan',
    document: 'geekblue'
  }
  return colors[type] || 'default'
}

function getApprovalStatusColor(status: ApprovalStatus) {
  const colors: Record<ApprovalStatus, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red'
  }
  return colors[status]
}

function getApprovalStatusText(status: ApprovalStatus) {
  const texts: Record<ApprovalStatus, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return texts[status]
}

onMounted(() => {
  fetchDatasources()
})

async function fetchDatasources() {
  loading.value = true
  try {
    const params: any = {}
    if (filterVisibility.value) {
      params.visibility = filterVisibility.value
    }
    const res = await datasourceApi.getList(params)
    datasources.value = res.data || []
  } catch (error) {
    message.error('加载数据源失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  editingDs.value = null
  fileList.value = []
  Object.assign(formState, { 
    name: '', 
    type: 'mysql', 
    host: 'localhost', 
    port: 3306, 
    database: '', 
    username: 'root', 
    password: '',
    visibility: 'private'
  })
  modalVisible.value = true
}

function handleTypeChange(type: string) {
  fileList.value = []
  // 根据类型设置默认端口
  const defaultPorts: Record<string, number> = {
    mysql: 3306,
    postgresql: 5432,
    sqlserver: 1433,
    sqlite: 0
  }
  if (defaultPorts[type] !== undefined) {
    formState.port = defaultPorts[type]
  }
}

function beforeUpload(file: File) {
  const maxSize = 50 * 1024 * 1024 // 50MB
  if (file.size > maxSize) {
    message.error('文件大小不能超过 50MB')
    return false
  }
  return false // 阻止自动上传
}

async function handleEdit(record: DatasourceItem) {
  editingDs.value = record
  fileList.value = []
  
  // 获取完整的数据源信息（包括密码）
  try {
    const detail = await datasourceApi.getById(record.id)
    console.log('=== 数据源详情 ===', detail)
    console.log('config:', detail.config)
    console.log('password:', detail.config?.password)
    
    Object.assign(formState, { 
      name: detail.name, 
      type: detail.type, 
      host: detail.config?.host || 'localhost', 
      port: detail.config?.port || 3306, 
      database: detail.config?.database || '', 
      username: detail.config?.user || detail.config?.username || 'root', 
      password: detail.config?.password || '',
      visibility: detail.visibility || 'private'
    })
    
    console.log('=== formState ===', formState)
  } catch (error) {
    console.error('获取数据源详情失败:', error)
    // 如果获取详情失败，使用列表数据
    Object.assign(formState, { 
      name: record.name, 
      type: record.type, 
      host: record.host || 'localhost', 
      port: 3306, 
      database: '', 
      username: 'root', 
      password: '',
      visibility: record.visibility || 'private'
    })
  }
  
  modalVisible.value = true
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()
    
    // 文件类型需要检查是否上传了文件
    if (isFileType.value && !editingDs.value && fileList.value.length === 0) {
      message.error('请选择要上传的文件')
      return
    }
    
    modalLoading.value = true
    
    if (editingDs.value) {
      await datasourceApi.update(editingDs.value.id, formState)
      message.success('更新成功')
    } else {
      // 文件类型使用 FormData 上传（支持多文件）
      if (isFileType.value && fileList.value.length > 0) {
        const formData = new FormData()
        fileList.value.forEach((file) => {
          formData.append('file', file.originFileObj || file)
        })
        formData.append('name', formState.name)
        formData.append('type', formState.type)
        formData.append('visibility', formState.visibility)
        await datasourceApi.createWithFile(formData)
      } else {
        await datasourceApi.create(formState)
      }
      if (formState.visibility === 'public') {
        message.success('创建成功，已提交审核')
      } else {
        message.success('创建成功')
      }
    }
    
    modalVisible.value = false
    fetchDatasources()
  } catch (error: any) {
    if (error.errorFields) return // 表单验证失败
    message.error(error.message || '操作失败')
  } finally {
    modalLoading.value = false
  }
}

async function handleDelete(record: DatasourceItem) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除数据源 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await datasourceApi.delete(record.id)
        message.success('删除成功')
        fetchDatasources()
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

async function handleTest(record: DatasourceItem) {
  try {
    const res = await datasourceApi.testConnection(record.id)
    if (res.data?.success) {
      message.success('连接成功')
    } else {
      message.error(res.data?.error || '连接失败')
    }
  } catch (error: any) {
    message.error(error.message || '连接测试失败')
  }
}

async function handleToggleVisibility(record: DatasourceItem) {
  const newVisibility: DatasourceVisibility = record.visibility === 'public' ? 'private' : 'public'
  const actionText = newVisibility === 'public' ? '设为公共（需管理员审核）' : '设为私有'
  
  Modal.confirm({
    title: '确认修改可见性',
    content: `确定要将数据源 "${record.name}" ${actionText}？`,
    okText: '确定',
    cancelText: '取消',
    async onOk() {
      try {
        await datasourceApi.updateVisibility(record.id, newVisibility)
        if (newVisibility === 'public') {
          message.success('已设为公共，等待管理员审核')
        } else {
          message.success('已设为私有')
        }
        fetchDatasources()
      } catch (error: any) {
        message.error(error.message || '修改失败')
      }
    }
  })
}
</script>

<style scoped>
.datasource-management {
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

.table-toolbar {
  margin-bottom: 16px;
}

.file-tip {
  margin-top: 8px;
  color: #888;
  font-size: 12px;
}
</style>
