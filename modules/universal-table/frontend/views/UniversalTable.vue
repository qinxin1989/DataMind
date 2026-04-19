<template>
  <div class="universal-table-page">
    <div class="page-header">
      <div>
        <h2>万表归一</h2>
        <p>先建标准表，再建项目，文件跟着项目走；采集后的结构化结果自动入库，后续可直接挂 Agent 业务技能分析。</p>
      </div>
      <a-space>
        <a-select
          v-model:value="currentProjectId"
          style="width: 260px"
          placeholder="先选择项目"
          :options="projectOptions"
        />
        <a-button type="primary" @click="projectModalOpen = true">
          <template #icon><PlusOutlined /></template>
          新建项目
        </a-button>
      </a-space>
    </div>

    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="standards" tab="标准表">
        <div class="tab-toolbar">
          <a-space>
            <a-button type="primary" @click="openStandardModal()">
              <template #icon><PlusOutlined /></template>
              新建标准表
            </a-button>
            <a-button @click="importModalOpen = true">
              <template #icon><UploadOutlined /></template>
              批量识别表头
            </a-button>
          </a-space>
        </div>

        <a-table :data-source="standardTables" :pagination="false" row-key="id">
          <a-table-column title="名称" data-index="name" key="name" />
          <a-table-column title="分类" data-index="category" key="category" />
          <a-table-column key="columns" title="字段">
            <template #default="{ record }">
              <a-tag v-for="column in record.columns.slice(0, 6)" :key="column.title">{{ column.title }}</a-tag>
              <span v-if="record.columns.length > 6">+{{ record.columns.length - 6 }}</span>
            </template>
          </a-table-column>
          <a-table-column title="来源" data-index="source" key="source" />
          <a-table-column key="action" title="操作" width="180">
            <template #default="{ record }">
              <a-space>
                <a-button type="link" @click="openStandardModal(record)">编辑</a-button>
                <a-popconfirm title="确认删除这个标准表吗？" @confirm="handleDeleteStandardTable(record.id)">
                  <a-button type="link" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="project" tab="项目采集">
        <div class="tab-toolbar">
          <a-space>
            <a-button type="primary" :disabled="!currentProjectId" @click="submitProjectUpload" :loading="uploading">
              上传到项目
            </a-button>
            <a-button :disabled="!currentProjectId" @click="runClassification" :loading="classifying">
              自动分类
            </a-button>
            <a-button :disabled="!currentProjectId" @click="runPrepareSamples" :loading="sampling">
              按类生成样本
            </a-button>
          </a-space>
        </div>

        <a-upload-dragger
          v-model:fileList="projectUploadList"
          :before-upload="beforeProjectUpload"
          :multiple="true"
          :disabled="!currentProjectId"
        >
          <p class="ant-upload-drag-icon"><InboxOutlined /></p>
          <p class="ant-upload-text">{{ currentProjectId ? '拖入或选择待采集文件' : '先创建或选择项目' }}</p>
          <p class="ant-upload-hint">Excel、Word、PDF、TXT、CSV 均可先入项目，再分类处理。</p>
        </a-upload-dragger>

        <a-table :data-source="projectFiles" :pagination="false" row-key="id" class="project-table">
          <a-table-column title="文件" data-index="originalName" key="originalName" />
          <a-table-column key="headers" title="表头/摘要">
            <template #default="{ record }">
              <span>{{ record.headers.length ? record.headers.join(' / ') : '非结构化文档' }}</span>
            </template>
          </a-table-column>
          <a-table-column key="standardTable" title="分类">
            <template #default="{ record }">
              <a-select
                :value="record.standardTableId || undefined"
                allow-clear
                style="width: 220px"
                placeholder="选择标准表"
                :options="standardTableOptions"
                @change="(value) => handleAssignmentChange(record.id, value)"
              />
            </template>
          </a-table-column>
          <a-table-column key="status" title="状态">
            <template #default="{ record }">
              <div>分类: <a-tag>{{ record.classificationStatus }}</a-tag></div>
              <div>脱敏: <a-tag>{{ record.maskStatus }}</a-tag></div>
              <div>测试: <a-tag>{{ record.testStatus }}</a-tag></div>
            </template>
          </a-table-column>
          <a-table-column key="action" title="处理">
            <template #default="{ record }">
              <a-space wrap>
                <a-button size="small" @click="runMask(record.id)">脱敏</a-button>
                <a-button size="small" @click="runTest(record.id)">测试数据</a-button>
                <a-button size="small" type="link" :disabled="!record.maskedPath" @click="downloadFile(record, 'masked')">下载脱敏</a-button>
                <a-button size="small" type="link" :disabled="!record.testPath" @click="downloadFile(record, 'test')">下载测试</a-button>
              </a-space>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="scripts" tab="脚本与映射">
        <div class="script-panel">
          <a-card size="small" title="生成采集脚本">
            <a-form layout="vertical">
              <a-form-item label="样本文件">
                <a-select v-model:value="scriptForm.sampleFileId" :options="sampleFileOptions" placeholder="选择样本文件" />
              </a-form-item>
              <a-form-item label="样本来源">
                <a-radio-group v-model:value="scriptForm.sampleSource">
                  <a-radio-button value="masked">脱敏文件</a-radio-button>
                  <a-radio-button value="test">测试文件</a-radio-button>
                  <a-radio-button value="original">原文件</a-radio-button>
                </a-radio-group>
              </a-form-item>
              <a-form-item>
                <a-checkbox v-model:checked="scriptForm.useAi">用模型补充映射提示</a-checkbox>
              </a-form-item>
              <a-button type="primary" block :disabled="!currentProjectId || !scriptForm.sampleFileId" :loading="generatingScript" @click="handleGenerateScript">
                生成 Python 采集脚本
              </a-button>
            </a-form>
          </a-card>

          <a-card size="small" title="脚本列表">
            <a-table :data-source="scripts" :pagination="false" row-key="id" size="small">
              <a-table-column title="脚本" data-index="name" key="name" />
              <a-table-column title="来源" data-index="sampleSource" key="sampleSource" />
              <a-table-column title="格式" data-index="sourceFormat" key="sourceFormat" />
              <a-table-column key="action" title="操作">
                <template #default="{ record }">
                  <a-space>
                    <a-button type="link" @click="previewScript(record.id)">查看</a-button>
                    <a-button type="link" @click="executeScript(record.id)">运行</a-button>
                  </a-space>
                </template>
              </a-table-column>
            </a-table>
          </a-card>
        </div>

        <a-card size="small" title="分析数据集" class="result-card">
          <a-table :data-source="datasets" :pagination="false" row-key="id" size="small">
            <a-table-column title="标准表" data-index="standardTableName" key="standardTableName" />
            <a-table-column title="分析表" data-index="analysisTableName" key="analysisTableName" />
            <a-table-column title="数据源" data-index="datasourceName" key="datasourceName" />
            <a-table-column title="已入库行数" data-index="rowCount" key="rowCount" width="120" />
            <a-table-column key="datasetAction" title="操作" width="240">
              <template #default="{ record }">
                <a-space>
                  <a-button type="link" size="small" @click="copyText(record.datasourceId)">复制数据源ID</a-button>
                  <a-typography-text code>{{ record.datasourceId }}</a-typography-text>
                </a-space>
              </template>
            </a-table-column>
          </a-table>
        </a-card>

        <a-card size="small" title="采集结果" class="result-card">
          <a-table :data-source="results" :pagination="false" row-key="id" size="small">
            <a-table-column title="结果ID" data-index="id" key="id" />
            <a-table-column title="状态" data-index="mappingStatus" key="mappingStatus" />
            <a-table-column title="入库" key="dataset">
              <template #default="{ record }">
                <div>{{ record.ingestedRowCount || 0 }} 行</div>
                <a-typography-text v-if="record.analysisTableName" code>{{ record.analysisTableName }}</a-typography-text>
              </template>
            </a-table-column>
            <a-table-column key="headers" title="输出表头">
              <template #default="{ record }">
                <a-tag v-for="header in record.outputHeaders.slice(0, 5)" :key="header">{{ header }}</a-tag>
                <span v-if="record.outputHeaders.length > 5">+{{ record.outputHeaders.length - 5 }}</span>
              </template>
            </a-table-column>
            <a-table-column key="action" title="操作">
              <template #default="{ record }">
                <a-space>
                  <a-button type="link" @click="previewRows(record.previewRows)">预览</a-button>
                  <a-button v-if="record.manualConfirmationRequired" type="link" @click="openMappingModal(record)">确认映射</a-button>
                </a-space>
              </template>
            </a-table-column>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model:open="projectModalOpen" title="新建项目" @ok="handleCreateProject" :confirm-loading="projectSaving">
      <a-form layout="vertical">
        <a-form-item label="项目名称">
          <a-input v-model:value="projectForm.name" />
        </a-form-item>
        <a-form-item label="项目说明">
          <a-textarea v-model:value="projectForm.description" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="standardModalOpen" :title="editingStandard?.id ? '编辑标准表' : '新建标准表'" @ok="handleSaveStandardTable" :confirm-loading="standardSaving" width="720px">
      <a-form layout="vertical">
        <a-form-item label="标准表名称">
          <a-input v-model:value="standardForm.name" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select v-model:value="standardForm.category" :options="categoryOptions" />
        </a-form-item>
        <a-form-item label="字段定义">
          <a-textarea v-model:value="standardForm.columnsText" :rows="8" placeholder="每行一个字段，格式：字段名|type" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="importModalOpen" title="批量识别表头" width="900px" :footer="null">
      <a-space direction="vertical" style="width: 100%">
        <a-radio-group v-model:value="importMode">
          <a-radio-button value="rule">规则识别</a-radio-button>
          <a-radio-button value="ai">AI 批量识别</a-radio-button>
        </a-radio-group>
        <a-upload-dragger v-model:fileList="importFileList" :before-upload="beforeImportUpload" :multiple="true">
          <p class="ant-upload-drag-icon"><InboxOutlined /></p>
          <p class="ant-upload-text">拖入用于建标准表的样本文件</p>
        </a-upload-dragger>
        <a-button type="primary" :loading="importing" @click="handleImportDrafts">开始识别</a-button>
        <a-table :data-source="importDrafts" :pagination="false" row-key="name" size="small">
          <a-table-column title="建议标准表" data-index="name" key="name" />
          <a-table-column title="分类" data-index="category" key="category" />
          <a-table-column key="columns" title="字段">
            <template #default="{ record }">
              <a-tag v-for="column in record.columns" :key="column.title">{{ column.title }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column key="action" title="操作">
            <template #default="{ record }">
              <a-button type="link" @click="saveDraft(record)">保存</a-button>
            </template>
          </a-table-column>
        </a-table>
      </a-space>
    </a-modal>

    <a-modal v-model:open="scriptPreviewOpen" title="脚本预览" width="960px" :footer="null">
      <pre class="script-preview">{{ scriptPreview }}</pre>
    </a-modal>

    <a-modal v-model:open="rowsPreviewOpen" title="结果预览" width="900px" :footer="null">
      <pre class="script-preview">{{ JSON.stringify(previewRowsData, null, 2) }}</pre>
    </a-modal>

    <a-modal v-model:open="mappingModalOpen" title="确认表头映射" @ok="submitMapping" :confirm-loading="mappingSaving">
      <a-form layout="vertical">
        <a-form-item v-for="header in mappingHeaders" :key="header" :label="header">
          <a-select v-model:value="mappingDraft[header]" :options="mappingFieldOptions" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import { InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons-vue';
import * as api from '../api';

const activeTab = ref('standards');
const currentProjectId = ref<string>();
const standardTables = ref<api.StandardTable[]>([]);
const projects = ref<api.ProjectRecord[]>([]);
const projectFiles = ref<api.ProjectFileRecord[]>([]);
const scripts = ref<api.CollectionScriptRecord[]>([]);
const results = ref<api.CollectionResultRecord[]>([]);
const datasets = ref<api.AnalysisDatasetRecord[]>([]);
const categories = ref<any[]>([]);

const projectUploadList = ref<any[]>([]);
const importFileList = ref<any[]>([]);
const importDrafts = ref<any[]>([]);

const projectModalOpen = ref(false);
const standardModalOpen = ref(false);
const importModalOpen = ref(false);
const scriptPreviewOpen = ref(false);
const rowsPreviewOpen = ref(false);
const mappingModalOpen = ref(false);

const projectSaving = ref(false);
const standardSaving = ref(false);
const uploading = ref(false);
const classifying = ref(false);
const sampling = ref(false);
const importing = ref(false);
const generatingScript = ref(false);
const mappingSaving = ref(false);

const importMode = ref<'rule' | 'ai'>('ai');
const scriptPreview = ref('');
const previewRowsData = ref<any[]>([]);
const mappingHeaders = ref<string[]>([]);
const currentMappingResultId = ref<string>();

const projectForm = reactive({ name: '', description: '' });
const editingStandard = ref<api.StandardTable | null>(null);
const standardForm = reactive({ name: '', category: '其他', columnsText: '' });
const scriptForm = reactive<{ sampleFileId?: string; sampleSource: 'masked' | 'test' | 'original'; useAi: boolean }>({
  sampleFileId: undefined,
  sampleSource: 'masked',
  useAi: true,
});
const mappingDraft = reactive<Record<string, string | undefined>>({});

const projectOptions = computed(() => projects.value.map((item) => ({ label: item.name, value: item.id })));
const categoryOptions = computed(() => categories.value.map((item: any) => ({ label: item.name || item, value: item.name || item })));
const standardTableOptions = computed(() => standardTables.value.map((item) => ({ label: item.name, value: item.id })));
const sampleFileOptions = computed(() => projectFiles.value.map((item) => ({ label: item.originalName, value: item.id })));
const mappingFieldOptions = computed(() => standardTables.value.flatMap((table) => table.columns.map((column) => ({ label: `${table.name} / ${column.title}`, value: column.title }))));

async function loadBaseData() {
  const [categoryResp, standardResp, projectResp] = await Promise.all([
    api.getCategories(),
    api.getStandardTables(),
    api.getProjects(),
  ]);
  categories.value = categoryResp.data || [];
  standardTables.value = standardResp.data || [];
  projects.value = projectResp.data || [];
  if (!currentProjectId.value && projects.value.length > 0) {
    currentProjectId.value = projects.value[0].id;
  }
}

async function loadProjectData() {
  if (!currentProjectId.value) {
    projectFiles.value = [];
    scripts.value = [];
    results.value = [];
    datasets.value = [];
    return;
  }
  const [filesResp, scriptsResp, resultsResp, datasetsResp] = await Promise.all([
    api.getProjectFiles(currentProjectId.value),
    api.getScripts(currentProjectId.value),
    api.getResults(currentProjectId.value),
    api.getDatasets(currentProjectId.value),
  ]);
  projectFiles.value = filesResp.data || [];
  scripts.value = scriptsResp.data || [];
  results.value = resultsResp.data || [];
  datasets.value = datasetsResp.data || [];
}

onMounted(async () => {
  await loadBaseData();
  await loadProjectData();
});

watch(currentProjectId, async () => {
  await loadProjectData();
});

const beforeProjectUpload: UploadProps['beforeUpload'] = (file) => {
  projectUploadList.value = [...projectUploadList.value, file];
  return false;
};

const beforeImportUpload: UploadProps['beforeUpload'] = (file) => {
  importFileList.value = [...importFileList.value, file];
  return false;
};

function resetStandardForm() {
  editingStandard.value = null;
  standardForm.name = '';
  standardForm.category = '其他';
  standardForm.columnsText = '';
}

function openStandardModal(record?: api.StandardTable) {
  if (!record) {
    resetStandardForm();
  } else {
    editingStandard.value = record;
    standardForm.name = record.name;
    standardForm.category = record.category;
    standardForm.columnsText = record.columns.map((column) => `${column.title}|${column.type || 'string'}`).join('\n');
  }
  standardModalOpen.value = true;
}

function parseColumnsText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, type] = line.split('|').map((item) => item.trim());
      return {
        key: `field_${index + 1}`,
        title,
        type: (type as any) || 'string',
      };
    });
}

