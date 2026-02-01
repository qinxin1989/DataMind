<template>
  <div class="official-doc-page">
    <a-card title="公文写作助手">
      <div class="doc-container">
        <!-- 左侧模板选择 -->
        <div class="doc-sidebar">
          <a-menu v-model:selectedKeys="selectedType" mode="inline">
            <a-menu-item key="report">
              <FileTextOutlined />
              工作报告
            </a-menu-item>
            <a-menu-item key="notice">
              <NotificationOutlined />
              通知公告
            </a-menu-item>
            <a-menu-item key="summary">
              <FileOutlined />
              会议纪要
            </a-menu-item>
            <a-menu-item key="plan">
              <ProjectOutlined />
              计划方案
            </a-menu-item>
          </a-menu>

          <a-divider />

          <!-- 自定义模板 -->
          <div class="custom-templates">
            <div class="template-header">
              <span>我的模板</span>
              <a-button type="link" size="small" @click="showTemplateModal = true">
                <PlusOutlined />
              </a-button>
            </div>
            <a-list
              :data-source="templates"
              :loading="loadingTemplates"
              size="small"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta :title="item.name" :description="item.description" />
                  <template #actions>
                    <a-button type="link" size="small" @click="useTemplate(item)">使用</a-button>
                  </template>
                </a-list-item>
              </template>
            </a-list>
          </div>
        </div>

        <!-- 右侧主内容区 -->
        <div class="doc-main">
          <a-form layout="vertical">
            <a-form-item label="核心要点">
              <a-textarea
                v-model:value="points"
                :rows="8"
                placeholder="请输入需要包含的核心内容要点..."
                :maxlength="5000"
                show-count
              />
            </a-form-item>

            <a-form-item label="文风选择">
              <a-radio-group v-model:value="style">
                <a-radio value="formal">严谨正式</a-radio>
                <a-radio value="concise">简明扼要</a-radio>
                <a-radio value="enthusiastic">热情洋溢</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item>
              <a-space>
                <a-button
                  type="primary"
                  :loading="generating"
                  @click="handleGenerate"
                >
                  <ThunderboltOutlined />
                  开始创作
                </a-button>
                <a-button @click="handleReset">重置</a-button>
                <a-button @click="showHistory = true">历史记录</a-button>
              </a-space>
            </a-form-item>
          </a-form>

          <!-- 生成结果 -->
          <div v-if="result" class="result-area">
            <a-divider>创作结果</a-divider>
            <div class="result-content">{{ result }}</div>
            <div class="result-actions">
              <a-space>
                <a-button @click="handleCopy">
                  <CopyOutlined />
                  复制全文
                </a-button>
                <a-button @click="handleSaveAsTemplate">
                  <SaveOutlined />
                  保存为模板
                </a-button>
              </a-space>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 模板创建/编辑弹窗 -->
    <a-modal
      v-model:visible="showTemplateModal"
      title="创建模板"
      @ok="handleSaveTemplate"
      @cancel="showTemplateModal = false"
    >
      <a-form layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="templateForm.name" placeholder="请输入模板名称" />
        </a-form-item>
        <a-form-item label="模板类型" required>
          <a-select v-model:value="templateForm.type">
            <a-select-option value="report">工作报告</a-select-option>
            <a-select-option value="notice">通知公告</a-select-option>
            <a-select-option value="summary">会议纪要</a-select-option>
            <a-select-option value="plan">计划方案</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模板内容" required>
          <a-textarea
            v-model:value="templateForm.content"
            :rows="6"
            placeholder="请输入模板内容，使用 {{points}} 表示要点位置"
          />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="templateForm.description" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 历史记录抽屉 -->
    <a-drawer
      v-model:visible="showHistory"
      title="历史记录"
      width="600"
      placement="right"
    >
      <a-list
        :data-source="historyList"
        :loading="loadingHistory"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #title>
                <a-space>
                  <span>{{ getTypeName(item.type) }}</span>
                  <a-tag :color="getStatusColor(item.status)">
                    {{ getStatusText(item.status) }}
                  </a-tag>
                </a-space>
              </template>
              <template #description>
                <div>{{ formatDate(item.createdAt) }}</div>
                <div class="history-points">{{ item.points.substring(0, 50) }}...</div>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-button type="link" size="small" @click="viewHistory(item)">查看</a-button>
              <a-button type="link" size="small" danger @click="deleteHistoryItem(item.id)">删除</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  FileTextOutlined,
  NotificationOutlined,
  FileOutlined,
  ProjectOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  SaveOutlined
} from '@ant-design/icons-vue';
import * as api from '../api';
import type { DocType, DocStyle, OfficialDocTemplate, DocGenerationHistory } from '../../backend/types';

