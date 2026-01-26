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
              <p>Word/Excel/图片与PDF互转</p>
            </a-card>
          </a-col>
        </a-row>
      </div>
      
      <div v-else class="tool-content">
        <div class="tool-header">
          <a-button type="link" @click="selectedTool = null"><left-outlined /> 返回</a-button>
          <span class="tool-title">{{ selectedToolName }}</span>
        </div>
        
        <!-- 格式转换：添加目标格式选择 -->
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
        
        <!-- 其他工具保持原样 -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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
const resultFileName = ref('')

// 格式转换相关
const sourceFormat = ref('word')
const targetFormat = ref('pdf')

// 监听源格式变化，自动调整目标格式
watch(sourceFormat, (newVal) => {
  if (newVal === 'pdf') {
    targetFormat.value = 'txt'
  } else {
    targetFormat.value = 'pdf'
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
    const formData = new FormData()
    fileList.value.forEach(file => {
      formData.append('files', file.originFileObj || file)
    })
    formData.append('sourceFormat', sourceFormat.value)
    formData.append('targetFormat', targetFormat.value)

    const response = await fetch('/api/tools/file/convert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    })

    const data = await response.json()
    if (!data.success) throw new Error(data.error || '转换失败')

    // 重构 2.0：使用伪静态路径，将文件名直接作为 URL 的一部分
    // 这样即使 Header 失效，浏览器也会根据 URL 结尾识别出正确的文件名和扩展名
    const downloadUrl = `/api/tools/file/download/${data.fileId}/${encodeURIComponent(data.safeName)}?token=${localStorage.getItem('token')}`

    
    // 手动触发下载链接，确保浏览器识别
    const link = document.createElement('a')
    link.href = downloadUrl
    // 尽管后端有 Content-Disposition，前端设置 download 作为双保险
    link.download = data.safeName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 更新状态，允许手动下载
    resultUrl.value = downloadUrl
    resultFileName.value = data.safeName
    
    message.success('处理完成并已启动原生下载！')

  } catch (error: any) {
    message.error(error.message || '处理过程中出现错误')
  } finally {
    processing.value = false
  }
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