async function handleSaveStandardTable() {
  if (!standardForm.name.trim()) {
    return message.warning('请输入标准表名称');
  }
  const columns = parseColumnsText(standardForm.columnsText);
  if (columns.length === 0) {
    return message.warning('至少需要一个字段');
  }
  standardSaving.value = true;
  try {
    await api.saveStandardTable({
      id: editingStandard.value?.id,
      name: standardForm.name,
      category: standardForm.category,
      columns,
    });
    message.success('标准表已保存');
    standardModalOpen.value = false;
    await loadBaseData();
  } finally {
    standardSaving.value = false;
  }
}

async function handleDeleteStandardTable(id: string) {
  await api.deleteStandardTable(id);
  message.success('标准表已删除');
  await loadBaseData();
}

async function handleCreateProject() {
  if (!projectForm.name.trim()) {
    return message.warning('请输入项目名称');
  }
  projectSaving.value = true;
  try {
    const response = await api.createProject(projectForm);
    message.success('项目已创建');
    projectModalOpen.value = false;
    projectForm.name = '';
    projectForm.description = '';
    await loadBaseData();
    currentProjectId.value = response.data?.id;
  } finally {
    projectSaving.value = false;
  }
}

async function submitProjectUpload() {
  if (!currentProjectId.value || projectUploadList.value.length === 0) {
    return message.warning('先选择项目并添加文件');
  }
  uploading.value = true;
  try {
    const files = projectUploadList.value.map((item) => item.originFileObj || item);
    await api.uploadProjectFiles(currentProjectId.value, files);
    projectUploadList.value = [];
    message.success('文件已进入项目');
    await loadProjectData();
  } finally {
    uploading.value = false;
  }
}

