<template>
  <div class="efficiency-tools">
    <a-card title="效率工具箱">
      <div v-if="!selectedTool" class="tool-grid">
        <a-row :gutter="[16, 16]">
          <a-col :span="8">
            <a-card hoverable @click="handleToolClick('sql-formatter')">
              <template #title><code-outlined /> SQL 格式化</template>
              <p>一键美化并规范您的 SQL 语句</p>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card hoverable @click="handleToolClick('data-converter')">
              <template #title><swap-outlined /> 数据转换</template>
              <p>JSON/CSV/Excel 格式在线互转</p>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card hoverable @click="handleToolClick('regex-helper')">
              <template #title><security-scan-outlined /> 正则助手</template>
              <p>可视化编写与测试正则表达式</p>
            </a-card>
          </a-col>
        </a-row>
      </div>
      
      <div v-else class="tool-content">
        <div class="tool-header">
          <a-button type="link" @click="selectedTool = null"><left-outlined /> 返回</a-button>
          <span class="tool-title">{{ selectedToolName }}</span>
        </div>
        
        <div v-if="selectedTool === 'sql-formatter'" class="tool-body">
          <a-textarea v-model:value="inputValue" :rows="12" placeholder="粘贴您的 SQL 代码..." />
          <div class="actions">
            <a-button type="primary" @click="formatSql">立即美化</a-button>
            <a-button @click="inputValue = ''">清空数据</a-button>
          </div>
        </div>
        
        <div v-else class="tool-body">
          <a-empty :description="`${selectedToolName} 核心算法加载中...`" />
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { format } from 'sql-formatter'
import { 
  CodeOutlined, SwapOutlined, SecurityScanOutlined, LeftOutlined 
} from '@ant-design/icons-vue'

const selectedTool = ref<string | null>(null)
const selectedToolName = ref('')
const inputValue = ref('')

function handleToolClick(tool: string) {
  selectedTool.value = tool
  selectedToolName.value = tool === 'sql-formatter' ? 'SQL 格式化' : (tool === 'data-converter' ? '数据转换' : '正则助手')
  inputValue.value = ''
}

function formatSql() {
  if (!inputValue.value) return message.warning('请输入内容')
  try {
    inputValue.value = format(inputValue.value, { language: 'mysql' })
    message.success('SQL 美化成功')
  } catch (e: any) {
    message.error('解析失败: ' + e.message)
  }
}
</script>

<style scoped>
.efficiency-tools { padding: 24px; }
.tool-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.tool-title { font-size: 18px; font-weight: bold; }
.tool-body { display: flex; flex-direction: column; gap: 16px; }
.actions { display: flex; gap: 12px; margin-top: 8px; }
.tool-grid :deep(.ant-card) {
  height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}
</style>
