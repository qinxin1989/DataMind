<template>
  <div class="knowledge-page">
    <!-- 侧边栏导航 -->
    <div class="knowledge-sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon"><span class="icon-pulse"></span></div>
        <div class="logo-text">AI Data Platform</div>
      </div>
      
      <div class="sidebar-menu">
        <div 
          v-for="item in menuItems" 
          :key="item.key"
          class="menu-item"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          <component :is="item.icon" class="item-icon" />
          <span class="item-label">{{ item.label }}</span>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="refresh-indicator" @click="refreshAllData">
          <ReloadOutlined :spin="loading" /> <span>同步云端数据</span>
        </div>
      </div>
    </div>

    <!-- 主中心区域 -->
    <div class="knowledge-main">
      <header class="main-header">
        <div class="header-left">
          <h2 class="page-title">{{ currentMenuLabel }}</h2>
        </div>
        <div class="header-right">
          <a-space :size="20">
            <div class="global-stats">
              <span class="stat-tag"><DatabaseOutlined /> {{ stats.documentCount }} 文档</span>
              <span class="stat-tag"><ShareAltOutlined /> {{ stats.entityCount }} 实体</span>
            </div>
            <a-button type="primary" shape="round" class="action-btn" @click="showAddModal">
              <PlusOutlined /> 添加知识
            </a-button>
          </a-space>
        </div>
      </header>

      <div class="main-content-scroll">
        <!-- 核心路由内容 -->
        <div class="content-wrapper">
          
          <!-- 1. 知识管理 (原来的 manage 标签页内容) -->
          <div v-if="activeTab === 'manage'" class="manage-view">
             <!-- 此处直接复用原来的管理逻辑，但样式会更新 -->
             <div class="glass-layout">
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
                      <a-button @click="showFullSearch" class="glass-btn"><SearchOutlined /> 全文检索</a-button>
                      <a-dropdown>
                        <a-button class="glass-btn"><UploadOutlined /> 更多 <DownOutlined /></a-button>
                        <template #overlay>
                          <a-menu>
                            <a-menu-item @click="showImportSchemaModal"><DatabaseOutlined /> 导入数据源</a-menu-item>
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
                        <a @click="handlePreview(record)" class="doc-link">{{ record.title }}</a>
                      </template>
                      <template v-else-if="column.key === 'category'">
                        <span class="category-tag">{{ getCategoryName(record.categoryId) }}</span>
                      </template>
                      <template v-else-if="column.key === 'action'">
                        <a-space :size="16">
                          <a @click="handlePreview(record)" class="action-link"><EyeOutlined /></a>
                          <a @click="handleEdit(record)" class="action-link"><EditOutlined /></a>
                          <a-popconfirm title="确认删除？" @confirm="handleDelete(record)">
                            <a class="action-link danger"><DeleteOutlined /></a>
                          </a-popconfirm>
                        </a-space>
                      </template>
                    </template>
                  </a-table>
                </div>
             </div>
          </div>

          <!-- 2. 智能问答 (ChatGPT 风格对话流) -->
          <div v-else-if="activeTab === 'qa'" class="chat-view">
             <div class="chat-container">
               <div class="chat-messages" ref="chatScrollRef">
                 <div v-if="chatHistory.length === 0" class="chat-empty">
                   <div class="empty-hero">
                     <div class="hero-icon"><RobotOutlined /></div>
                     <h2>我是您的知识助手</h2>
                     <p>您可以问我关于已导入知识库的任何问题，我将基于事实为您解答。</p>
                   </div>
                   <div class="suggested-questions">
                     <div v-for="q in suggestedQuestions" :key="q" class="suggest-chip" @click="ragQuestion = q; handleRAGAsk()">
                       {{ q }}
                     </div>
                   </div>
                 </div>
                 
                 <div v-for="(msg, idx) in chatHistory" :key="idx" class="message-wrapper" :class="msg.role">
                    <div class="message-avatar">
                      <UserOutlined v-if="msg.role === 'user'" />
                      <RobotOutlined v-else />
                    </div>
                    <div class="message-content">
                      <div class="message-bubble">
                        <div v-if="msg.role === 'assistant' && msg.loading" class="typing-indicator">
                          <span></span><span></span><span></span>
                        </div>
                        <div v-else class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
                      </div>
                      
                      <!-- 引用来源展示 -->
                      <div v-if="msg.sources?.length" class="message-sources">
                        <div class="source-header"><FileTextOutlined /> 找到 {{ msg.sources.length }} 个参考来源</div>
                        <div class="source-chips">
                          <div v-for="src in msg.sources" :key="src.id" class="source-chip" @click="handlePreviewById(src.documentId)">
                            {{ src.title }}
                          </div>
                        </div>
                      </div>

                      <div class="message-footer" v-if="msg.role === 'assistant' && !msg.loading">
                        <span class="confidence-tag" :style="{ color: getConfidenceColor(msg.confidence || 0) }">
                          置信度: {{ Math.round((msg.confidence || 0) * 100) }}%
                        </span>
                      </div>
                    </div>
                 </div>
               </div>

               <div class="chat-input-area">
                 <div class="input-wrapper">
                    <div class="qa-config-bar">
                      <a-cascader
                        v-model:value="qaScope"
                        :options="qaScopeOptions"
                        placeholder="所有知识库"
                        size="small"
                        class="mini-cascader"
                      />
                      <div class="divider"></div>
                      <a-select v-model:value="ragDatasourceId" placeholder="关联数据源" size="small" allow-clear class="mini-select">
                        <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">
                          {{ ds.name }}
                        </a-select-option>
                      </a-select>
                    </div>
                    <div class="input-container">
                      <a-textarea
                        v-model:value="ragQuestion"
                        placeholder="输入您的问题 (Shift + Enter 换行)..."
                        :auto-size="{ minRows: 1, maxRows: 6 }"
                        @pressEnter="handleChatEnter"
                        class="chat-input"
                      />
                      <a-button 
                        type="primary" 
                        class="send-btn" 
                        :loading="ragLoading"
                        @click="handleRAGAsk"
                      >
                        <SendOutlined />
                      </a-button>
                    </div>
                 </div>
               </div>
             </div>
          </div>

          <!-- 3. 长文写作 (Writer Mode) -->
          <div v-else-if="activeTab === 'writer'" class="writer-view">
             <!-- 复用之前的 Writer UI，但适配新布局 -->
             <div class="writer-inner-layout">
                <!-- 左侧大纲与配置 -->
                <div class="writer-sidebar-content">
                  <div class="config-section">
                    <h4>写作配置</h4>
                    <a-form layout="vertical">
                      <a-form-item label="文章主题">
                        <a-input v-model:value="writerForm.topic" placeholder="输入主题..." />
                      </a-form-item>
                      <a-button type="primary" ghost block @click="handleGenerateOutline" :loading="writerStatus === 'generating_outline'">
                        <template #icon><SparklesIcon /></template>生成大纲
                      </a-button>
                    </a-form>
                  </div>
                  
                  <div class="outline-section">
                    <div class="section-header">
                      <span>文章大纲</span>
                      <a-button type="link" size="small" @click="addChapter"><PlusOutlined /></a-button>
                    </div>
                    <div class="outline-list scroll-shadow">
                      <div v-for="(chapter, index) in outline" :key="index" class="outline-item-mini">
                        <span class="idx">{{ index + 1 }}</span>
                        <a-input v-model:value="chapter.title" class="chapter-input" :bordered="false" />
                        <a-button type="text" size="small" danger @click="removeChapter(index)"><CloseOutlined /></a-button>
                      </div>
                    </div>
                    <a-button type="primary" block size="large" @click="handleGenerateArticle" :loading="writerStatus === 'writing'">
                      开始撰写全文
                    </a-button>
                  </div>
                </div>

                <!-- 右侧预览 -->
                <div class="writer-main-content">
                   <div class="paper-toolbar">
                      <div class="writing-status" v-if="writerStatus === 'writing'">
                         <LoadingOutlined /> 正在撰写: {{ currentWritingChapter }}
                      </div>
                      <a-button v-if="writerContent" type="link" @click="handleExportMarkdown">
                        <DownloadOutlined /> 导出
                      </a-button>
                   </div>
                   <div class="paper-container scroll-shadow">
                      <div v-if="!writerContent && writerStatus === 'idle'" class="paper-empty">
                         <FileTextOutlined style="font-size: 48px; opacity: 0.2" />
                         <p>生成的内容将在此处呈现</p>
                      </div>
                      <div v-else class="markdown-body paper-content" v-html="renderMarkdown(writerContent)"></div>
                   </div>
                </div>
             </div>
          </div>

          <!-- 4. 知识图谱 -->
          <div v-else-if="activeTab === 'graph'" class="graph-view">
             <div class="graph-full-container">
                <div class="graph-controls-glass">
                  <div class="stats-group">
                    <div class="stat"><span class="val">{{ stats.entityCount }}</span><span class="lab">实体</span></div>
                    <div class="stat"><span class="val">{{ stats.relationCount }}</span><span class="lab">关系</span></div>
                  </div>
                  <a-select v-model:value="graphFilter" placeholder="过滤实体类型" style="width: 140px" class="glass-select">
                    <a-select-option value="">全部</a-select-option>
                    <a-select-option v-for="t in entityTypes" :key="t" :value="t">{{ t }}</a-select-option>
                  </a-select>
                  <a-button shape="circle" @click="refreshGraph"><ReloadOutlined /></a-button>
                </div>
                <div id="knowledge-graph" class="graph-canvas-full"></div>
             </div>
          </div>

        </div>
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

    <!-- 添加/编辑文档弹窗 -->
    <a-modal
      v-model:open="addModalVisible"
      :title="editingDocument ? '编辑文档' : '添加知识文档'"
      @ok="handleSaveDocument"
      :confirm-loading="addLoading"
      width="700px"
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
              <a-select v-model:value="addForm.datasourceId" placeholder="选择数据源（可选）" allow-clear>
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
          <a-select 
            v-model:value="addForm.tags" 
            mode="tags" 
            placeholder="输入标签后回车"
            :token-separators="[',', '，', ' ', ';', '；']"
          />
        </a-form-item>
        
        <a-form-item v-if="addForm.inputType === 'text'" label="文档内容" required>
          <a-textarea
            v-model:value="addForm.content"
            placeholder="请输入文档内容..."
            :rows="10"
          />
        </a-form-item>
        
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
          <div class="upload-tip">支持 .txt, .md, .json, .csv, .pdf, .png, .jpg 格式</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 全文检索弹窗 -->
    <a-modal
      v-model:open="fullSearchVisible"
      title="全文检索"
      width="800px"
      :footer="null"
    >
      <div class="full-search-container">
        <div class="search-bar">
          <a-input-search
            v-model:value="fullSearchQuery"
            placeholder="输入关键词搜索知识库所有内容..."
            enter-button="搜索"
            size="large"
            :loading="fullSearchLoading"
            @search="handleFullSearch"
          />
        </div>
        
        <div class="search-results">
          <a-empty v-if="!fullSearchLoading && fullSearchResults.length === 0" description="暂无搜索结果" />
          
          <a-list
            v-else
            :loading="fullSearchLoading"
            item-layout="vertical"
            :data-source="fullSearchResults"
          >
            <template #renderItem="{ item }">
              <a-list-item class="search-result-item" @click="handleLocate(item)">
                <a-list-item-meta>
                  <template #title>
                    <a class="result-title">{{ item.documentTitle }}</a>
                  </template>
                  <template #description>
                    <div class="result-snippet" v-html="highlightKeyword(item.content, fullSearchQuery)"></div>
                  </template>
                </a-list-item-meta>
                <div class="result-meta">
                  <a-tag>匹配度: {{ (item.score * 100).toFixed(0) }}%</a-tag>
                  <a-button type="link" size="small">
                    <EyeOutlined /> 查看原文
                  </a-button>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </div>
    </a-modal>

    <!-- 文件预览弹窗 -->
    <a-modal
      v-model:open="previewVisible"
      :title="previewDocument?.title"
      width="800px"
      :footer="null"
    >
      <div class="document-preview">
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="文档类型">
            <a-tag :color="getTypeColor(previewDocument?.type || '')">
              {{ getTypeLabel(previewDocument?.type || '') }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="所属分类">
            {{ getCategoryName(previewDocument?.categoryId) }}
          </a-descriptions-item>
          <a-descriptions-item label="标签">
            <a-tag v-for="tag in previewDocument?.tags" :key="tag">{{ tag }}</a-tag>
            <span v-if="!previewDocument?.tags?.length">无</span>
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatDate(previewDocument?.createdAt || 0) }}
          </a-descriptions-item>
          <a-descriptions-item label="知识块数量">
            {{ previewDocument?.chunks || 0 }}
          </a-descriptions-item>
        </a-descriptions>
        
        <a-divider>文档内容</a-divider>
        
        <div class="preview-content__container" ref="previewContainer">
          <div 
            class="preview-content" 
            v-html="renderPreviewContent(previewContent, highlightChunkContent)"
          ></div>
        </div>
      </div>
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
              <a-select v-model:value="batchForm.datasourceId" placeholder="选择数据源（可选）" allow-clear>
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

    <!-- 导入数据源 Schema 弹窗 -->
    <a-modal
      v-model:open="importSchemaVisible"
      title="导入数据源结构到知识库"
      @ok="handleImportSchema"
      :confirm-loading="importSchemaLoading"
      width="500px"
    >
      <a-alert 
        message="将数据源的表结构和字段说明导入知识库，可以让 AI 更好地理解数据，减少 Token 使用量。" 
        type="info" 
        show-icon 
        style="margin-bottom: 16px"
      />
      <a-form layout="vertical">
        <a-form-item label="选择数据源" required>
          <a-select v-model:value="importSchemaForm.datasourceId" placeholder="选择要导入的数据源" style="width: 100%">
            <a-select-option v-for="ds in datasources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="importSchemaForm.analyzeFirst">
            如果未分析过，先进行 Schema 分析
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { 
  PlusOutlined, ReloadOutlined, UploadOutlined, DatabaseOutlined, 
  FolderOutlined, MoreOutlined, InboxOutlined, EyeOutlined, 
  EditOutlined, DeleteOutlined, AppstoreOutlined, FileTextOutlined,
  SendOutlined, DownOutlined, CheckCircleOutlined, RocketOutlined,
  CloseOutlined, SearchOutlined, DownloadOutlined, LoadingOutlined,
  MessageOutlined, ShareAltOutlined, UserOutlined, RobotOutlined
} from '@ant-design/icons-vue'
import { get, post, del, put, aiPost } from '@/api/request'
import * as echarts from 'echarts'
import dayjs from 'dayjs'

