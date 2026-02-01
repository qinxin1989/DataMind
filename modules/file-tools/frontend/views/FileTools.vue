<template>
  <div class="file-tools">
    <a-card title="文件工具箱">
      <template #extra>
        <a-button type="link" @click="showHistory = true">
          <history-outlined /> 转换历史
        </a-button>
      </template>

      <div v-if="!selectedTool" class="tool-grid">
        <a-row :gutter="[16, 16]">
          <a-col :span="8">
            <a-card hoverable @click="handleToolClick('pdf-merge')">
              <template #title><file-pdf-outlined /> PDF 合并</template>
              <p>将多个 PDF 文件合并为一个</p>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card hoverable @click="handleToolClick('image-compress')">
              <template #title><file-image-outlined /> 图片压缩</template>
              <p>批量压缩图片，减小文件体积</p>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card hoverable @click="handleToolClick('format-convert')">
              <template #title><swap-outlined /> 格式转换</template>
              <p>Word/Excel/图片与PDF互转</p>
            </a-card>
          </a-col>
        </a-row>
      </div>
      
      <div v-else class="tool-content">
        <div class="tool-header">
          <a-button type="link" @click="selectedTool = null">
            <left-outlined /> 返回
          </a-button>
          <span class="tool-title">{{ selectedToolName }}</span>
        </div>
        
        <!-- 格式转换 -->
        <div v-if="selectedTool === 'format-convert'" class="tool-body">
          <a-form layout="vertical">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="源文件格式">
                  <a-select v-model:value="sourceFormat" placeholder="选择源格式">
                    <a-select-option value="word">Word (.docx)</a-select-option>
                    <a-select-option value="excel">Excel (.xlsx)</a-select-option>
                    <a-select-option value="image">图片 (.jpg/.png)</a-select-option>
                    <a-select-option value="pdf">PDF (.pdf)</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="目标格式">
                  <a-select v-model:value="targetFormat" placeholder="选择目标格式">
                    <a-select-option v-if="sourceFormat === 'pdf'" value="txt">纯文本 (.txt)</a-select-option>
                    <a-select-option v-if="sourceFormat !== 'pdf'" value="pdf">PDF</a-select-option>
                    <a-select-option v-if="sourceFormat === 'pdf'" value="word">Word</a-select-option>
                    <a-select-option v-if="sourceFormat === 'pdf'" value="excel">Excel</a-select-option>
                    <a-select-option v-if="sourceFormat === 'pdf'" value="image">图片</a-select-option>
                    <a-select-option v-if="sourceFormat === 'word'" value="txt">纯文本</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
          
          <a-upload-dragger
            v-model:fileList="fileList"
            :multiple="true"
            :before-upload="handleBeforeUpload"
            @remove="handleRemove"
            :accept="getAcceptTypes()"
          >
            <p class="ant-upload-drag-icon"><inbox-outlined /></p>
            <p class="ant-upload-text">点击或拖拽{{ getFormatLabel(sourceFormat) }}文件到此区域</p>
            <p class="ant-upload-hint">支持批量上传，将转换为{{ getFormatLabel(targetFormat) }}格式</p>
          </a-upload-dragger>
          
          <div v-if="fileList.length > 0" class="actions" style="margin-top: 16px;">
            <a-button type="primary" :loading="processing" @click="processFiles" :disabled="!targetFormat">
              转换为 {{ getFormatLabel(targetFormat) }}
            </a-button>
            <a-button @click="fileList = []">清空列表</a-button>
          </div>
        </div>
        
        <!-- 其他工具 -->
        <div v-else class="tool-body">
          <a-upload-dragger
            v-model:fileList="fileList"
            :multiple="true"
            :before-upload="handleBeforeUpload"
            @remove="handleRemove"
          >
            <p class="ant-upload-drag-icon"><inbox-outlined /></p>
            <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p class="ant-upload-hint">支持单个或批量上传</p>
          </a-upload-dragger>
          
          <div v-if="fileList.length > 0" class="actions" style="margin-top: 16px;">
            <a-button type="primary" :loading="processing" @click="processFiles">
              {{ selectedTool === 'pdf-merge' ? '合并文件' : '开始压缩' }}
            </a-button>
            <a-button @click="fileList = []">清空列表</a-button>
          </div>
        </div>
        
        <div v-if="resultUrl" class="result" style="margin-top: 16px;">
          <a-alert type="success" message="处理完成！" show-icon>
            <template #description>
              <a :href="resultUrl" :download="resultFileName">点击下载结果文件</a>
            </template>
          </a-alert>
        </div>
      </div>
    </a-card>

    <!-- 历史记录抽屉 -->
    <a-drawer
      v-model:visible="showHistory"
      title="转换历史"
      width="600"
      placement="right"
    >
      <a-table
        :columns="historyColumns"
        :data-source="historyData"
        :loading="historyLoading"
        :pagination="historyPagination"
        @change="handleHistoryTableChange"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" danger @click="handleDeleteHistory(record.id)">
              删除
            </a-button>
          </template>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { 
  FilePdfOutlined, FileImageOutlined, SwapOutlined, 
  LeftOutlined, InboxOutlined, HistoryOutlined
} from '@ant-design/icons-vue'
import * as api from '../api'

