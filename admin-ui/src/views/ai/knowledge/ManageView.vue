<template>
  <div class="manage-view">
    <div class="glass-layout">
      <!-- 左侧分类面板 -->
      <div class="category-panel">
        <div class="panel-inner">
          <div class="panel-header">
            <span>知识库分类</span>
            <a-button type="text" size="small" @click="showAddCategoryModal"><PlusOutlined /></a-button>
          </div>
          <a-tree
            v-model:selectedKeys="selectedCategoryKeys"
            v-model:expandedKeys="expandedCategoryKeys"
            :tree-data="categoryTreeData"
            :field-names="{ title: 'name', key: 'id' }"
            block-node
            class="tech-tree"
            @select="handleCategorySelect"
          >
            <template #icon="{ dataRef }">
              <FolderOutlined v-if="dataRef.id !== 'all'" />
              <AppstoreOutlined v-else />
            </template>
          </a-tree>
        </div>
      </div>

      <!-- 右侧文档列表 -->
      <div class="document-panel">
        <div class="list-controls">
          <div class="list-title">
            <h3>{{ currentCategoryName }}</h3>
            <span class="doc-count">{{ pagination.total }} 篇文档</span>
          </div>
          <a-space>
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索文档标签或标题..."
              class="glass-search"
              style="width: 240px"
            />
            <a-button @click="$emit('showFullSearch')" class="glass-btn"><SearchOutlined /> 全文检索</a-button>
            <a-dropdown>
              <a-button class="glass-btn"><UploadOutlined /> 更多 <DownOutlined /></a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="$emit('showImportSchema')"><DatabaseOutlined /> 导入数据源</a-menu-item>
                  <a-menu-item @click="showBatchImportModal"><UploadOutlined /> 批量导入</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </div>

        <a-table
          :columns="columns"
          :data-source="documents"
          :loading="loading"
          :pagination="pagination"
          @change="handleTableChange"
          row-key="id"
          class="tech-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <a @click="$emit('preview', record)" class="doc-link">{{ record.title }}</a>
            </template>
            <template v-else-if="column.key === 'category'">
              <span class="category-tag">{{ getCategoryName(record.categoryId) }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space :size="16">
                <a @click="$emit('preview', record)" class="action-link"><EyeOutlined /></a>
                <a @click="$emit('edit', record)" class="action-link"><EditOutlined /></a>
                <a-popconfirm title="确认删除？" @confirm="handleDelete(record)">
                  <a class="action-link danger"><DeleteOutlined /></a>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <!-- 新建分类弹窗 -->
    <a-modal
      v-model:open="categoryModalVisible"
      :title="editingCategory ? '编辑分类' : '新建分类'"
      @ok="handleSaveCategory"
      :confirm-loading="categoryLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="分类名称" required>
          <a-input v-model:value="categoryForm.name" placeholder="请输入分类名称" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="categoryForm.description" placeholder="分类描述（可选）" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量导入弹窗 -->
    <a-modal
      v-model:open="batchImportVisible"
      title="批量导入文档"
      @ok="handleBatchImport"
      :confirm-loading="batchLoading"
      width="700px"
    >
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="所属分类" required>
              <a-select v-model:value="batchForm.categoryId" placeholder="选择分类">
                <a-select-option v-for="cat in filteredCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="关联数据源">
              <a-select v-model:value="batchForm.datasourceId" placeholder="选择数据源（可选）" allow-clear>
                <a-select-option v-for="ds in safeDataSources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="选择文件（支持多选）" required>
          <a-upload-dragger
            v-model:file-list="batchFileList"
            :before-upload="() => false"
            multiple
            accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx"
            :show-upload-list="{ showRemoveIcon: !batchLoading }"
          >
            <p class="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p class="ant-upload-hint">支持 txt, md, json, csv, pdf, doc, docx, xls, xlsx 格式</p>
          </a-upload-dragger>
        </a-form-item>

        <a-alert
          v-if="batchLoading && currentProcessingFile"
          type="info"
          show-icon
          class="processing-alert"
        >
          <template #message>
            正在处理: {{ currentProcessingFile }}
          </template>
          <template #description>
            <a-progress :percent="batchProgress" status="active" :stroke-width="6" />
            <div class="progress-text">
              已完成 {{ batchSuccessCount }} / {{ batchTotalCount }} (失败: {{ batchFailCount }})
            </div>
          </template>
        </a-alert>
        <a-form-item label="文档类型">
          <a-select v-model:value="batchForm.type">
            <a-select-option value="text">文本</a-select-option>
            <a-select-option value="manual">手册</a-select-option>
            <a-select-option value="api">API文档</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  PlusOutlined, FolderOutlined, AppstoreOutlined, SearchOutlined,
  UploadOutlined, DownOutlined, DatabaseOutlined, InboxOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons-vue'
import { post, put } from '@/api/request'
import {
  documents, loading, categories, datasources,
  selectedCategoryKeys, expandedCategoryKeys, pagination,
  getCategoryName, currentCategoryName, categoryTreeData,
  refreshDocuments, deleteDocument, loadCategories
} from './shared'

const emit = defineEmits(['preview', 'edit', 'showFullSearch', 'showImportSchema'])

// 安全的分类和数据源列表（防止在未初始化时调用数组方法）
const filteredCategories = computed(() => {
  if (!Array.isArray(categories.value)) return []
  return categories.value.filter(c => c.id !== 'all')
})

const safeDataSources = computed(() => {
  if (!Array.isArray(datasources.value)) return []
  return datasources.value
})

// 搜索
const searchKeyword = ref('')
let searchTimer: any = null
watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.value.current = 1
    refreshDocuments()
  }, 500)
})

