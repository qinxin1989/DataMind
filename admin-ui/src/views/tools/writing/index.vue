<template>
  <div class=\"official-writing-page\">
    <a-card title=\"公文写作助手\">
      <div class=\"writing-container\">
        <div class=\"writing-sidebar\">
          <a-menu v-model:selectedKeys=\"activeTemplate\" mode=\"inline\">
            <a-menu-item key=\"report\">工作报告</a-menu-item>
            <a-menu-item key=\"notice\">通知公告</a-menu-item>
            <a-menu-item key=\"summary\">会议纪要</a-menu-item>
            <a-menu-item key=\"plan\">计划方案</a-menu-item>
          </a-menu>
        </div>
        
        <div class=\"writing-main\">
          <div class=\"input-area\">
            <a-form layout=\"vertical\">
              <a-form-item label=\"核心要点\">
                <a-textarea v-model:value=\"points\" :rows=\"6\" placeholder=\"请输入需要包含的核心内容要点...\" />
              </a-form-item>
              <a-form-item label=\"文风选择\">
                <a-radio-group v-model:value=\"style\">
                  <a-radio value=\"formal\">严谨正式</a-radio>
                  <a-radio value=\"concise\">简明扼要</a-radio>
                  <a-radio value=\"enthusiastic\">热情洋溢</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-button type=\"primary\" :loading=\"generating\" @click=\"generateDoc\">开始创作</a-button>
            </a-form>
          </div>
          
          <div v-if=\"result\" class=\"result-area\" style=\"margin-top: 24px;\">
            <a-divider>创作结果</a-divider>
            <div class=\"result-content\">{{ result }}</div>
            <div class=\"result-actions\" style=\"margin-top: 12px;\">
              <a-button @click=\"copyResult\">复制全文</a-button>
              <a-button type=\"link\">下载 Word 格式</a-button>
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

const activeTemplate = ref(['report'])
const points = ref('')
const style = ref('formal')
const generating = ref(false)
const result = ref('')

function generateDoc() {
  if (!points.value) return message.warning('请输入核心要点')
  generating.value = true
  // 模拟生成过程
  setTimeout(() => {
    result.value = `关于【${points.value.substring(0, 10)}...】的专属公文草案\n\n一、背景介绍\n二、工作进展\n三、后续规划\n\n(AI 生成示范)...`
    generating.value = false
    message.success('创作完成')
  }, 1500)
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