interface Document {
  id: string
  title: string
  type: string
  chunks: number
  tags?: string[]
  categoryId?: string
  datasourceId?: string
  datasourceName?: string
  createdAt: number
  content?: string
}

interface Stats {
  documentCount: number
  chunkCount: number
  entityCount: number
  relationCount: number
}

const activeTab = ref('manage')
const documents = ref<Document[]>([])
const stats = ref<Stats>({ documentCount: 0, chunkCount: 0, entityCount: 0, relationCount: 0 })
const loading = ref(false)
const searchKeyword = ref('')

const addModalVisible = ref(false)
const addLoading = ref(false)
const editingDocument = ref<Document | null>(null)
const addForm = ref({ 
  title: '', 
  type: 'text', 
  content: '', 
  tags: [] as string[], 
  inputType: 'text' as 'text' | 'file', 
  categoryId: '', 
  datasourceId: '' 
})
const fileList = ref<any[]>([])
const selectedFile = ref<File | null>(null)

// 分类相关
const categories = ref<any[]>([{ id: 'all', name: '全部', documentCount: 0 }])
const selectedCategoryKeys = ref<string[]>(['all'])
const expandedCategoryKeys = ref<string[]>(['all'])
const categoryModalVisible = ref(false)
const categoryLoading = ref(false)
const editingCategory = ref<any>(null)
const categoryForm = ref({ name: '', description: '' })

