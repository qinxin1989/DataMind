<template>
  <div class="knowledge-container">
    <!-- 知识库分类管理 -->
    <a-card title="知识库分类" :bordered="false" class="category-card">
      <template #extra>
        <a-button type="primary" size="small" @click="showAddCategoryModal">
          <PlusOutlined /> 新建分类
        </a-button>
      </template>
      <div class="category-list">
        <div 
          v-for="cat in categories" 
          :key="cat.id" 
          :class="['category-item', { active: selectedCategory?.id === cat.id }]"
          @click="selectCategory(cat)"
        >
          <div class="cat-info">
            <FolderOutlined />
            <span class="cat-name">{{ cat.name }}</span>
            <a-badge :count="cat.documentCount" :number-style="{ backgroundColor: '#52c41a' }" />
          </div>
          <a-dropdown v-if="cat.id !== 'all'">
            <MoreOutlined @click.stop />
            <template #overlay>
              <a-menu>
                <a-menu-item @click.stop="editCategory(cat)">编辑</a-menu-item>
                <a-menu-item danger @click.stop="deleteCategory(cat)">删除</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </a-card>

    <a-card title="知识库管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="showAddModal">
            <PlusOutlined /> 添加文档
          </a-button>
          <a-button @click="showBatchImportModal">
            <UploadOutlined /> 批量导入
          </a-button>
          <a-button @click="refreshDocuments">
            <ReloadOutlined /> 刷新
          </a-button>
        </a-space>
      </template>

      <!-- 统计信息 -->
      <a-row :gutter="16" class="stats-row">
        <a-col :span="6">
          <a-statistic title="文档总数" :value="stats.documentCount" />
        </a-col>
        <a-col :span="6">
          <a-statistic title="知识块数" :value="stats.chunkCount" />
        </a-col>
        <a-col :span="6">
          <a-statistic title="实体数量" :value="stats.entityCount" />
        </a-col>
        <a-col :span="6">
          <a-statistic title="关系数量" :value="stats.relationCount" />
        </a-col>
      </a-row>

      <!-- 文档列表 -->
      <a-table
        :columns="columns"
        :data-source="filteredDocuments"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'category'">
            <a-tag>{{ getCategoryName(record.categoryId) }}</a-tag>
          </template>
          <template v-if="column.key === 'datasource'">
            <a-tag v-if="record.datasourceId" color="blue">{{ record.datasourceName || record.datasourceId }}</a-tag>
            <span v-else>-</span>
          </template>
          <template v-if="column.key === 'type'">
            <a-tag :color="getTypeColor(record.type)">{{ record.type }}</a-tag>
          </template>
          <template v-if="column.key === 'tags'">
            <a-tag v-for="tag in record.tags" :key="tag" size="small">{{ tag }}</a-tag>
          </template>
          <template v-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" danger @click="handleDelete(record)">
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 知识图谱可视化 -->
    <a-card title="知识图谱" :bordered="false" class="graph-card">
      <div id="knowledge-graph" style="width: 100%; height: 400px;"></div>
    </a-card>

    <!-- RAG 问答测试 -->
    <a-card title="知识库问答" :bordered="false">
      <a-space direction="vertical" style="width: 100%">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-select v-model:value="ragDatasourceId" placeholder="选择数据源（可选）" allowClear style="width: 100%">
              <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
            </a-select>
          </a-col>
          <a-col :span="18">
            <a-input-search
              v-model:value="ragQuestion"
              placeholder="输入问题，基于知识库回答..."
              enter-button="提问"
              size="large"
              :loading="ragLoading"
              @search="handleRAGAsk"
            />
          </a-col>
        </a-row>
        <div v-if="ragAnswer" class="rag-answer">
          <div class="answer-content">
            <h4>回答：</h4>
            <p>{{ ragAnswer.answer }}</p>
            <div class="confidence">
              置信度: <a-progress :percent="Math.round(ragAnswer.confidence * 100)" size="small" style="width: 200px" />
            </div>
          </div>
          <div v-if="ragAnswer.sources?.length" class="sources">
            <h4>参考来源：</h4>
            <a-list size="small" :data-source="ragAnswer.sources">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta :title="item.title" :description="item.content?.slice(0, 100) + '...'" />
                </a-list-item>
              </template>
            </a-list>
          </div>
        </div>
      </a-space>
    </a-card>

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

    <!-- 添加文档弹窗 -->
    <a-modal
      v-model:open="addModalVisible"
      title="添加知识文档"
      @ok="handleAddDocument"
      :confirm-loading="addLoading"
      width="600px"
    >
      <a-form :model="addForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="所属分类">
              <a-select v-model:value="addForm.categoryId" placeholder="选择分类">
                <a-select-option v-for="cat in categories.filter(c => c.id !== 'all')" :key="cat.id" :value="cat.id">{{ cat.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="关联数据源">
              <a-select v-model:value="addForm.datasourceId" placeholder="选择数据源（可选）" allowClear>
                <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="添加方式">
          <a-radio-group v-model:value="addForm.inputType">
            <a-radio value="text">手动输入</a-radio>
            <a-radio value="file">上传文件</a-radio>
          </a-radio-group>
        </a-form-item>
        
        <a-form-item label="文档标题" required>
          <a-input v-model:value="addForm.title" placeholder="请输入文档标题" />
        </a-form-item>
        <a-form-item label="文档类型">
          <a-select v-model:value="addForm.type">
            <a-select-option value="text">文本</a-select-option>
            <a-select-option value="faq">FAQ</a-select-option>
            <a-select-option value="manual">手册</a-select-option>
            <a-select-option value="api">API文档</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="标签">
          <a-select v-model:value="addForm.tags" mode="tags" placeholder="输入标签后回车" />
        </a-form-item>
        
        <!-- 手动输入 -->
        <a-form-item v-if="addForm.inputType === 'text'" label="文档内容" required>
          <a-textarea
            v-model:value="addForm.content"
            placeholder="请输入文档内容..."
            :rows="10"
          />
        </a-form-item>
        
        <!-- 文件上传 -->
        <a-form-item v-if="addForm.inputType === 'file'" label="选择文件" required>
          <a-upload
            :before-upload="handleFileSelect"
            :file-list="fileList"
            :max-count="1"
            accept=".txt,.md,.json,.csv,.pdf,.png,.jpg,.jpeg"
            @remove="handleFileRemove"
          >
            <a-button>
              <UploadOutlined /> 选择文件
            </a-button>
            <template #itemRender="{ file }">
              <span>{{ file.name }}</span>
            </template>
          </a-upload>
          <div class="upload-tip">支持 .txt, .md, .json, .csv, .pdf, .png, .jpg 格式（图片需要 OCR 服务）</div>
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
                <a-select-option v-for="cat in categories.filter(c => c.id !== 'all')" :key="cat.id" :value="cat.id">{{ cat.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="关联数据源">
              <a-select v-model:value="batchForm.datasourceId" placeholder="选择数据源（可选）" allowClear>
                <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="选择文件（支持多选）" required>
          <a-upload-dragger
            v-model:file-list="batchFileList"
            :before-upload="handleBatchFileSelect"
            multiple
            accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx"
          >
            <p class="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p class="ant-upload-hint">支持 txt, md, json, csv, pdf, doc, docx, xls, xlsx 格式，可多选</p>
          </a-upload-dragger>
        </a-form-item>
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
import { ref, onMounted, nextTick } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { get, post, del } from '@/api/request'
import * as echarts from 'echarts'
import dayjs from 'dayjs'

interface Document {
  id: string
  title: string
  type: string
  chunks: number
  tags?: string[]
  createdAt: number
}

interface Stats {
  documentCount: number
  chunkCount: number
  entityCount: number
  relationCount: number
}

const documents = ref<Document[]>([])
const stats = ref<Stats>({ documentCount: 0, chunkCount: 0, entityCount: 0, relationCount: 0 })
const loading = ref(false)
const addModalVisible = ref(false)
const addLoading = ref(false)
const addForm = ref({ title: '', type: 'text', content: '', tags: [] as string[], inputType: 'text' as 'text' | 'file' })
const fileList = ref<any[]>([])

const ragQuestion = ref('')
const ragAnswer = ref<any>(null)
const ragLoading = ref(false)

const columns = [
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '知识块', dataIndex: 'chunks', key: 'chunks', width: 80 },
  { title: '标签', dataIndex: 'tags', key: 'tags', width: 200 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 100 },
]

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    text: 'blue',
    faq: 'green',
    manual: 'orange',
    api: 'purple'
  }
  return colors[type] || 'default'
}

function formatDate(ts: number) {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

async function refreshDocuments() {
  loading.value = true
  try {
    const [docsRes, statsRes] = await Promise.all([
      get<Document[]>('/admin/ai-qa/rag/documents'),
      get<Stats>('/admin/ai-qa/rag/stats')
    ])
    if (docsRes.success) documents.value = docsRes.data || []
    if (statsRes.success) stats.value = statsRes.data || stats.value
    
    // 加载知识图谱
    await loadKnowledgeGraph()
  } catch (e) {
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

async function loadKnowledgeGraph() {
  try {
    const res = await get<any>('/admin/ai-qa/rag/graph')
    if (res.success) {
      renderGraph(res.data)
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

  // 销毁旧实例
  const existingChart = echarts.getInstanceByDom(dom)
  if (existingChart) {
    existingChart.dispose()
  }

  const chart = echarts.init(dom)
  
  // 防护：确保 entities 和 relations 存在
  const entities = data?.entities || []
  const relations = data?.relations || []
  
  if (entities.length === 0) {
    // 没有数据时显示空状态
    chart.setOption({
      title: { text: '暂无知识图谱数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
    })
    return
  }

  const nodes = entities.map((e: any) => ({
    id: e.id,
    name: e.nameCn || e.name,
    category: e.type,
    symbolSize: 30
  }))

  const links = relations.map((r: any) => ({
    source: r.source,
    target: r.target,
    value: r.type
  }))

  const categories = [...new Set(entities.map((e: any) => e.type))].map(t => ({ name: t }))

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

function showAddModal() {
  addForm.value = { title: '', type: 'text', content: '', tags: [], inputType: 'text' }
  fileList.value = []
  addModalVisible.value = true
}

// 文件选择（不自动上传）
const selectedFile = ref<File | null>(null)

function handleFileSelect(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  
  // 自动填充标题
  if (!addForm.value.title) {
    addForm.value.title = file.name.replace(/\.[^/.]+$/, '')
  }
  
  // PDF 和图片文件需要上传到后端处理
  if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(ext || '')) {
    selectedFile.value = file
    addForm.value.content = ext === 'pdf' ? '[PDF文件，将在提交时解析]' : '[图片文件，将使用OCR识别]'
    fileList.value = [{ uid: '-1', name: file.name, status: 'done' }]
    return false
  }
  
  // 其他文本文件直接读取
  const reader = new FileReader()
  reader.onload = (e) => {
    addForm.value.content = e.target?.result as string || ''
  }
  reader.readAsText(file)
  selectedFile.value = null
  
  fileList.value = [{ uid: '-1', name: file.name, status: 'done' }]
  return false // 阻止自动上传
}

function handleFileRemove() {
  fileList.value = []
  addForm.value.content = ''
  selectedFile.value = null
}

async function handleAddDocument() {
  if (!addForm.value.title) {
    message.warning('请填写标题')
    return
  }
  
  // PDF 文件需要上传
  if (selectedFile.value) {
    addLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', selectedFile.value)
      formData.append('title', addForm.value.title)
      formData.append('type', addForm.value.type)
      formData.append('tags', JSON.stringify(addForm.value.tags))
      
      const res = await fetch('/api/admin/ai-qa/rag/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: formData
      })
      const data = await res.json()
      
      if (data.success) {
        message.success('添加成功')
        addModalVisible.value = false
        selectedFile.value = null
        refreshDocuments()
      } else {
        message.error(data.error?.message || '添加失败')
      }
    } catch (e) {
      message.error('添加失败')
    } finally {
      addLoading.value = false
    }
    return
  }
  
  // 普通文本内容
  if (!addForm.value.content) {
    message.warning('请填写内容')
    return
  }

  addLoading.value = true
  try {
    const res = await post('/admin/ai-qa/rag/documents', addForm.value)
    if (res.success) {
      message.success('添加成功')
      addModalVisible.value = false
      refreshDocuments()
    } else {
      message.error(res.error?.message || '添加失败')
    }
  } catch (e) {
    message.error('添加失败')
  } finally {
    addLoading.value = false
  }
}

function handleDelete(record: Document) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除文档 "${record.title}" 吗？`,
    onOk: async () => {
      try {
        const res = await del(`/admin/ai-qa/rag/documents/${record.id}`)
        if (res.success) {
          message.success('删除成功')
          refreshDocuments()
        }
      } catch (e) {
        message.error('删除失败')
      }
    }
  })
}

async function handleRAGAsk() {
  if (!ragQuestion.value.trim()) return

  ragLoading.value = true
  ragAnswer.value = null
  try {
    const res = await post<any>('/admin/ai-qa/rag/ask', { question: ragQuestion.value })
    if (res.success) {
      ragAnswer.value = res.data
    } else {
      message.error(res.error?.message || '查询失败')
    }
  } catch (e) {
    message.error('查询失败')
  } finally {
    ragLoading.value = false
  }
}

onMounted(() => {
  refreshDocuments()
})
</script>

<style scoped>
.knowledge-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-row {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.graph-card {
  margin-top: 16px;
}

.rag-answer {
  margin-top: 16px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.answer-content h4 {
  margin: 0 0 8px;
  color: #1890ff;
}

.answer-content p {
  margin: 0 0 12px;
  line-height: 1.8;
}

.confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
}

.sources {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
}

.sources h4 {
  margin: 0 0 8px;
  color: #666;
}

.upload-tip {
  margin-top: 8px;
  color: #999;
  font-size: 12px;
}
</style>
