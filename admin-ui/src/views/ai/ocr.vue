<template>
  <div class="ocr-page">
    <div class="page-header">
      <h1>OCR 图片识别</h1>
      <p>支持图片文字识别，可识别中英文混合内容</p>
    </div>

    <a-row :gutter="16">
      <!-- 左侧：上传区域 -->
      <a-col :span="12">
        <a-card title="上传图片" :bordered="false">
          <a-upload-dragger
            v-model:fileList="fileList"
            name="file"
            :multiple="false"
            :before-upload="beforeUpload"
            :show-upload-list="false"
            accept="image/*"
            @change="handleFileChange"
          >
            <p class="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p class="ant-upload-text">点击或拖拽图片到此区域上传</p>
            <p class="ant-upload-hint">
              支持 JPG、PNG、BMP 等常见图片格式
            </p>
          </a-upload-dragger>

          <div v-if="previewImage" class="preview-section">
            <a-divider>预览图片</a-divider>
            <div class="image-preview">
              <img :src="previewImage" alt="预览" />
            </div>
            <a-space style="margin-top: 16px; width: 100%;" direction="vertical">
              <a-button 
                type="primary" 
                block 
                :loading="recognizing"
                @click="handleRecognize"
              >
                <template #icon><EyeOutlined /></template>
                开始识别
              </a-button>
              <a-button block @click="handleClear">
                <template #icon><DeleteOutlined /></template>
                清除
              </a-button>
            </a-space>
          </div>
        </a-card>
      </a-col>

      <!-- 右侧：识别结果 -->
      <a-col :span="12">
        <a-card title="识别结果" :bordered="false">
          <a-spin :spinning="recognizing" tip="正在识别中...">
            <div v-if="!result && !recognizing" class="empty-result">
              <a-empty description="暂无识别结果" />
            </div>

            <div v-else-if="result" class="result-section">
              <a-space direction="vertical" style="width: 100%;" :size="16">
                <!-- 统计信息 -->
                <a-alert
                  :message="`识别成功，共识别 ${result.count || 0} 行文本`"
                  type="success"
                  show-icon
                />

                <!-- 识别文本 -->
                <div class="result-text">
                  <div class="result-header">
                    <span>识别文本</span>
                    <a-space>
                      <a-button size="small" @click="handleCopy">
                        <template #icon><CopyOutlined /></template>
                        复制
                      </a-button>
                      <a-button size="small" @click="handleDownload">
                        <template #icon><DownloadOutlined /></template>
                        下载
                      </a-button>
                    </a-space>
                  </div>
                  <a-textarea
                    v-model:value="result.text"
                    :rows="15"
                    readonly
                    placeholder="识别结果将显示在这里"
                  />
                </div>

                <!-- 逐行显示 -->
                <div v-if="result.lines && result.lines.length > 0" class="result-lines">
                  <a-divider>逐行文本</a-divider>
                  <a-list
                    size="small"
                    :data-source="result.lines"
                    :pagination="{ pageSize: 10 }"
                  >
                    <template #renderItem="{ item, index }">
                      <a-list-item>
                        <span class="line-number">{{ index + 1 }}.</span>
                        <span class="line-text">{{ item }}</span>
                      </a-list-item>
                    </template>
                  </a-list>
                </div>
              </a-space>
            </div>
          </a-spin>
        </a-card>
      </a-col>
    </a-row>

    <!-- 历史记录 -->
    <a-card title="识别历史" :bordered="false" style="margin-top: 16px;">
      <a-table
        :columns="historyColumns"
        :data-source="history"
        :pagination="{ pageSize: 5 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'preview'">
            <img :src="record.image" class="history-thumbnail" />
          </template>
          <template v-else-if="column.key === 'time'">
            {{ formatTime(record.time) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="handleViewHistory(record)">
                查看
              </a-button>
              <a-button type="link" size="small" danger @click="handleDeleteHistory(record)">
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { 
  InboxOutlined, 
  EyeOutlined, 
  DeleteOutlined, 
  CopyOutlined, 
  DownloadOutlined 
} from '@ant-design/icons-vue'
import type { UploadProps } from 'ant-design-vue'

interface OCRResult {
  success: boolean
  text: string
  lines?: string[]
  count?: number
  error?: string
}

interface HistoryItem {
  id: string
  image: string
  text: string
  lines: string[]
  count: number
  time: number
}

const fileList = ref<any[]>([])
const previewImage = ref<string>('')
const recognizing = ref(false)
const result = ref<OCRResult | null>(null)
const history = ref<HistoryItem[]>([])

const historyColumns = [
  { title: '预览', key: 'preview', width: 100 },
  { title: '识别行数', dataIndex: 'count', width: 100 },
  { title: '识别时间', key: 'time', width: 180 },
  { title: '操作', key: 'action', width: 150 },
]

function beforeUpload(file: File) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件！')
    return false
  }
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('图片大小不能超过 10MB！')
    return false
  }
  return false // 阻止自动上传
}

function handleFileChange(info: any) {
  const file = info.file
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string
      result.value = null
    }
    reader.readAsDataURL(file)
  }
}

async function handleRecognize() {
  if (!previewImage.value) {
    message.warning('请先上传图片')
    return
  }

  recognizing.value = true
  try {
    // 获取token
    const token = localStorage.getItem('token')
    
    const response = await fetch('/api/ocr/recognize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        image: previewImage.value,
      }),
    })

    const data = await response.json()
    
    if (data.success) {
      result.value = data
      message.success('识别成功！')
      
      // 添加到历史记录
      history.value.unshift({
        id: Date.now().toString(),
        image: previewImage.value,
        text: data.text,
        lines: data.lines || [],
        count: data.count || 0,
        time: Date.now(),
      })
      
      // 只保留最近20条
      if (history.value.length > 20) {
        history.value = history.value.slice(0, 20)
      }
    } else {
      message.error(data.error || '识别失败')
    }
  } catch (error: any) {
    message.error('识别失败：' + error.message)
  } finally {
    recognizing.value = false
  }
}

function handleClear() {
  previewImage.value = ''
  result.value = null
  fileList.value = []
}

function handleCopy() {
  if (!result.value?.text) return
  
  navigator.clipboard.writeText(result.value.text).then(() => {
    message.success('已复制到剪贴板')
  }).catch(() => {
    message.error('复制失败')
  })
}

function handleDownload() {
  if (!result.value?.text) return
  
  const blob = new Blob([result.value.text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ocr_result_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  message.success('下载成功')
}

function handleViewHistory(record: HistoryItem) {
  previewImage.value = record.image
  result.value = {
    success: true,
    text: record.text,
    lines: record.lines,
    count: record.count,
  }
}

function handleDeleteHistory(record: HistoryItem) {
  const index = history.value.findIndex(item => item.id === record.id)
  if (index > -1) {
    history.value.splice(index, 1)
    message.success('已删除')
  }
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.ocr-page {
  padding: 4px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.page-header p {
  color: #666;
  margin: 0;
}

.preview-section {
  margin-top: 24px;
}

.image-preview {
  width: 100%;
  max-height: 400px;
  overflow: auto;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 8px;
  background: #fafafa;
  text-align: center;
}

.image-preview img {
  max-width: 100%;
  height: auto;
}

.empty-result {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-section {
  min-height: 300px;
}

.result-text {
  width: 100%;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 500;
}

.result-lines {
  margin-top: 16px;
}

.line-number {
  color: #999;
  margin-right: 8px;
  min-width: 30px;
  display: inline-block;
}

.line-text {
  flex: 1;
}

.history-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}
</style>