// 预览相关
const previewVisible = ref(false)
const previewDocument = ref<Document | null>(null)
const previewContent = ref('')

// 批量导入相关
const batchImportVisible = ref(false)
const batchLoading = ref(false)
const batchFileList = ref<any[]>([])
const batchForm = ref({ categoryId: '', datasourceId: '', type: 'text' })

// 全文检索
const fullSearchVisible = ref(false)
const fullSearchQuery = ref('')
const fullSearchResults = ref<any[]>([])
const fullSearchLoading = ref(false)
const highlightChunkContent = ref<string>('')

// 批量导入进度状态
const currentProcessingFile = ref('')
const batchTotalCount = ref(0)
const batchSuccessCount = ref(0)
const batchFailCount = ref(0)
const batchProgress = computed(() => {
  if (batchTotalCount.value === 0) return 0
  return Math.round(((batchSuccessCount.value + batchFailCount.value) / batchTotalCount.value) * 100)
})

// 问答相关
const ragQuestion = ref('')
const ragAnswer = ref<any>(null)
const ragLoading = ref(false)
const ragDatasourceId = ref<string>()
const qaScope = ref<string[]>(['all'])
const datasources = ref<any[]>([])

// 图谱相关
const graphFilter = ref('')
const entityTypes = ref<string[]>([])

// 导入数据源 Schema 相关
const importSchemaVisible = ref(false)
const importSchemaLoading = ref(false)
const importSchemaForm = ref({ datasourceId: '', analyzeFirst: true })
// Writer Mode Auth
const qaMode = ref('qa')
const writerForm = ref({ topic: '', categoryId: undefined as string | undefined })
const outline = ref<any[]>([])
const writerStatus = ref<'idle' | 'generating_outline' | 'writing' | 'done'>('idle')
const writerContent = ref('')
const currentWritingChapter = ref('')

const menuItems = [
  { key: 'manage', label: '知识管理', icon: FolderOutlined },
  { key: 'qa', label: '智能问答', icon: MessageOutlined },
  { key: 'writer', label: '长文写作', icon: EditOutlined },
  { key: 'graph', label: '知识图谱', icon: ShareAltOutlined },
]

const currentMenuLabel = computed(() => {
  return menuItems.find(item => item.key === activeTab.value)?.label || ''
})

async function refreshAllData() {
  await refreshDocuments()
  // 可以在这里添加其他刷新逻辑，如刷新统计
}

const renderMarkdown = (text: string) => {
  if (!text) return ''
  return marked.parse(text)
}

// 计算属性
const currentCategoryName = computed(() => {
  if (selectedCategoryKeys.value[0] === 'all') return '全部文档'
  const cat = categories.value.find(c => c.id === selectedCategoryKeys.value[0])
  return cat?.name || '未分类'
})

const filteredDocuments = computed(() => {
  // 后端已过滤，直接返回
  return documents.value
})

const categoryTreeData = computed(() => {
  const tree = [{ id: 'all', name: '全部', documentCount: documents.value.length }]
  
  categories.value.filter(c => c.id !== 'all').forEach(cat => {
    tree.push({
      id: cat.id,
      name: cat.name,
      documentCount: cat.documentCount || 0,
      children: documents.value
        .filter(d => d.categoryId === cat.id)
        .map(d => ({
          id: d.id,
          name: d.title,
          isLeaf: true,
          documentCount: 0
        }))
    })
  })
  
  return tree
})

const qaScopeOptions = computed(() => {
  const options = [
    {
      value: 'all',
      label: '全部知识库',
      isLeaf: false
    }
  ]
  
  categories.value.filter(c => c.id !== 'all').forEach(cat => {
    const categoryDocs = documents.value.filter(d => d.categoryId === cat.id)
    if (categoryDocs.length > 0) {
      options.push({
        value: cat.id,
        label: cat.name,
        isLeaf: false,
        children: categoryDocs.map(d => ({
          value: d.id,
          label: d.title,
          isLeaf: true
        }))
      })
    }
  })
  
  return options
})

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

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    text: 'blue',
    faq: 'green',
    manual: 'orange',
    api: 'purple'
  }
  return colors[type] || 'default'
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    text: '文本',
    faq: 'FAQ',
    manual: '手册',
    api: 'API文档'
  }
  return labels[type] || type
}