// 表格列定义
const columns = [
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '分类', dataIndex: 'categoryId', key: 'category', width: 100 },
  { title: '数据源', dataIndex: 'datasourceId', key: 'datasource', width: 120 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
  { title: '知识块', dataIndex: 'chunks', key: 'chunks', width: 80 },
  { title: '标签', dataIndex: 'tags', key: 'tags', width: 180 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

function handleTableChange(pag: any) {
  pagination.value.current = pag.current
  pagination.value.pageSize = pag.pageSize
  refreshDocuments()
}

function handleCategorySelect(selectedKeys: string[]) {
  selectedCategoryKeys.value = selectedKeys
  pagination.value.current = 1
  refreshDocuments()
}

function handleDelete(record: any) {
  deleteDocument(record)
}

// 分类弹窗
const categoryModalVisible = ref(false)
const categoryLoading = ref(false)
const editingCategory = ref<any>(null)
const categoryForm = ref({ name: '', description: '' })

function showAddCategoryModal() {
  editingCategory.value = null
  categoryForm.value = { name: '', description: '' }
  categoryModalVisible.value = true
}

async function handleSaveCategory() {
  if (!categoryForm.value.name) {
    message.warning('请输入分类名称')
    return
  }
  categoryLoading.value = true
  try {
    if (editingCategory.value) {
      await put(`/admin/ai-qa/categories/${editingCategory.value.id}`, categoryForm.value)
    } else {
      await post('/admin/ai-qa/categories', categoryForm.value)
    }
    message.success('保存成功')
    categoryModalVisible.value = false
    loadCategories()
  } catch (e) {
    message.error('保存失败')
  } finally {
    categoryLoading.value = false
  }
}

// 批量导入
const batchImportVisible = ref(false)
const batchLoading = ref(false)
const batchFileList = ref<any[]>([])
const batchForm = ref({ categoryId: '', datasourceId: '', type: 'text' })
const currentProcessingFile = ref('')
const batchTotalCount = ref(0)
const batchSuccessCount = ref(0)
const batchFailCount = ref(0)
const batchProgress = computed(() => {
  if (batchTotalCount.value === 0) return 0
  return Math.round(((batchSuccessCount.value + batchFailCount.value) / batchTotalCount.value) * 100)
})

function showBatchImportModal() {
  batchForm.value = { 
    categoryId: selectedCategoryKeys.value[0] !== 'all' ? selectedCategoryKeys.value[0] : '', 
    datasourceId: '', 
    type: 'text' 
  }
  batchFileList.value = []
  batchImportVisible.value = true
}

async function handleBatchImport() {
  if (batchFileList.value.length === 0) {
    message.warning('请选择文件')
    return
  }
  if (!batchForm.value.categoryId) {
    message.warning('请选择分类')
    return
  }

  batchLoading.value = true
  currentProcessingFile.value = ''
  batchTotalCount.value = batchFileList.value.length
  batchSuccessCount.value = 0
  batchFailCount.value = 0

  try {
    for (const fileItem of batchFileList.value) {
      const file = fileItem.originFileObj || fileItem
      currentProcessingFile.value = file.name
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
      formData.append('type', batchForm.value.type)
      formData.append('tags', JSON.stringify([]))
      formData.append('categoryId', batchForm.value.categoryId)
      if (batchForm.value.datasourceId) {
        formData.append('datasourceId', batchForm.value.datasourceId)
      }

      try {
        const res = await fetch('/api/admin/ai-qa/rag/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        })
        const data = await res.json()
        
        if (data.success) {
          batchSuccessCount.value++
        } else {
          batchFailCount.value++
        }
      } catch (e) {
        batchFailCount.value++
      }
    }

    if (batchSuccessCount.value > 0) {
      message.success(`处理完成：成功 ${batchSuccessCount.value} 个，失败 ${batchFailCount.value} 个`)
      if (batchFailCount.value === 0) {
        batchImportVisible.value = false
        batchFileList.value = []
      }
      refreshDocuments()
      loadCategories()
    } else {
      message.error('所有文件导入失败')
    }
  } finally {
    batchLoading.value = false
    currentProcessingFile.value = ''
  }
}

onMounted(() => {
  refreshDocuments()
})
</script>

<style scoped>
.manage-view {
  height: 100%;
}

.glass-layout {
  display: flex;
  gap: 24px;
  height: 100%;
}

.category-panel {
  width: 260px;
  flex-shrink: 0;
}

.panel-inner {
  background: var(--bg-container);
  border-radius: var(--border-radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.tech-tree :deep(.ant-tree-node-content-wrapper) {
  padding: 4px;
  border-radius: var(--border-radius-sm);
  transition: all 0.2s;
}

.tech-tree :deep(.ant-tree-node-selected .ant-tree-node-content-wrapper) {
  background-color: var(--primary-bg-light);
  color: var(--primary-color);
  font-weight: 500;
}

.document-panel {
  flex: 1;
  background: var(--bg-container);
  border-radius: var(--border-radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.list-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.list-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.doc-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

.glass-search :deep(.ant-input) {
  background: var(--bg-page);
  border: 1px solid transparent;
  transition: all 0.3s;
}

.glass-search :deep(.ant-input:focus) {
  background: var(--bg-container);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
}

.tech-table :deep(.ant-table-thead > tr > th) {
  background: var(--bg-container);
  border-bottom: 1px solid var(--border-color-light);
  font-weight: 600;
  color: var(--text-secondary);
}

.category-tag {
  background: var(--primary-bg-light);
  color: var(--primary-color);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.action-link {
  color: var(--text-tertiary);
  transition: color 0.3s;
  font-size: 16px;
}

.action-link:hover {
  color: var(--primary-color);
}

.action-link.danger:hover {
  color: var(--error-color);
}

.processing-alert {
  margin-top: 16px;
}

.progress-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