async function runClassification() {
  if (!currentProjectId.value) return;
  classifying.value = true;
  try {
    await api.classifyProjectFiles(currentProjectId.value, 'ai');
    message.success('分类已完成');
    await loadProjectData();
  } finally {
    classifying.value = false;
  }
}

async function runPrepareSamples() {
  if (!currentProjectId.value) return;
  sampling.value = true;
  try {
    await api.prepareGroupSamples(currentProjectId.value);
    message.success('每类样本已生成');
    await loadProjectData();
  } finally {
    sampling.value = false;
  }
}

async function handleAssignmentChange(fileId: string, value: string | undefined) {
  await api.assignProjectFile(fileId, value || null);
  await loadProjectData();
}

async function runMask(fileId: string) {
  await api.maskFile(fileId, 'ai');
  message.success('脱敏文件已生成');
  await loadProjectData();
}

async function runTest(fileId: string) {
  await api.generateTestData(fileId, 'ai');
  message.success('测试数据已生成');
  await loadProjectData();
}

async function downloadFile(file: api.ProjectFileRecord, kind: 'masked' | 'test') {
  const blob: any = await api.downloadArtifact(file.id, kind);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = formatArtifactName(file.originalName, kind);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatArtifactName(originalName: string, kind: 'masked' | 'test') {
  const dotIndex = originalName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${originalName}_${kind}`;
  }
  const baseName = originalName.slice(0, dotIndex);
  const ext = originalName.slice(dotIndex);
  return `${baseName}_${kind}${ext}`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  message.success('已复制');
}

async function handleImportDrafts() {
  if (importFileList.value.length === 0) {
    return message.warning('先添加样本文件');
  }
  importing.value = true;
  try {
    const files = importFileList.value.map((item) => item.originFileObj || item);
    const response = await api.importStandardTableDrafts(files, importMode.value);
    importDrafts.value = response.data || [];
    message.success('识别完成');
  } finally {
    importing.value = false;
  }
}

async function saveDraft(draft: any) {
  await api.saveStandardTable(draft);
  message.success('草稿已保存为标准表');
  await loadBaseData();
}

async function handleGenerateScript() {
  if (!currentProjectId.value || !scriptForm.sampleFileId) {
    return message.warning('先选择样本文件');
  }
  generatingScript.value = true;
  try {
    await api.generateScript({
      projectId: currentProjectId.value,
      sampleFileId: scriptForm.sampleFileId,
      sampleSource: scriptForm.sampleSource,
      useAi: scriptForm.useAi,
    });
    message.success('脚本已生成');
    await loadProjectData();
  } finally {
    generatingScript.value = false;
  }
}

async function previewScript(scriptId: string) {
  const response = await api.getScript(scriptId);
  scriptPreview.value = response.data?.scriptBody || '';
  scriptPreviewOpen.value = true;
}

async function executeScript(scriptId: string) {
  await api.runScript(scriptId);
  message.success('采集脚本已执行');
  await loadProjectData();
}

function previewRows(rows: any[]) {
  previewRowsData.value = rows;
  rowsPreviewOpen.value = true;
}

function openMappingModal(result: api.CollectionResultRecord) {
  currentMappingResultId.value = result.id;
  mappingHeaders.value = result.outputHeaders || [];
  Object.keys(mappingDraft).forEach((key) => delete mappingDraft[key]);
  Object.assign(mappingDraft, result.mapping || {});
  mappingModalOpen.value = true;
}

async function submitMapping() {
  if (!currentMappingResultId.value) return;
  mappingSaving.value = true;
  try {
    const payload = mappingHeaders.value.reduce<Record<string, string>>((acc, header) => {
      if (mappingDraft[header]) {
        acc[header] = mappingDraft[header]!;
      }
      return acc;
    }, {});
    await api.confirmMapping(currentMappingResultId.value, payload);
    message.success('映射已确认');
    mappingModalOpen.value = false;
    await loadProjectData();
  } finally {
    mappingSaving.value = false;
  }
}
</script>

<style scoped>
.universal-table-page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 8px;
}

.page-header p {
  margin: 0;
  color: #666;
}

.tab-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.project-table {
  margin-top: 16px;
}

.script-panel {
  display: grid;
  grid-template-columns: minmax(280px, 320px) 1fr;
  gap: 16px;
}

.result-card {
  margin-top: 16px;
}

.script-preview {
  max-height: 70vh;
  overflow: auto;
  padding: 12px;
  background: #111827;
  color: #e5e7eb;
  border-radius: 6px;
}

@media (max-width: 1100px) {
  .page-header,
  .script-panel {
    grid-template-columns: 1fr;
    display: block;
  }
}
</style>