function formatDate(ts: number) {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

function getCategoryName(categoryId?: string) {
  if (!categoryId) return '未分类'
  const cat = categories.value.find(c => c.id === categoryId)
  return cat?.name || '未分类'
}

function getCategoryDocCount(categoryId: string) {
  return documents.value.filter(d => d.categoryId === categoryId).length
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 0.8) return '#52c41a'
  if (confidence >= 0.6) return '#faad14'
  return '#ff4d4f'
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 0.8) return '高'
  if (confidence >= 0.6) return '中'
  return '低'
}

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
})

function handleTableChange(pag: any) {
  pagination.value.current = pag.current
  pagination.value.pageSize = pag.pageSize
  refreshDocuments()
}

// 搜索防抖
let searchTimer: any = null
watch(searchKeyword, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.value.current = 1
    refreshDocuments()
  }, 500)
})

async function refreshDocuments() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: pagination.value.current.toString(),
      pageSize: pagination.value.pageSize.toString(),
    })
    
    if (selectedCategoryKeys.value.length > 0 && selectedCategoryKeys.value[0] !== 'all') {
      params.append('categoryId', selectedCategoryKeys.value[0])
    }
    
    // 列表搜索也支持后端过滤
    if (searchKeyword.value) {
      params.append('keyword', searchKeyword.value)
    }

    const [docsRes, statsRes] = await Promise.all([
      get<any>(`/admin/ai-qa/rag/documents?${params.toString()}`),
      get<Stats>('/admin/ai-qa/rag/stats')
    ])
    
    if (docsRes.success) {
      documents.value = docsRes.data.items || []
      pagination.value.total = docsRes.data.total || 0
    }
    if (statsRes.success) stats.value = statsRes.data || stats.value
    loadCategories()
  } catch (e) {
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

async function refreshGraph() {
  await loadKnowledgeGraph()
}

async function loadKnowledgeGraph() {
  try {
    const res = await get<any>('/admin/ai-qa/rag/graph')
    if (res.success) {
      renderGraph(res.data)
      entityTypes.value = [...new Set(res.data?.entities?.map((e: any) => e.type) || [])]
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

  const existingChart = echarts.getInstanceByDom(dom)
  if (existingChart) {
    existingChart.dispose()
  }

  const chart = echarts.init(dom)
  
  const entities = data?.entities || []
  const relations = data?.relations || []
  
  // 筛选实体
  const filteredEntities = graphFilter.value 
    ? entities.filter((e: any) => e.type === graphFilter.value)
    : entities
  
  if (filteredEntities.length === 0) {
    chart.setOption({
      title: { text: '暂无知识图谱数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
    })
    return
  }

  const nodes = filteredEntities.map((e: any) => ({
    id: e.id,
    name: e.nameCn || e.name,
    category: e.type,
    symbolSize: 30
  }))

  const links = relations
    .filter((r: any) => {
      const hasSource = filteredEntities.some((e: any) => e.id === r.source)
      const hasTarget = filteredEntities.some((e: any) => e.id === r.target)
      return hasSource && hasTarget
    })
    .map((r: any) => ({
      source: r.source,
      target: r.target,
      value: r.type
    }))

  const categories = [...new Set(filteredEntities.map((e: any) => e.type))].map(t => ({ name: t }))

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

function handleSearch() {
  // 搜索通过 computed 自动处理
}

function handleCategorySelect(selectedKeys: string[]) {
  selectedCategoryKeys.value = selectedKeys
}

async function loadCategories() {
  try {
    const res = await get<any[]>('/admin/ai-qa/categories')
    if (res.success) {
      categories.value = [{ id: 'all', name: '全部', documentCount: documents.value.length }, ...(res.data || [])]
    }
  } catch (e) {
    console.error('加载分类失败', e)
  }
}

function showAddCategoryModal() {
  editingCategory.value = null
  categoryForm.value = { name: '', description: '' }
  categoryModalVisible.value = true
}

function editCategory(cat: any) {
  editingCategory.value = cat
  categoryForm.value = { name: cat.name, description: cat.description || '' }
  categoryModalVisible.value = true
}

async function deleteCategory(cat: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除分类 "${cat.name}" 吗？`,
    onOk: async () => {
      try {
        const res = await del(`/admin/ai-qa/categories/${cat.id}`)
        if (res.success) {
          message.success('删除成功')
          loadCategories()
        }
      } catch (e) {
        message.error('删除失败')
      }
    }
  })
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

function showAddModal() {
  editingDocument.value = null
  addForm.value = { 
    title: '', 
    type: 'text', 
    content: '', 
    tags: [], 
    inputType: 'text', 
    categoryId: selectedCategoryKeys[0] !== 'all' ? selectedCategoryKeys[0] : '', 
    datasourceId: '' 
  }
  fileList.value = []
  addModalVisible.value = true
}

function handleEdit(record: Document) {
  editingDocument.value = record
  addForm.value = { 
    title: record.title, 
    type: record.type, 
    content: record.content || '', 
    tags: record.tags || [], 
    inputType: 'text', 
    categoryId: record.categoryId || '', 
    datasourceId: record.datasourceId || '' 
  }
  fileList.value = []
  addModalVisible.value = true
}

async function handlePreview(record: Document, highlightContent?: string) {
  // 如果列表页没有返回 content (分页优化后)，则需要单独获取
  let content = record.content
  if (!content) {
    try {
       loading.value = true
       const res = await get<Document>(`/admin/ai-qa/rag/documents/${record.id}`)
       if (res.success && res.data) {
         content = res.data.content
         // 更新本地缓存（可选）
         record.content = content
       }
    } catch(e) {
       message.error('加载文档内容失败')
       return
    } finally {
       loading.value = false
    }
  }

  previewDocument.value = record
  previewContent.value = content || ''
  previewVisible.value = true
  highlightChunkContent.value = highlightContent || ''
  
  // 如果有高亮，等待 DOM 更新后滚动
  if (highlightChunkContent.value) {
    nextTick(() => {
      scrollToHighlight()
    })
  }
}

async function handlePreviewById(docId: string) {
  const doc = documents.value.find(d => d.id === docId)
  if (doc) {
    await handlePreview(doc)
  }
}

function handleFileSelect(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  
  if (!addForm.value.title) {
    addForm.value.title = file.name.replace(/\.[^/.]+$/, '')
  }
  
  if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(ext || '')) {
    selectedFile.value = file
    addForm.value.content = ext === 'pdf' ? '[PDF文件，将在提交时解析]' : '[图片文件，将使用OCR识别]'
    fileList.value = [{ uid: '-1', name: file.name, status: 'done' }]
    return false
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    addForm.value.content = e.target?.result as string || ''
  }
  reader.readAsText(file)
  selectedFile.value = null
  
  fileList.value = [{ uid: '-1', name: file.name, status: 'done' }]
  return false
}

function handleFileRemove() {
  fileList.value = []
  addForm.value.content = ''
  selectedFile.value = null
}

async function handleSaveDocument() {
  if (!addForm.value.title) {
    message.warning('请填写标题')
    return
  }
  
  if (selectedFile.value) {
    addLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', selectedFile.value)
      formData.append('title', addForm.value.title)
      formData.append('type', addForm.value.type)
      formData.append('tags', JSON.stringify(addForm.value.tags))
      if (addForm.value.categoryId) formData.append('categoryId', addForm.value.categoryId)
      if (addForm.value.datasourceId) formData.append('datasourceId', addForm.value.datasourceId)
      
      const res = await fetch('/api/admin/ai-qa/rag/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      })
      const data = await res.json()
      
      if (data.success) {
        message.success(editingDocument.value ? '更新成功' : '添加成功')
        addModalVisible.value = false
        selectedFile.value = null
        refreshDocuments()
      } else {
        message.error(data.error?.message || '操作失败')
      }
    } catch (e) {
      message.error('操作失败')
    } finally {
      addLoading.value = false
    }
    return
  }
  
  if (!addForm.value.content) {
    message.warning('请填写内容')
    return
  }

  addLoading.value = true
  try {
    const res = await post('/admin/ai-qa/rag/documents', addForm.value)
    if (res.success) {
      message.success(editingDocument.value ? '更新成功' : '添加成功')
      addModalVisible.value = false
      refreshDocuments()
    } else {
      message.error(res.error?.message || '操作失败')
    }
  } catch (e) {
    message.error('操作失败')
  } finally {
    addLoading.value = false
  }
}

async function handleDelete(record: Document) {
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

function showBatchImportModal() {
  batchForm.value = { categoryId: selectedCategoryKeys[0] !== 'all' ? selectedCategoryKeys[0] : '', datasourceId: '', type: 'text' }
  batchFileList.value = []
  batchImportVisible.value = true
}

function handleBatchFileSelect(file: File) {
  return false
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
  // 进度状态变量
  currentProcessingFile.value = ''
  batchTotalCount.value = batchFileList.value.length
  batchSuccessCount.value = 0
  batchFailCount.value = 0
  
  let successCount = 0
  let failCount = 0

  try {
    for (const fileItem of batchFileList.value) {
      if (fileItem.status === 'done') {
        successCount++
        batchSuccessCount.value++
        continue // 跳过已完成的
      }
      
      const file = fileItem.originFileObj || fileItem
      currentProcessingFile.value = file.name
      fileItem.status = 'uploading'
      fileItem.percent = 0
      
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
        // 模拟进度条动画（因为 fetch 无法获取上传进度，这里用定时器模拟）
        const progressTimer = setInterval(() => {
          if (fileItem.percent < 90) {
            fileItem.percent += 10
          }
        }, 200)

        const res = await fetch('/api/admin/ai-qa/rag/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        })
        
        clearInterval(progressTimer)
        const data = await res.json()
        
        if (data.success) {
          successCount++
          batchSuccessCount.value++
          fileItem.status = 'done'
          fileItem.percent = 100
        } else {
          failCount++
          batchFailCount.value++
          fileItem.status = 'error'
          fileItem.response = data.error?.message || '导入失败'
          console.error(`文件 ${file.name} 导入失败:`, data.error)
        }
      } catch (e) {
        failCount++
        batchFailCount.value++
        fileItem.status = 'error'
        fileItem.response = '网络错误'
        console.error(`文件 ${file.name} 导入失败:`, e)
      }
    }

    if (successCount > 0) {
      // 延迟关闭，让用户看到最后的完成状态
      setTimeout(() => {
        message.success(`处理完成：成功 ${successCount} 个，失败 ${failCount} 个`)
        if (failCount === 0) {
           batchImportVisible.value = false
           batchFileList.value = []
        }
        refreshDocuments()
        loadCategories()
      }, 1000)
    } else {
      message.error('所有文件导入失败')
    }
  } finally {
    batchLoading.value = false
    currentProcessingFile.value = ''
  }
}

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
      refreshDocuments()
      loadKnowledgeGraph()
    } else {
      message.error(res.error?.message || '导入失败')
    }
  } catch (e) {
    message.error('导入失败')
  } finally {
    importSchemaLoading.value = false
  }
}

// Chat Related
const chatScrollRef = ref<HTMLElement | null>(null)
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  time: number
  confidence?: number
  sources?: any[]
  dataContext?: any
}
const chatHistory = ref<ChatMessage[]>([])
const suggestedQuestions = [
  "本知识库包含哪些主要内容？",
  "如何接入新的数据源？",
  "最新的 API 文档在哪里查看？",
  "数据隐私安全是如何保障的？"
]

function scrollToBottom() {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

function handleChatEnter(e: KeyboardEvent) {
  if (!e.shiftKey) {
    e.preventDefault()
    handleRAGAsk()
  }
}

async function handleRAGAsk() {
  const q = ragQuestion.value.trim()
  if (!q) {
    message.warning('请输入问题')
    return
  }

  // 1. Add User Message
  chatHistory.value.push({
    role: 'user',
    content: q,
    time: Date.now()
  })
  
  // Clear input and scroll
  ragQuestion.value = ''
  scrollToBottom()

  // 2. Add Assistant Loading Message
  const loadingMsg: ChatMessage = {
    role: 'assistant',
    content: '',
    loading: true,
    time: Date.now()
  }
  chatHistory.value.push(loadingMsg)
  scrollToBottom()

  ragLoading.value = true
  
  try {
    const scope = qaScope.value
    let categoryId: string | undefined
    let documentId: string | undefined

    if (scope && scope.length > 0 && scope[0] !== 'all') {
      categoryId = scope[0]
      if (scope.length > 1) {
        documentId = scope[1]
      }
    }


    const res = await aiPost<any>('/admin/ai-qa/rag/ask', { 
      question: q,
      datasourceId: ragDatasourceId.value,
      categoryId,
      documentId
    })

    // Update the loading message
    const lastMsg = chatHistory.value[chatHistory.value.length - 1]
    lastMsg.loading = false
    
    if (res.success) {
      lastMsg.content = res.data.answer
      lastMsg.confidence = res.data.confidence
      lastMsg.sources = res.data.sources
      lastMsg.dataContext = res.data.dataContext
      
      // Keep compatible with simple mode variables if needed, though we moved to chatHistory
      ragAnswer.value = res.data
    } else {
      lastMsg.content = `抱歉，遇到了一些问题：${res.error?.message || '未知错误'}`
    }

  } catch (e) {
    const lastMsg = chatHistory.value[chatHistory.value.length - 1]
    lastMsg.loading = false
    lastMsg.content = '网络请求失败，请稍后重试。'
  } finally {
    ragLoading.value = false
    scrollToBottom()
  }
}

// 长文写作相关方法
async function handleGenerateOutline() {
  if (!writerForm.value.topic) {
    message.warning('请输入文章主题')
    return
  }
  
  writerStatus.value = 'generating_outline'
  try {
    const res = await aiPost<any>('/admin/ai-qa/rag/outline', writerForm.value)
    if (res.success) {
      outline.value = res.data
      message.success('大纲生成成功，您可以进行调整')
    } else {
      message.error(res.error?.message || '生成大纲失败')
    }
  } catch (e) {
    message.error('生成大纲失败')
  } finally {
    writerStatus.value = 'idle'
  }
}

function addChapter() {
  outline.value.push({ title: '新章节', description: '' })
}

function removeChapter(index: number) {
  outline.value.splice(index, 1)
}

// ------------------ Writer 异步任务相关 ------------------

const writerTaskId = ref('');
const pollTimer = ref<any>(null);

// 恢复先前的任务
onMounted(() => {
  const savedTaskId = localStorage.getItem('writerTaskId');
  if (savedTaskId) {
    writerTaskId.value = savedTaskId;
    pollTaskStatus();
  }
});

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value);
});

async function handleGenerateArticle() {
  if (outline.value.length === 0) return;
  
  writerStatus.value = 'writing';
  writerContent.value = `# ${writerForm.value.topic}\n\n(正在后台撰写中...)\n\n`;
  message.loading({ content: '正在提交后台任务...', key: 'submitTask' });

  try {
    // 提交任务到后台
    const res = await post<any>('/admin/ai-qa/rag/tasks/submit', {
      topic: writerForm.value.topic,
      outline: outline.value,
      categoryId: writerForm.value.categoryId
    });

    if (res.success) {
      message.success({ content: '任务已提交，正在后台运行', key: 'submitTask' });
      writerTaskId.value = res.data.taskId;
      localStorage.setItem('writerTaskId', writerTaskId.value);
      pollTaskStatus();
    } else {
      message.error({ content: res.error?.message || '任务提交失败', key: 'submitTask' });
      writerStatus.value = 'idle';
    }
  } catch (e) {
    message.error({ content: '任务提交失败', key: 'submitTask' });
    writerStatus.value = 'idle';
  }
}

async function pollTaskStatus() {
  if (pollTimer.value) clearInterval(pollTimer.value);

  const check = async () => {
    if (!writerTaskId.value) return;

    try {
      const res = await get<any>(`/admin/ai-qa/rag/tasks/${writerTaskId.value}`);
      if (res.success) {
        const task = res.data;
        
        // 同步状态
        if (task.status === 'generating') {
           writerStatus.value = 'writing';
           writerContent.value = task.content;
           const currentChapter = task.outline[task.currentChapterIndex]?.title || '';
           currentWritingChapter.value = currentChapter;
        } else if (task.status === 'queued') {
           writerStatus.value = 'writing'; // 仍然显示为进行中界面
           currentWritingChapter.value = '等待执行中 (已加入队列)...';
           writerContent.value = task.content + '\n\n> 任务正在排队中，请稍候...\n';
        } else if (task.status === 'completed') {
           writerStatus.value = 'done';
           writerContent.value = task.content;
           message.success('文章撰写完成');
           clearTask();
        } else if (task.status === 'failed') {
           writerStatus.value = 'idle';
           message.error(`任务失败: ${task.error}`);
           clearTask();
        }
      } else {
         // 任务可能丢失（服务器重启）
         if (res.error?.message === '任务不存在') {
           message.warning('原有任务已过期');
           clearTask();
         }
      }
    } catch (e) {
      console.error('Polling failed', e);
    }
  };

  await check(); // 立即检查一次
  pollTimer.value = setInterval(check, 3000); // 每3秒轮询一次
}

function clearTask() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
  writerTaskId.value = '';
  localStorage.removeItem('writerTaskId');
}

function handleExportMarkdown() {
  const blob = new Blob([writerContent.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${writerForm.value.topic}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 全文检索相关方法
function showFullSearch() {
  fullSearchVisible.value = true
  if (!fullSearchQuery.value) {
    fullSearchQuery.value = ''
    fullSearchResults.value = []
  }
}

async function handleFullSearch() {
  if (!fullSearchQuery.value.trim()) return
  
  fullSearchLoading.value = true
  try {
    const res = await get<any>(`/admin/ai-qa/rag/search?q=${encodeURIComponent(fullSearchQuery.value)}`)
    if (res.success) {
      fullSearchResults.value = res.data
    } else {
      message.error(res.error?.message || '搜索失败')
    }
  } catch (e) {
    message.error('搜索失败')
  } finally {
    fullSearchLoading.value = false
  }
}

async function handleLocate(item: any) {
  // 查找对应的文档
  let doc = documents.value.find(d => d.id === item.documentId)
  if (!doc) {
    message.loading({ content: '正在加载文档详情...', key: 'loadingContent' })
    try {
      // 调用单文档获取接口
      const res = await get<Document>(`/admin/ai-qa/rag/documents/${item.documentId}`)
      if (res.success && res.data) {
        doc = res.data
        handlePreview(doc, item.content) // 优先使用搜索命中的高亮内容（如有）
      } else {
        message.warning('无法查看该文档（可能已被删除）')
      }
    } catch(e) {
      message.error('加载文档详情失败')
    } finally {
       message.destroy('loadingContent')
    }
    return
  }
  
  if (doc) {
    handlePreview(doc, item.content)
  } else {
     // 尝试通过 ID 获取（如果后端支持单文档接口，这里暂无，用 all list）
     message.warning('未在当前列表中找到该文档')
  }
}

function highlightKeyword(content: string, query: string) {
  if (!query) return content.slice(0, 200)
  
  const keywords = query.trim().split(/\s+/).filter(k => k)
  if (keywords.length === 0) return content.slice(0, 200)

  // 1. 找到第一个匹配关键词的位置，用于截取片段
  const lowerContent = content.toLowerCase()
  let firstMatchIndex = -1
  for (const k of keywords) {
    const idx = lowerContent.indexOf(k.toLowerCase())
    if (idx !== -1) {
      firstMatchIndex = idx
      break // 找到一个即可
    }
  }

  // 2. 截取片段
  let snippet = ''
  if (firstMatchIndex === -1) {
    snippet = content.slice(0, 200)
  } else {
    const start = Math.max(0, firstMatchIndex - 50)
    const end = Math.min(content.length, firstMatchIndex + 150)
    snippet = content.slice(start, end)
    if (end < content.length) snippet += '...'
  }

  // 3. 高亮所有关键词
  let highlighted = snippet
  // 按长度降序排序，避免短词替换长词的一部分（如 "test case" vs "test"）
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length)
  
  for (const k of sortedKeywords) {
    const regex = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    highlighted = highlighted.replace(regex, '<span style="color: #ff4d4f; font-weight: bold; background: rgba(255, 77, 79, 0.1); padding: 0 2px; border-radius: 2px;">$&</span>')
  }

  return highlighted
}

function renderPreviewContent(content: string, highlightChunk: string) {
  if (!highlightChunk) return content.replace(/\n/g, '<br/>')
  
  // 简单全匹配高亮
  // 注意 HTML 转义
  const safeContent = content // 假设内容是安全的或已处理
  // 实际应该先转义 HTML 实体
  
  const chunkIndex = safeContent.indexOf(highlightChunk)
  if (chunkIndex > -1) {
    const before = safeContent.slice(0, chunkIndex)
    const target = safeContent.slice(chunkIndex, chunkIndex + highlightChunk.length)
    const after = safeContent.slice(chunkIndex + highlightChunk.length)
    
    return `${before.replace(/\n/g, '<br/>')}<span id="highlight-target" style="background-color: #ffe58f; padding: 2px 0;">${target.replace(/\n/g, '<br/>')}</span>${after.replace(/\n/g, '<br/>')}`
  }
  
  return content.replace(/\n/g, '<br/>')
}

function scrollToHighlight() {
  const el = document.getElementById('highlight-target')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

onMounted(() => {
  refreshDocuments()
  loadKnowledgeGraph()
})

watch(activeTab, (newTab) => {
  if (newTab === 'graph') {
    nextTick(() => {
      loadKnowledgeGraph()
    })
  }
})
</script>

<style scoped>
/* 全局容器：使用视口高度，禁止 body以此容器为准 */
.knowledge-page {
  display: flex;
  height: calc(100vh - 64px); /* 减去顶部导航栏高度 */
  background: #f0f2f5;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 侧边栏：科技感深色/渐变风格 */
.knowledge-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #001529 0%, #000c17 100%);
  display: flex;
  flex-direction: column;
  color: rgba(255, 255, 255, 0.65);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.icon-pulse {
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: white;
  letter-spacing: 0.5px;
}

.sidebar-menu {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 4px;
  position: relative;
}

.menu-item:hover {
  color: white;
  background: rgba(255, 255, 255, 0.08);
}

.menu-item.active {
  color: white;
  background: linear-gradient(90deg, rgba(24, 144, 255, 0.2) 0%, rgba(24, 144, 255, 0) 100%);
  border-right: 3px solid #1890ff;
}

.item-icon {
  font-size: 18px;
  margin-right: 12px;
}

.item-label {
  font-size: 14px;
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.refresh-indicator {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: color 0.3s;
}

.refresh-indicator:hover {
  color: white;
}

/* 主内容区 */
.knowledge-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f5f7fa;
}

.main-header {
  height: 64px;
  padding: 0 24px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  z-index: 5;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f1f1f;
}

.global-stats {
  display: flex;
  gap: 16px;
  color: #666;
  font-size: 13px;
}

.stat-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f5f5f5;
  padding: 4px 10px;
  border-radius: 12px;
}

.action-btn {
  background: linear-gradient(135deg, #40a9ff 0%, #096dd9 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
}

.action-btn:hover {
  background: linear-gradient(135deg, #1890ff 0%, #0050b3 100%);
  transform: translateY(-1px);
}

.main-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
}

/* 1. 知识管理视图 */
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
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
  font-weight: 600;
}

.tech-tree :deep(.ant-tree-node-content-wrapper) {
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

.tech-tree :deep(.ant-tree-node-selected .ant-tree-node-content-wrapper) {
  background-color: #e6f7ff;
  color: #1890ff;
  font-weight: 500;
}

.document-panel {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
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
}

.doc-count {
  font-size: 13px;
  color: #999;
}

.glass-search :deep(.ant-input) {
  background: #f5f7fa;
  border: 1px solid transparent;
  transition: all 0.3s;
}

.glass-search :deep(.ant-input:focus) {
  background: white;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.tech-table :deep(.ant-table-thead > tr > th) {
  background: white;
  border-bottom: 2px solid #f0f0f0;
  font-weight: 600;
}

.category-tag {
  background: #f0f5ff;
  color: #2f54eb;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.action-link {
  color: #8c8c8c;
  transition: color 0.3s;
  font-size: 16px;
}

.action-link:hover {
  color: #1890ff;
}

.action-link.danger:hover {
  color: #ff4d4f;
}

/* 2. 聊天视图 */
.chat-view {
  height: 100%;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  scroll-behavior: smooth;
  background: #fff;
}

.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-hero {
  text-align: center;
  margin-bottom: 40px;
}

.hero-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: #1890ff;
  margin: 0 auto 24px;
}

.empty-hero h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1f1f1f;
  margin-bottom: 8px;
}

.empty-hero p {
  color: #8c8c8c;
  font-size: 16px;
}

.suggested-questions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  max-width: 600px;
}

.suggest-chip {
  padding: 8px 16px;
  background: #f5f7fa;
  border: 1px solid #f0f0f0;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  color: #595959;
}

.suggest-chip:hover {
  background: #e6f7ff;
  border-color: #bae7ff;
  color: #1890ff;
}

.message-wrapper {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.assistant .message-avatar {
  background: #e6f7ff;
  color: #1890ff;
}

.user .message-avatar {
  background: #f0f2f5;
  color: #595959;
}

.message-content {
  max-width: 80%;
}

.message-bubble {
  padding: 16px 20px;
  border-radius: 16px;
  line-height: 1.6;
  font-size: 15px;
}

.assistant .message-bubble {
  background: #f9fafb;
  color: #262626;
  border-top-left-radius: 2px;
}

.user .message-bubble {
  background: #1890ff;
  color: white;
  border-top-right-radius: 2px;
}

.message-sources {
  margin-top: 12px;
  background: #f9f9f9;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.source-header {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.source-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-chip {
  font-size: 12px;
  background: white;
  border: 1px solid #e8e8e8;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.2s;
}

.source-chip:hover {
  color: #1890ff;
  border-color: #91d5ff;
}

.message-footer {
  margin-top: 4px;
  font-size: 12px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #ccc;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.chat-input-area {
  padding: 24px;
  background: white;
  border-top: 1px solid #f0f0f0;
}

.input-wrapper {
  max-width: 900px;
  margin: 0 auto;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 12px 16px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.3s;
}

.input-wrapper:focus-within {
  border-color: #1890ff;
  box-shadow: 0 4px 16px rgba(24, 144, 255, 0.1);
}

.qa-config-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #f0f0f0;
}

.mini-cascader, .mini-select {
  width: 140px;
  font-size: 12px;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.chat-input {
  flex: 1;
  border: none !important;
  box-shadow: none !important;
  padding: 0;
  font-size: 14px;
  resize: none;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 3. Writer 视图 */
.writer-view {
  height: 100%;
}

.writer-inner-layout {
  display: flex;
  height: 100%;
  gap: 24px;
}

.writer-sidebar-content {
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
}

.config-section, .outline-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.outline-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 600;
}

.outline-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  padding: 4px;
}

.outline-item-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.outline-item-mini:hover {
  background: white;
  border-color: #d9d9d9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.idx {
  width: 20px;
  height: 20px;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
}

.chapter-input {
  font-size: 13px;
  color: #333;
}

.writer-main-content {
  flex: 1;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.paper-toolbar {
  height: 48px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.paper-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  background-image: linear-gradient(#f8f8f8 1px, transparent 1px);
  background-size: 100% 32px;
}

.paper-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ccc;
}

/* 4. 知识图谱视图 */
.graph-view {
  height: 100%;
}

.graph-full-container {
  height: 100%;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.graph-controls-glass {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 5;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  padding: 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.stats-group {
  display: flex;
  gap: 12px;
  padding: 0 8px;
  border-right: 1px solid #eee;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat .val { font-weight: bold; font-size: 14px; line-height: 1; }
.stat .lab { font-size: 10px; color: #999; }

.graph-canvas-full {
  width: 100%;
  height: 100%;
}

.scroll-shadow {
  /* 滚动条美化 */
}
.scroll-shadow::-webkit-scrollbar {
  width: 6px;
}
.scroll-shadow::-webkit-scrollbar-thumb {
  background: #e8e8e8;
  border-radius: 3px;
}
</style>



.document-list {
  flex: 1;
  min-width: 0;
}

.tree-node-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-title-link {
  color: #1890ff;
  cursor: pointer;
  transition: color 0.2s;
}

.doc-title-link:hover {
  color: #40a9ff;
  text-decoration: underline;
}

.stats-row {
  margin-bottom: 16px;
}

.upload-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.qa-input-section,
.qa-answer-section {
  padding: 16px;
}

.qa-input-section h3,
.qa-answer-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.loading-state {
  text-align: center;
  padding: 60px 0;
}

.answer-content {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 8px;
}

.answer-text {
  margin-bottom: 16px;
}

.confidence-section {
  margin: 16px 0;
  padding: 12px;
  background: white;
  border-radius: 6px;
}

.sources-section {
  margin-top: 16px;
}

.sources-section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.sources-list {
  max-height: 300px;
  overflow-y: auto;
}

.source-link {
  color: #1890ff;
  cursor: pointer;
}

.source-link:hover {
  text-decoration: underline;
}

.source-content {
  color: #666;
  font-size: 12px;
}

.data-context-section {
  margin-top: 16px;
}

.data-context-section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.sql-query {
  margin-top: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.empty-state {
  padding: 60px 0;
}

.document-preview {
  max-height: 600px;
  overflow-y: auto;
}

.preview-content {
  padding: 16px;
  background: #f6f8fa;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.search-results {
  margin-top: 16px;
  max-height: 500px;
  overflow-y: auto;
}
.search-result-item {
  cursor: pointer;
  padding: 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}
.search-result-item:hover {
  background-color: #f5f5f5;
}
.result-title {
  font-weight: bold;
  font-size: 15px;
  color: #1890ff;
}
.result-snippet {
  color: #666;
  font-size: 13px;
  margin-top: 4px;
}
.result-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.preview-content__container {
  height: 500px; /* Force height for scrolling */
  overflow-y: auto;
}
.preview-content {
  padding: 16px;
  background: #f6f8fa;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

.processing-alert {
  margin-top: 16px;
}
.progress-text {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

:deep(.ant-tabs) {
  margin-bottom: 16px;
}

:deep(.ant-tabs-nav) {
  font-size: 15px;
}

:deep(.ant-tabs-tab) {
  font-weight: 500;
}

.table-footer-info {
  margin-top: 16px;
  text-align: right;
  color: #999;
  font-size: 13px;
}

.writer-card {
  background: #fff; 
  border-radius: 8px;
  height: 100%;
}

.writer-preview {
  min-height: 500px;
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}

.writer-mode {
  height: calc(100vh - 240px);
  min-height: 600px;
}

.writer-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding-bottom: 24px;
}

.writer-config-panel,
.outline-panel {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  border: 1px solid #f0f0f0;
}

.writer-config-panel {
  flex-shrink: 0;
}

.outline-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* flex scroll fix */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  display: flex;
  align-items: center;
  gap: 8px;
}

.outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px; /* for shadow clipping */
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.outline-card {
  background: white;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  gap: 12px;
  transition: all 0.2s;
  position: relative;
}

.outline-card:hover {
  border-color: #d9d9d9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transform: translateY(-1px);
}

.outline-card.active-writing {
  border-color: #1890ff;
  background: #f0f5ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.card-handle {
  display: flex;
  align-items: flex-start;
  padding-top: 4px;
}

.index-badge {
  background: #f5f5f5;
  color: #999;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 24px;
  text-align: center;
}

.active-writing .index-badge {
  background: #1890ff;
  color: white;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chapter-title-input {
  font-weight: 600;
  font-size: 14px;
  padding: 0 !important;
}

.chapter-desc-input {
  font-size: 12px;
  color: #666;
  padding: 0 !important;
  resize: none;
}

.card-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.outline-card:hover .card-actions {
  opacity: 1;
}

.empty-outline {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #ccc;
  border: 2px dashed #f0f0f0;
  border-radius: 8px;
  margin: 4px;
  min-height: 200px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

/* Preview Column */
.writer-preview-col {
  height: 100%;
  padding-bottom: 24px;
}

.preview-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px 24px;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  flex-shrink: 0;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
}

.highlight-status {
  color: #1890ff;
}

.success-status {
  color: #52c41a;
}

.editor-paper {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  padding: 48px;
  overflow-y: auto;
  position: relative;
  /* Paper texture effect */
  background-image: linear-gradient(#f8f8f8 1px, transparent 1px);
  background-size: 100% 32px; /* 模拟信纸行 */
  background-color: white; 
}

/* Markdown Typography Enhancement */
.markdown-body {
  max-width: 800px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.8;
  color: #24292e;
  background: transparent;
}

.markdown-body :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
  margin-bottom: 24px;
  margin-top: 0;
}

.markdown-body :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
  margin-top: 32px;
  margin-bottom: 16px;
}

.markdown-body :deep(h3) {
   font-size: 1.25em;
   margin-top: 24px;
   margin-bottom: 16px;
}

.markdown-body :deep(p) {
  margin-bottom: 16px;
  text-align: justify;
}

.markdown-body :deep(blockquote) {
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  padding: 0 1em;
  margin: 0 0 16px 0;
}

.markdown-body :deep(ul), .markdown-body :deep(ol) {
  padding-left: 2em;
  margin-bottom: 16px;
}

.writer-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.action-bar {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.start-btn {
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 24px;
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.start-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(24, 144, 255, 0.4);
}

.compact-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}
</style>
