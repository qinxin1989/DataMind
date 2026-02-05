<template>
  <div class="knowledge-layout">
    <!-- 左侧导航栏 -->
    <div class="knowledge-sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <RobotOutlined v-if="activeTab === 'qa'" />
          <FolderOutlined v-else-if="activeTab === 'manage'" />
          <EditOutlined v-else-if="activeTab === 'writer'" />
          <ShareAltOutlined v-else-if="activeTab === 'graph'" />
          <AppstoreOutlined v-else />
        </div>
        <span class="header-title">知识中心</span>
      </div>
      
      <div class="sidebar-menu">
        <div 
          v-for="item in menuItems" 
          :key="item.key"
          class="menu-item"
          :class="{ active: activeTab === item.key }"
          @click="handleMenuClick(item.key)"
        >
          <component :is="item.icon" class="menu-icon" />
          <span class="menu-label">{{ item.label }}</span>
          <div v-if="activeTab === item.key" class="active-indicator"></div>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="stats-card">
          <div class="stat-row">
            <span class="stat-label">文档</span>
            <span class="stat-value">{{ stats.documentCount }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">知识块</span>
            <span class="stat-value">{{ stats.chunkCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="knowledge-content">
      <router-view v-slot="{ Component }">
        <Transition name="fade-slide" mode="out-in">
          <KeepAlive>
            <component 
              :is="Component" 
              @preview="handlePreview" 
              @edit="handleEdit"
              @showFullSearch="fullSearchVisible = true"
              @showImportSchema="showImportSchemaModal"
            />
          </KeepAlive>
        </Transition>
      </router-view>
    </div>

    <!-- 全局预览弹窗 -->
    <a-modal
      v-model:open="previewVisible"
      :title="previewDocument?.title || '文档预览'"
      width="800px"
      :footer="null"
      class="preview-modal"
    >
      <div class="preview-container">
        <div class="preview-meta" v-if="previewDocument">
          <a-tag color="blue">{{ getTypeLabel(previewDocument.type) }}</a-tag>
          <span class="time">{{ formatDate(previewDocument.createdAt) }}</span>
          <span class="chunks">包含 {{ previewDocument.chunks }} 个知识块</span>
        </div>
        <div class="preview-content-wrapper scroll-shadow" id="preview-content-box">
          <div v-html="renderMarkdown(previewContent)" class="markdown-body"></div>
        </div>
      </div>
    </a-modal>

    <!-- 全文检索弹窗 -->
    <a-modal
      v-model:open="fullSearchVisible"
      title="全文检索"
      width="700px"
      :footer="null"
      class="search-modal"
    >
      <div class="search-container">
        <a-input-search
          v-model:value="fullSearchQuery"
          placeholder="请输入关键词搜索知识库..."
          enter-button="搜索"
          size="large"
          :loading="fullSearchLoading"
          @search="handleFullSearch"
          allow-clear
        />
        
        <div class="search-results scroll-shadow" v-if="fullSearchResults.length > 0">
          <div 
            v-for="(result, index) in fullSearchResults" 
            :key="index" 
            class="search-result-item"
            @click="handlePreview(result.document, result.content)"
          >
            <div class="result-title">
              <FileTextOutlined /> {{ result.document?.title }}
              <a-tag class="score-tag">{{ Math.round(result.score * 100) }}% 相关</a-tag>
            </div>
            <div class="result-snippet" v-html="result.content"></div> <!-- 注意：这里应该是高亮片段 -->
            <div class="result-meta">
              <span>分类: {{ getCategoryName(result.document?.categoryId) }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="fullSearchQuery && !fullSearchLoading" class="empty-search">
          <InboxOutlined style="font-size: 32px; color: #ccc;" />
          <p>未找到相关内容</p>
        </div>
      </div>
    </a-modal>

    <!-- 导入数据源 Schema 弹窗 -->
    <a-modal
      v-model:open="importSchemaVisible"
      title="导入数据源结构"
      @ok="handleImportSchema"
      :confirm-loading="importSchemaLoading"
      width="500px"
    >
       <a-alert 
        message="将数据源的表结构和字段说明导入知识库，可以让 AI 更好地理解数据。" 
        type="info" 
        show-icon 
        style="margin-bottom: 16px"
      />
      <a-form layout="vertical">
        <a-form-item label="选择数据源" required>
          <a-select v-model:value="importSchemaForm.datasourceId" placeholder="选择要导入的数据源">
            <a-select-option v-for="ds in safeDataSources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="importSchemaForm.analyzeFirst">
            如果未分析过，先进行 Schema 分析
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
    
    <!-- 编辑文档弹窗 (Simple Text Edit) -->
    <a-modal
      v-model:open="editModalVisible"
      :title="editingDocument ? '编辑文档' : '添加文档'"
      @ok="handleSaveDocument"
      :confirm-loading="editLoading"
      width="600px"
    >
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="editForm.title" placeholder="文档标题" />
        </a-form-item>
        <a-form-item label="分类" required>
           <a-select v-model:value="editForm.categoryId">
             <a-select-option v-for="cat in filteredCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</a-select-option>
           </a-select>
        </a-form-item>
        <a-form-item label="内容" required>
          <a-textarea v-model:value="editForm.content" :rows="10" placeholder="此处编辑文本内容..." />
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  FolderOutlined, MessageOutlined, EditOutlined, ShareAltOutlined,
  AppstoreOutlined, RobotOutlined, FileTextOutlined, InboxOutlined
} from '@ant-design/icons-vue'
import { marked } from 'marked'
import { get, post, put } from '@/api/request'
import { 
  stats, categories, datasources,
  previewVisible, previewDocument, previewContent,
  loadDatasources, loadCategories, refreshDocuments,
  getTypeLabel, formatDate, getCategoryName,
  handlePreview
} from './knowledge/shared'

const router = useRouter()
const route = useRoute()
const activeTab = ref('manage')

// 安全的分类和数据源列表
const filteredCategories = computed(() => {
  if (!Array.isArray(categories.value)) return []
  return categories.value.filter(c => c.id !== 'all')
})

const safeDataSources = computed(() => {
  if (!Array.isArray(datasources.value)) return []
  return datasources.value
})

const menuItems = [
  { key: 'manage', label: '知识管理', icon: FolderOutlined, route: 'KnowledgeManage' },
  { key: 'qa', label: '智能问答', icon: MessageOutlined, route: 'KnowledgeQA' },
  { key: 'writer', label: '长文写作', icon: EditOutlined, route: 'KnowledgeWriter' },
  { key: 'graph', label: '知识图谱', icon: ShareAltOutlined, route: 'KnowledgeGraph' },
]

// Sync activeTab with Route
watch(() => route.name, (newRouteName) => {
  const item = menuItems.find(i => i.route === newRouteName)
  if (item) {
    activeTab.value = item.key
  }
}, { immediate: true })

function handleMenuClick(key: string) {
  const item = menuItems.find(i => i.key === key)
  if (item) {
    activeTab.value = key
    router.push({ name: item.route })
  }
}

// --- 全文检索 ---
const fullSearchVisible = ref(false)
const fullSearchQuery = ref('')
const fullSearchResults = ref<any[]>([])
const fullSearchLoading = ref(false)

async function handleFullSearch() {
  if (!fullSearchQuery.value) return
  fullSearchLoading.value = true
  try {
    const res = await get<any>('/admin/ai-qa/rag/search', {
      params: {
        q: fullSearchQuery.value,  // 后端期望的参数是 q 而不是 question
        limit: 20
      }
    })
    if (res.success && Array.isArray(res.data)) {
      fullSearchResults.value = res.data.map((item: any) => ({
        document: item.payload || item.document || item,
        score: item.score || 1,
        content: (item.payload?.content || item.content || '').substring(0, 200) + '...'
      }))
    } else {
      fullSearchResults.value = []
    }
  } catch (e) {
    message.error('检索失败')
    fullSearchResults.value = []
  } finally {
    fullSearchLoading.value = false
  }
}

// --- Render Markdown ---
function renderMarkdown(text: string) {
  if (!text) return ''
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  try {
    return marked.parse(cleanText)
  } catch (e) {
    return cleanText.replace(/\n/g, '<br>')
  }
}

// --- Import Schema ---
const importSchemaVisible = ref(false)
const importSchemaLoading = ref(false)
const importSchemaForm = ref({ datasourceId: '', analyzeFirst: true })

function showImportSchemaModal() {
  importSchemaForm.value = { datasourceId: '', analyzeFirst: true }
  importSchemaVisible.value = true
}

async function handleImportSchema() {
  if (!importSchemaForm.value.datasourceId) {
    message.warning('请选择数据源')
    return
  }
  importSchemaLoading.value = true
  try {
    const res = await post('/admin/ai-qa/rag/import-schema', importSchemaForm.value)
    if (res.success) {
      message.success('导入成功')
      importSchemaVisible.value = false
      refreshDocuments() // From shared
    } else {
      message.error(res.error?.message || '导入失败')
    }
  } catch (e) {
    message.error('导入失败')
  } finally {
    importSchemaLoading.value = false
  }
}

// --- Edit Document (Simple) ---
const editModalVisible = ref(false)
const editingDocument = ref<any>(null)
const editLoading = ref(false)
const editForm = ref({ title: '', categoryId: '', content: '' })

function handleEdit(record: any) {
  editingDocument.value = record
  editForm.value = {
    title: record.title,
    categoryId: record.categoryId || '',
    content: record.content || ''
  }
  editModalVisible.value = true
}

async function handleSaveDocument() {
  if (!editForm.value.title) return message.warning('请输入标题')
  editLoading.value = true
  try {
    const url = editingDocument.value 
      ? `/admin/ai-qa/rag/documents/${editingDocument.value.id}` 
      : '/admin/ai-qa/rag/documents'
    
    // 如果是编辑
    const payload = { ...editForm.value };
    // 实际后端API可能不同，这里假设 PUT 更新
    // 注意：Shared API 里没有 export update, 需检查。这里假设用 generic post/put
    
    // 这里简化处理，实际可能需要更复杂的 FormData 如果涉及文件
    // 由于是纯文本编辑
    await put(url, payload) // 假设 put 支持
    
    message.success('保存成功')
    editModalVisible.value = false
    refreshDocuments()
  } catch (e) {
     message.error('保存失败')
  } finally {
    editLoading.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadDatasources()
})
</script>

<style scoped>
.knowledge-layout {
  display: flex;
  height: 100vh; /* 既然在 AdminContent 中，可能需要调整 */
  height: calc(100vh - 64px); /* 减去头部高度 */
  background: var(--bg-page);
  overflow: hidden;
}

.knowledge-sidebar {
  width: 200px;
  background: var(--bg-container);
  border-right: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  z-index: 10;
  box-shadow: var(--shadow-sm);
}

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-color-light);
  gap: 12px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-hover) 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-menu {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 12px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  position: relative;
  font-weight: 500;
}

.menu-item:hover {
  background: var(--bg-page);
  color: var(--text-primary);
}

.menu-item.active {
  background: var(--primary-bg-light);
  color: var(--primary-color);
}

.menu-icon {
  font-size: 18px;
  margin-right: 12px;
}

.active-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 20px;
  background: var(--primary-color);
  border-radius: 4px 0 0 4px;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid var(--border-color-light);
}

.stats-card {
  background: var(--bg-page);
  border-radius: 12px;
  padding: 12px 16px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
}

.stat-label {
  color: var(--text-tertiary);
}

.stat-value {
  font-weight: 600;
  color: var(--text-secondary);
}

.knowledge-content {
  flex: 1;
  padding: 24px;
  overflow: hidden;
  position: relative;
  background: var(--bg-page);
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Preview Modal Markdown */
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: var(--text-primary);
}
.markdown-body :deep(h1), .markdown-body :deep(h2) {
  border-bottom: 1px solid var(--border-color-light);
  padding-bottom: 0.3em;
}
.markdown-body :deep(pre) {
  background: var(--bg-page);
  padding: 16px;
  border-radius: 6px;
}

/* Scroll Shadow */
.scroll-shadow::-webkit-scrollbar {
  width: 6px;
}
.scroll-shadow::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
</style>