const selectedTool = ref<string | null>(null)
const selectedToolName = ref('')
const fileList = ref<any[]>([])
const processing = ref(false)
const resultUrl = ref('')
const resultFileName = ref('')

// 格式转换相关
const sourceFormat = ref('word')
const targetFormat = ref('pdf')

// 历史记录相关
const showHistory = ref(false)
const historyData = ref<any[]>([])
const historyLoading = ref(false)
const historyPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0
})

const historyColumns = [
  { title: '原文件', dataIndex: 'originalFilename', key: 'originalFilename', ellipsis: true },
  { title: '转换', key: 'conversion', customRender: ({ record }: any) => `${record.sourceFormat} → ${record.targetFormat}` },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '时间', key: 'createdAt', customRender: ({ record }: any) => new Date(record.createdAt).toLocaleString() },
  { title: '操作', key: 'action' }
]

// 监听源格式变化
watch(sourceFormat, (newVal) => {
  if (newVal === 'pdf') {
    targetFormat.value = 'txt'
  } else {
    targetFormat.value = 'pdf'
  }
})

// 监听历史记录抽屉
watch(showHistory, (visible) => {
  if (visible) {
    loadHistory()
  }
})

function handleToolClick(tool: string) {
  selectedTool.value = tool
  selectedToolName.value = tool === 'pdf-merge' ? 'PDF 合并' : (tool === 'image-compress' ? '图片压缩' : '格式转换')
  fileList.value = []
  resultUrl.value = ''
  sourceFormat.value = 'word'
  targetFormat.value = 'pdf'
}

function getAcceptTypes() {
  switch (sourceFormat.value) {
    case 'word': return '.doc,.docx'
    case 'excel': return '.xls,.xlsx'
    case 'image': return '.jpg,.jpeg,.png,.gif,.bmp'
    case 'pdf': return '.pdf'
    default: return '*'
  }
}

function getFormatLabel(format: string) {
  const labels: Record<string, string> = {
    word: 'Word',
    excel: 'Excel',
    image: '图片',
    pdf: 'PDF',
    txt: '纯文本'
  }
  return labels[format] || format
}

const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  fileList.value = [...fileList.value, file]
  return false
}

const handleRemove: UploadProps['onRemove'] = (file) => {
  const index = fileList.value.indexOf(file)
  if (index > -1) {
    fileList.value.splice(index, 1)
  }
}

async function processFiles() {
  if (fileList.value.length === 0) {
    return message.warning('请先选择文件')
  }
  
  if (selectedTool.value === 'format-convert' && !targetFormat.value) {
    return message.warning('请选择目标格式')
  }
  
  processing.value = true
  resultUrl.value = ''
  
  try {
    const files = fileList.value.map(f => f.originFileObj || f)
    const result = await api.convertFiles({
      files,
      sourceFormat: sourceFormat.value,
      targetFormat: targetFormat.value
    })

    if (!result.success) {
      throw new Error(result.error || '转换失败')
    }

    const downloadUrl = api.getDownloadUrl(result.fileId, result.safeName)
    
    // 触发下载
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = result.safeName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    resultUrl.value = downloadUrl
    resultFileName.value = result.safeName
    
    message.success('处理完成并已启动下载！')
    
    // 刷新历史记录
    if (showHistory.value) {
      loadHistory()
    }
  } catch (error: any) {
    message.error(error.message || '处理过程中出现错误')
  } finally {
    processing.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const result = await api.getHistory({
      page: historyPagination.value.current,
      pageSize: historyPagination.value.pageSize
    })
    
    historyData.value = result.items
    historyPagination.value.total = result.total
  } catch (error: any) {
    message.error('加载历史记录失败: ' + error.message)
  } finally {
    historyLoading.value = false
  }
}

function handleHistoryTableChange(pagination: any) {
  historyPagination.value.current = pagination.current
  historyPagination.value.pageSize = pagination.pageSize
  loadHistory()
}

async function handleDeleteHistory(id: string) {
  try {
    await api.deleteHistory(id)
    message.success('删除成功')
    loadHistory()
  } catch (error: any) {
    message.error('删除失败: ' + error.message)
  }
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    pending: 'default',
    processing: 'processing',
    success: 'success',
    failed: 'error'
  }
  return colors[status] || 'default'
}

function getStatusText(status: string) {
  const texts: Record<string, string> = {
    pending: '等待中',
    processing: '处理中',
    success: '成功',
    failed: '失败'
  }
  return texts[status] || status
}
</script>

<style scoped>
.file-tools { padding: 24px; }
.tool-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.tool-title { font-size: 18px; font-weight: bold; }
.tool-body { display: flex; flex-direction: column; gap: 16px; }
.actions { display: flex; gap: 12px; }
.tool-grid :deep(.ant-card) {
  height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}
</style>
