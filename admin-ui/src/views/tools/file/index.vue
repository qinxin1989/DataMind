<template>
  <div class="file-tools">
    <a-card title="文件工具箱">
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
              <p>Word/Excel/PDF 互相转换</p>
            </a-card>
          </a-col>
        </a-row>
      </div>
      
      <div v-else class="tool-content">
        <div class="tool-header">
          <a-button type="link" @click="selectedTool = null"><left-outlined /> 返回</a-button>
          <span class="tool-title">{{ selectedToolName }}</span>
        </div>
        
        <div class="tool-body">
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
              {{ selectedTool === 'pdf-merge' ? '合并文件' : (selectedTool === 'image-compress' ? '开始压缩' : '开始转换') }}
            </a-button>
            <a-button @click="fileList = []">清空列表</a-button>
          </div>
          
          <div v-if="resultUrl" class="result" style="margin-top: 16px;">
            <a-alert type="success" message="处理完成！" show-icon>
              <template #description>
                <a :href="resultUrl" download>点击下载结果文件</a>
              </template>
            </a-alert>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { 
  FilePdfOutlined, FileImageOutlined, SwapOutlined, 
  LeftOutlined, InboxOutlined 
} from '@ant-design/icons-vue'

const selectedTool = ref<string | null>(null)
const selectedToolName = ref('')
const fileList = ref<any[]>([])
const processing = ref(false)
const resultUrl = ref('')

function handleToolClick(tool: string) {
  selectedTool.value = tool
  selectedToolName.value = tool === 'pdf-merge' ? 'PDF 合并' : (tool === 'image-compress' ? '图片压缩' : '格式转换')
  fileList.value = []
  resultUrl.value = ''
}

const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  fileList.value = [...fileList.value, file]
  return false // 阻止自动上传
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
  
  processing.value = true
  
  // 模拟处理过程
  setTimeout(() => {
    processing.value = false
    resultUrl.value = '#'
    message.success('处理完成！（演示模式）')
  }, 2000)
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
