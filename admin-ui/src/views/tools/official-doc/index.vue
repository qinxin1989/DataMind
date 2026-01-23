<template>
  <div class="official-writing-page">
    <a-card title="公文写作助手">
      <div class="writing-container">
        <div class="writing-sidebar">
          <a-menu v-model:selectedKeys="activeTemplate" mode="inline">
            <a-menu-item key="report">工作报告</a-menu-item>
            <a-menu-item key="notice">通知公告</a-menu-item>
            <a-menu-item key="summary">会议纪要</a-menu-item>
            <a-menu-item key="plan">计划方案</a-menu-item>
          </a-menu>
        </div>
        
        <div class="writing-main">
          <div class="input-area">
            <a-form layout="vertical">
              <a-form-item label="核心要点">
                <a-textarea v-model:value="points" :rows="6" placeholder="请输入需要包含的核心内容要点..." />
              </a-form-item>
              <a-form-item label="文风选择">
                <a-radio-group v-model:value="style">
                  <a-radio value="formal">严谨正式</a-radio>
                  <a-radio value="concise">简明扼要</a-radio>
                  <a-radio value="enthusiastic">热情洋溢</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-button type="primary" :loading="generating" @click="generateDoc">开始创作</a-button>
            </a-form>
          </div>
          
          <div v-if="result" class="result-area" style="margin-top: 24px;">
            <a-divider>创作结果</a-divider>
            <div class="result-content">{{ result }}</div>
            <div class="result-actions" style="margin-top: 12px;">
              <a-button @click="copyResult">复制全文</a-button>
              <a-button type="link">下载 Word 格式</a-button>
            </div>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'

// SQL 格式化库
import { format } from 'sql-formatter'

const activeTemplate = ref(['report'])
const points = ref('')
const style = ref('formal')
const generating = ref(false)
const result = ref('')

function generateDoc() {
  if (!points.value) return message.warning('请输入核心要点')
  generating.value = true
  
  // 模拟深度写作逻辑
  setTimeout(() => {
    const date = new Date().toLocaleDateString()
    let content = ''
    if (activeTemplate.value[0] === 'report') {
      content = `【工作报告】\n日期：${date}\n\n一、核心进展\n${points.value}\n\n二、存在问题及建议\n针对上述内容，建议加强跨部门协作...\n\n三、下一步计划\n继续跟踪重点指标，确保目标达成。`
    } else if (activeTemplate.value[0] === 'notice') {
      content = `【通知公告】\n\n各部门：\n    关于${points.value}的通知要求如下...\n\n特此通知。\n\n管理委员会\n${date}`
    } else {
      content = `【会议纪要】\n时间：${date}\n主题：关于${points.value}的讨论\n\n主要共识：\n1. 明确了...`
    }
    
    result.value = content
    generating.value = false
    message.success('公文创作完成')
  }, 1000)
}

function copyResult() {
  navigator.clipboard.writeText(result.value).then(() => message.success('已复制到剪贴板'))
}
</script>

<style scoped>
.official-writing-page { padding: 24px; }
.writing-container { display: flex; gap: 24px; }
.writing-sidebar { width: 200px; border-right: 1px solid #f0f0f0; }
.writing-main { flex: 1; padding-left: 12px; }
.result-content { 
  white-space: pre-wrap; 
  padding: 16px; 
  background: #f9f9f9; 
  border-radius: 4px; 
  border: 1px solid #eee;
}
</style>