// 状态
const selectedType = ref<DocType[]>(['report']);
const points = ref('');
const style = ref<DocStyle>('formal');
const generating = ref(false);
const result = ref('');

// 模板相关
const templates = ref<OfficialDocTemplate[]>([]);
const loadingTemplates = ref(false);
const showTemplateModal = ref(false);
const templateForm = ref({
  name: '',
  type: 'report' as DocType,
  content: '',
  description: '',
  style: 'formal' as DocStyle,
  isPublic: false
});

// 历史记录
const showHistory = ref(false);
const historyList = ref<DocGenerationHistory[]>([]);
const loadingHistory = ref(false);

// 生成公文
async function handleGenerate() {
  if (!points.value.trim()) {
    message.warning('请输入核心要点');
    return;
  }

  generating.value = true;
  try {
    const response = await api.generateDoc({
      type: selectedType.value[0] as DocType,
      style: style.value,
      points: points.value
    });

    if (response.success && response.content) {
      result.value = response.content;
      message.success('公文创作完成');
    } else {
      message.error(response.error || '创作失败');
    }
  } catch (error: any) {
    message.error(error.message || '创作失败');
  } finally {
    generating.value = false;
  }
}

// 重置
function handleReset() {
  points.value = '';
  result.value = '';
}

// 复制结果
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(result.value);
    message.success('已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
}

// 保存为模板
function handleSaveAsTemplate() {
  templateForm.value = {
    name: '',
    type: selectedType.value[0] as DocType,
    content: result.value,
    description: '',
    style: style.value,
    isPublic: false
  };
  showTemplateModal.value = true;
}

// 保存模板
async function handleSaveTemplate() {
  if (!templateForm.value.name || !templateForm.value.content) {
    message.warning('请填写模板名称和内容');
    return;
  }

  try {
    await api.createTemplate(templateForm.value);
    message.success('模板保存成功');
    showTemplateModal.value = false;
    loadTemplates();
  } catch (error: any) {
    message.error(error.message || '保存失败');
  }
}

// 使用模板
function useTemplate(template: OfficialDocTemplate) {
  selectedType.value = [template.type];
  style.value = template.style;
  points.value = template.content;
}

// 加载模板
async function loadTemplates() {
  loadingTemplates.value = true;
  try {
    const response = await api.queryTemplates({
      page: 1,
      pageSize: 20
    });
    if (response.success) {
      templates.value = response.data.items;
    }
  } catch (error) {
    console.error('加载模板失败:', error);
  } finally {
    loadingTemplates.value = false;
  }
}

// 加载历史
async function loadHistory() {
  loadingHistory.value = true;
  try {
    const response = await api.getHistory({
      userId: '', // 会在后端自动获取
      page: 1,
      pageSize: 20
    });
    if (response.success) {
      historyList.value = response.data.items;
    }
  } catch (error) {
    console.error('加载历史失败:', error);
  } finally {
    loadingHistory.value = false;
  }
}

// 查看历史
function viewHistory(item: DocGenerationHistory) {
  selectedType.value = [item.type];
  style.value = item.style;
  points.value = item.points;
  result.value = item.result;
  showHistory.value = false;
}

// 删除历史
async function deleteHistoryItem(id: string) {
  try {
    await api.deleteHistory(id);
    message.success('删除成功');
    loadHistory();
  } catch (error: any) {
    message.error(error.message || '删除失败');
  }
}

// 辅助函数
function getTypeName(type: DocType): string {
  const names: Record<DocType, string> = {
    report: '工作报告',
    notice: '通知公告',
    summary: '会议纪要',
    plan: '计划方案'
  };
  return names[type];
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    success: 'green',
    failed: 'red',
    processing: 'blue',
    pending: 'orange'
  };
  return colors[status] || 'default';
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    success: '成功',
    failed: '失败',
    processing: '处理中',
    pending: '等待中'
  };
  return texts[status] || status;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 初始化
onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.official-doc-page {
  padding: 24px;
}

.doc-container {
  display: flex;
  gap: 24px;
  min-height: 600px;
}

.doc-sidebar {
  width: 240px;
  border-right: 1px solid #f0f0f0;
  padding-right: 16px;
}

.doc-main {
  flex: 1;
  padding-left: 16px;
}

.custom-templates {
  margin-top: 16px;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.result-area {
  margin-top: 24px;
}

.result-content {
  white-space: pre-wrap;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #eee;
  min-height: 200px;
  line-height: 1.8;
}

.result-actions {
  margin-top: 12px;
}

.history-points {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
</style>
