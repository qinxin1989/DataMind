<template>
  <div class="data-processing">
    <a-card title="数据处理中心">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="clean" tab="数据清洗">
          <div class="tab-content">
            <a-form layout="vertical">
              <a-form-item label="数据源">
                <a-textarea v-model:value="cleanInput" :rows="8" placeholder="粘贴 JSON/CSV 数据或输入表格数据..." />
              </a-form-item>
              <a-form-item label="清洗规则">
                <a-checkbox-group v-model:value="cleanRules">
                  <a-checkbox value="trim">去除空白字符</a-checkbox>
                  <a-checkbox value="dedup">去除重复行</a-checkbox>
                  <a-checkbox value="null">清理空值</a-checkbox>
                  <a-checkbox value="format">格式标准化</a-checkbox>
                </a-checkbox-group>
              </a-form-item>
              <a-button type="primary" :loading="processing" @click="processClean">开始清洗</a-button>
            </a-form>
            
            <div v-if="cleanOutput" class="result-area">
              <a-divider>清洗结果</a-divider>
              <a-textarea :value="cleanOutput" :rows="8" readonly />
              <a-button style="margin-top: 8px;" @click="copyResult(cleanOutput)">复制结果</a-button>
            </div>
          </div>
        </a-tab-pane>
        
        <a-tab-pane key="convert" tab="格式转换">
          <div class="tab-content">
            <a-form layout="vertical">
              <a-form-item label="输入数据">
                <a-textarea v-model:value="convertInput" :rows="8" placeholder="粘贴 JSON 或 CSV 数据..." />
              </a-form-item>
              <a-form-item label="转换方向">
                <a-radio-group v-model:value="convertDirection">
                  <a-radio value="json2csv">JSON → CSV</a-radio>
                  <a-radio value="csv2json">CSV → JSON</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-button type="primary" :loading="processing" @click="processConvert">开始转换</a-button>
            </a-form>
            
            <div v-if="convertOutput" class="result-area">
              <a-divider>转换结果</a-divider>
              <a-textarea :value="convertOutput" :rows="8" readonly />
              <a-button style="margin-top: 8px;" @click="copyResult(convertOutput)">复制结果</a-button>
            </div>
          </div>
        </a-tab-pane>
        
        <a-tab-pane key="analyze" tab="智能分析">
          <div class="tab-content">
            <a-form layout="vertical">
              <a-form-item label="数据输入">
                <a-textarea v-model:value="analyzeInput" :rows="8" placeholder="粘贴表格数据（JSON 格式）进行分析..." />
              </a-form-item>
              <a-button type="primary" :loading="processing" @click="processAnalyze">开始分析</a-button>
            </a-form>
            
            <div v-if="analyzeResult" class="result-area">
              <a-divider>分析结果</a-divider>
              <a-descriptions :column="2" bordered>
                <a-descriptions-item label="记录数">{{ analyzeResult.count }}</a-descriptions-item>
                <a-descriptions-item label="字段数">{{ analyzeResult.fields }}</a-descriptions-item>
                <a-descriptions-item label="数值型字段">{{ analyzeResult.numericFields }}</a-descriptions-item>
                <a-descriptions-item label="文本型字段">{{ analyzeResult.textFields }}</a-descriptions-item>
              </a-descriptions>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'

const activeTab = ref('clean')
const processing = ref(false)

// 数据清洗
const cleanInput = ref('')
const cleanRules = ref<string[]>(['trim', 'null'])
const cleanOutput = ref('')

// 格式转换
const convertInput = ref('')
const convertDirection = ref('json2csv')
const convertOutput = ref('')

// 智能分析
const analyzeInput = ref('')
const analyzeResult = ref<any>(null)

function processClean() {
  if (!cleanInput.value) return message.warning('请输入数据')
  processing.value = true
  
  setTimeout(() => {
    let result = cleanInput.value
    if (cleanRules.value.includes('trim')) {
      result = result.split('\n').map(line => line.trim()).join('\n')
    }
    if (cleanRules.value.includes('dedup')) {
      result = [...new Set(result.split('\n'))].join('\n')
    }
    if (cleanRules.value.includes('null')) {
      result = result.split('\n').filter(line => line.length > 0).join('\n')
    }
    cleanOutput.value = result
    processing.value = false
    message.success('清洗完成')
  }, 500)
}

function processConvert() {
  if (!convertInput.value) return message.warning('请输入数据')
  processing.value = true
  
  setTimeout(() => {
    try {
      if (convertDirection.value === 'json2csv') {
        const data = JSON.parse(convertInput.value)
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0])
          const rows = data.map(item => headers.map(h => item[h]).join(','))
          convertOutput.value = [headers.join(','), ...rows].join('\n')
        }
      } else {
        const lines = convertInput.value.trim().split('\n')
        const headers = lines[0].split(',')
        const result = lines.slice(1).map(line => {
          const values = line.split(',')
          const obj: any = {}
          headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim())
          return obj
        })
        convertOutput.value = JSON.stringify(result, null, 2)
      }
      message.success('转换完成')
    } catch (e) {
      message.error('数据格式错误')
    }
    processing.value = false
  }, 500)
}

function processAnalyze() {
  if (!analyzeInput.value) return message.warning('请输入数据')
  processing.value = true
  
  setTimeout(() => {
    try {
      const data = JSON.parse(analyzeInput.value)
      if (Array.isArray(data) && data.length > 0) {
        const fields = Object.keys(data[0])
        const numericFields = fields.filter(f => typeof data[0][f] === 'number')
        analyzeResult.value = {
          count: data.length,
          fields: fields.length,
          numericFields: numericFields.length,
          textFields: fields.length - numericFields.length
        }
        message.success('分析完成')
      }
    } catch (e) {
      message.error('数据格式错误，请输入有效的 JSON 数组')
    }
    processing.value = false
  }, 500)
}

function copyResult(text: string) {
  navigator.clipboard.writeText(text).then(() => message.success('已复制'))
}
</script>

<style scoped>
.data-processing { padding: 24px; }
.tab-content { padding: 16px 0; }
.result-area { margin-top: 24px; }
</style>
