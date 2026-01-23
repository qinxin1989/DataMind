<template>
  <div class="writer-view">
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
              <template #icon><BulbOutlined /></template>生成大纲
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  PlusOutlined, CloseOutlined, BulbOutlined, 
  LoadingOutlined, DownloadOutlined, FileTextOutlined 
} from '@ant-design/icons-vue'
import { get, post, aiPost } from '@/api/request'
import { renderMarkdown } from './shared'

// 状态
const writerForm = ref({ topic: '', categoryId: undefined as string | undefined })
const outline = ref<any[]>([])
const writerStatus = ref<'idle' | 'generating_outline' | 'writing' | 'done'>('idle')
const writerContent = ref('')
const currentWritingChapter = ref('')
const writerTaskId = ref('')
const pollTimer = ref<any>(null)

// 生成大纲
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

// 生成全文（异步任务）
async function handleGenerateArticle() {
  if (outline.value.length === 0) return
  
  writerStatus.value = 'writing'
  writerContent.value = `# ${writerForm.value.topic}\n\n(正在后台撰写中...)\n\n`
  message.loading({ content: '正在提交后台任务...', key: 'submitTask' })

  try {
    const res = await post<any>('/admin/ai-qa/rag/tasks/submit', {
      topic: writerForm.value.topic,
      outline: outline.value,
      categoryId: writerForm.value.categoryId
    })

    if (res.success) {
      message.success({ content: '任务已提交，正在后台运行', key: 'submitTask' })
      writerTaskId.value = res.data.taskId
      localStorage.setItem('writerTaskId', writerTaskId.value)
      pollTaskStatus()
    } else {
      message.error({ content: res.error?.message || '任务提交失败', key: 'submitTask' })
      writerStatus.value = 'idle'
    }
  } catch (e) {
    message.error({ content: '任务提交失败', key: 'submitTask' })
    writerStatus.value = 'idle'
  }
}

async function pollTaskStatus() {
  if (pollTimer.value) clearInterval(pollTimer.value)

  const check = async () => {
    if (!writerTaskId.value) return

    try {
      const res = await get<any>(`/admin/ai-qa/rag/tasks/${writerTaskId.value}`)
      if (res.success) {
        const task = res.data
        
        if (task.status === 'generating') {
          writerStatus.value = 'writing'
          writerContent.value = task.content
          currentWritingChapter.value = task.outline[task.currentChapterIndex]?.title || ''
        } else if (task.status === 'queued') {
          writerStatus.value = 'writing'
          currentWritingChapter.value = '等待执行中 (已加入队列)...'
        } else if (task.status === 'completed') {
          writerStatus.value = 'done'
          writerContent.value = task.content
          message.success('文章撰写完成')
          clearTask()
        } else if (task.status === 'failed') {
          writerStatus.value = 'idle'
          message.error(`任务失败: ${task.error}`)
          clearTask()
        }
      }
    } catch (e) {
      console.error('Polling failed', e)
    }
  }

  await check()
  pollTimer.value = setInterval(check, 3000)
}

function clearTask() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
  writerTaskId.value = ''
  localStorage.removeItem('writerTaskId')
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

onMounted(() => {
  const savedTaskId = localStorage.getItem('writerTaskId')
  if (savedTaskId) {
    writerTaskId.value = savedTaskId
    pollTaskStatus()
  }
})

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value)
})
</script>

<style scoped>
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
  background: var(--bg-container);
  border-radius: var(--border-radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.config-section h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--text-primary);
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
  background: var(--bg-page);
  border-radius: var(--border-radius-sm);
  margin-bottom: 8px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.outline-item-mini:hover {
  background: var(--bg-container);
  border-color: var(--border-color-base);
  box-shadow: var(--shadow-sm);
}

.idx {
  width: 20px;
  height: 20px;
  background: var(--primary-bg-light);
  color: var(--primary-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
}

.chapter-input {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
}

.writer-main-content {
  flex: 1;
  background: var(--bg-container);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.paper-toolbar {
  height: 48px;
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.writing-status {
  color: var(--primary-color);
  font-size: 14px;
}

.paper-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  background-image: linear-gradient(var(--bg-page) 1px, transparent 1px);
  background-size: 100% 32px;
}

.paper-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-disabled);
}

.scroll-shadow::-webkit-scrollbar {
  width: 6px;
}
.scroll-shadow::-webkit-scrollbar-thumb {
  background: var(--border-color-base);
  border-radius: 3px;
}
</style>
