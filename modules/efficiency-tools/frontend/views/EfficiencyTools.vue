<template>
  <div class="efficiency-tools">
    <a-card title="效率工具箱">
      <!-- 工具选择网格 -->
      <div v-if="!selectedTool" class="tool-grid">
        <a-row :gutter="[16, 16]">
          <a-col :span="8">
            <a-card hoverable @click="selectTool('sql-formatter')">
              <template #title>
                <code-outlined /> SQL 格式化
              </template>
              <p>一键美化并规范您的 SQL 语句</p>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card hoverable @click="selectTool('data-converter')">
              <template #title>
                <swap-outlined /> 数据转换
              </template>
              <p>JSON/CSV/Excel 格式在线互转</p>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card hoverable @click="selectTool('regex-helper')">
              <template #title>
                <security-scan-outlined /> 正则助手
              </template>
              <p>可视化编写与测试正则表达式</p>
            </a-card>
          </a-col>
        </a-row>
      </div>

      <!-- 工具内容区 -->
      <div v-else class="tool-content">
        <div class="tool-header">
          <a-button type="link" @click="selectedTool = null">
            <left-outlined /> 返回
          </a-button>
          <span class="tool-title">{{ toolTitle }}</span>
        </div>

        <!-- SQL 格式化工具 -->
        <div v-if="selectedTool === 'sql-formatter'" class="tool-body">
          <a-row :gutter="16">
            <a-col :span="12">
              <div class="input-section">
                <div class="section-header">
                  <span>输入 SQL</span>
                  <a-space>
                    <a-select v-model:value="sqlLanguage" style="width: 120px">
                      <a-select-option value="mysql">MySQL</a-select-option>
                      <a-select-option value="postgresql">PostgreSQL</a-select-option>
                      <a-select-option value="sqlite">SQLite</a-select-option>
                      <a-select-option value="sql">标准 SQL</a-select-option>
                    </a-select>
                    <a-checkbox v-model:checked="sqlUppercase">大写关键字</a-checkbox>
                  </a-space>
                </div>
                <a-textarea
                  v-model:value="sqlInput"
                  :rows="16"
                  placeholder="粘贴您的 SQL 代码..."
                />
              </div>
            </a-col>
            <a-col :span="12">
              <div class="output-section">
                <div class="section-header">
                  <span>格式化结果</span>
                  <a-button size="small" @click="copySqlOutput">
                    <copy-outlined /> 复制
                  </a-button>
                </div>
                <a-textarea
                  v-model:value="sqlOutput"
                  :rows="16"
                  readonly
                  placeholder="格式化后的 SQL 将显示在这里..."
                />
              </div>
            </a-col>
          </a-row>
          <div class="actions">
            <a-button type="primary" :loading="loading" @click="handleFormatSql">
              <thunderbolt-outlined /> 立即格式化
            </a-button>
            <a-button @click="clearSql">清空</a-button>
          </div>
        </div>

        <!-- 数据转换工具 -->
        <div v-else-if="selectedTool === 'data-converter'" class="tool-body">
          <a-row :gutter="16">
            <a-col :span="12">
              <div class="input-section">
                <div class="section-header">
                  <span>输入数据</span>
                  <a-select v-model:value="sourceFormat" style="width: 120px">
                    <a-select-option value="json">JSON</a-select-option>
                    <a-select-option value="csv">CSV</a-select-option>
                    <a-select-option value="xml">XML</a-select-option>
                    <a-select-option value="yaml">YAML</a-select-option>
                  </a-select>
                </div>
                <a-textarea
                  v-model:value="dataInput"
                  :rows="16"
                  placeholder="粘贴您的数据..."
                />
              </div>
            </a-col>
            <a-col :span="12">
              <div class="output-section">
                <div class="section-header">
                  <span>转换结果</span>
                  <a-space>
                    <a-select v-model:value="targetFormat" style="width: 120px">
                      <a-select-option value="json">JSON</a-select-option>
                      <a-select-option value="csv">CSV</a-select-option>
                      <a-select-option value="excel">Excel</a-select-option>
                      <a-select-option value="xml">XML</a-select-option>
                      <a-select-option value="yaml">YAML</a-select-option>
                    </a-select>
                    <a-button size="small" @click="copyDataOutput">
                      <copy-outlined /> 复制
                    </a-button>
                  </a-space>
                </div>
                <a-textarea
                  v-model:value="dataOutput"
                  :rows="16"
                  readonly
                  placeholder="转换后的数据将显示在这里..."
                />
              </div>
            </a-col>
          </a-row>
          <div class="actions">
            <a-button type="primary" :loading="loading" @click="handleConvertData">
              <swap-outlined /> 立即转换
            </a-button>
            <a-button @click="clearData">清空</a-button>
            <a-checkbox v-model:checked="prettyOutput">美化输出</a-checkbox>
          </div>
        </div>

        <!-- 正则助手工具 -->
        <div v-else-if="selectedTool === 'regex-helper'" class="tool-body">
          <a-row :gutter="16">
            <a-col :span="24">
              <div class="regex-input">
                <div class="section-header">正则表达式</div>
                <a-input
                  v-model:value="regexPattern"
                  placeholder="输入正则表达式，例如: \d{3}-\d{4}"
                  size="large"
                />
                <div class="regex-flags">
                  <a-checkbox-group v-model:value="regexFlags">
                    <a-checkbox value="g">全局匹配 (g)</a-checkbox>
                    <a-checkbox value="i">忽略大小写 (i)</a-checkbox>
                    <a-checkbox value="m">多行模式 (m)</a-checkbox>
                  </a-checkbox-group>
                </div>
              </div>
            </a-col>
          </a-row>
          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :span="12">
              <div class="input-section">
                <div class="section-header">测试文本</div>
                <a-textarea
                  v-model:value="regexText"
                  :rows="12"
                  placeholder="输入要测试的文本..."
                />
              </div>
            </a-col>
            <a-col :span="12">
              <div class="output-section">
                <div class="section-header">
                  匹配结果
                  <a-tag v-if="regexMatches.length > 0" color="success">
                    找到 {{ regexMatches.length }} 个匹配
                  </a-tag>
                </div>
                <div class="regex-matches">
                  <a-empty v-if="regexMatches.length === 0" description="暂无匹配结果" />
                  <div v-else class="match-list">
                    <div
                      v-for="(match, index) in regexMatches"
                      :key="index"
                      class="match-item"
                    >
                      <div class="match-header">
                        <a-tag color="blue">匹配 {{ index + 1 }}</a-tag>
                        <span class="match-index">位置: {{ match.index }}</span>
                      </div>
                      <div class="match-content">{{ match.match }}</div>
                      <div v-if="match.groups && match.groups.length > 0" class="match-groups">
                        <div v-for="(group, gIndex) in match.groups" :key="gIndex">
                          <a-tag size="small">分组 {{ gIndex + 1 }}</a-tag> {{ group }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </a-col>
          </a-row>
          <div class="actions">
            <a-button type="primary" :loading="loading" @click="handleTestRegex">
              <search-outlined /> 测试匹配
            </a-button>
            <a-button @click="clearRegex">清空</a-button>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import {
  CodeOutlined,
  SwapOutlined,
  SecurityScanOutlined,
  LeftOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  SearchOutlined
} from '@ant-design/icons-vue';
import { formatSql, convertData, testRegex } from '../api';
import type { RegexMatch } from '../../backend/types';

// 当前选中的工具
const selectedTool = ref<string | null>(null);
const loading = ref(false);

// SQL 格式化
const sqlInput = ref('');
const sqlOutput = ref('');
const sqlLanguage = ref('mysql');
const sqlUppercase = ref(false);

// 数据转换
const dataInput = ref('');
const dataOutput = ref('');
const sourceFormat = ref('json');
const targetFormat = ref('csv');
const prettyOutput = ref(true);

// 正则助手
const regexPattern = ref('');
const regexText = ref('');
const regexFlags = ref<string[]>(['g']);
const regexMatches = ref<RegexMatch[]>([]);

// 工具标题
const toolTitle = computed(() => {
  const titles: Record<string, string> = {
    'sql-formatter': 'SQL 格式化',
    'data-converter': '数据转换',
    'regex-helper': '正则助手'
  };
  return titles[selectedTool.value || ''] || '';
});

/**
 * 选择工具
 */
function selectTool(tool: string) {
  selectedTool.value = tool;
  // 清空之前的数据
  if (tool === 'sql-formatter') {
    sqlInput.value = '';
    sqlOutput.value = '';
  } else if (tool === 'data-converter') {
    dataInput.value = '';
    dataOutput.value = '';
  } else if (tool === 'regex-helper') {
    regexPattern.value = '';
    regexText.value = '';
    regexMatches.value = [];
  }
}

/**
 * SQL 格式化
 */
async function handleFormatSql() {
  if (!sqlInput.value.trim()) {
    message.warning('请输入 SQL 语句');
    return;
  }

  loading.value = true;
  try {
    const result = await formatSql({
      sql: sqlInput.value,
      language: sqlLanguage.value as any,
      uppercase: sqlUppercase.value
    });

    if (result.success && result.formatted) {
      sqlOutput.value = result.formatted;
      message.success('格式化成功');
    } else {
      message.error(result.error || '格式化失败');
    }
  } catch (error: any) {
    message.error(error.message || '格式化失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 数据转换
 */
async function handleConvertData() {
  if (!dataInput.value.trim()) {
    message.warning('请输入数据');
    return;
  }

  loading.value = true;
  try {
    const result = await convertData({
      data: dataInput.value,
      sourceFormat: sourceFormat.value as any,
      targetFormat: targetFormat.value as any,
      options: {
        pretty: prettyOutput.value
      }
    });

    if (result.success && result.converted) {
      dataOutput.value = result.converted;
      message.success('转换成功');
    } else {
      message.error(result.error || '转换失败');
    }
  } catch (error: any) {
    message.error(error.message || '转换失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 正则测试
 */
async function handleTestRegex() {
  if (!regexPattern.value.trim()) {
    message.warning('请输入正则表达式');
    return;
  }

  if (!regexText.value.trim()) {
    message.warning('请输入测试文本');
    return;
  }

  loading.value = true;
  try {
    const result = await testRegex({
      pattern: regexPattern.value,
      text: regexText.value,
      flags: regexFlags.value.join('')
    });

    if (result.success) {
      regexMatches.value = result.matches || [];
      if (regexMatches.value.length === 0) {
        message.info('没有找到匹配项');
      } else {
        message.success(`找到 ${regexMatches.value.length} 个匹配项`);
      }
    } else {
      message.error(result.error || '测试失败');
      regexMatches.value = [];
    }
  } catch (error: any) {
    message.error(error.message || '测试失败');
    regexMatches.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * 复制 SQL 输出
 */
function copySqlOutput() {
  if (!sqlOutput.value) {
    message.warning('没有可复制的内容');
    return;
  }
  navigator.clipboard.writeText(sqlOutput.value);
  message.success('已复制到剪贴板');
}

/**
 * 复制数据输出
 */
function copyDataOutput() {
  if (!dataOutput.value) {
    message.warning('没有可复制的内容');
    return;
  }
  navigator.clipboard.writeText(dataOutput.value);
  message.success('已复制到剪贴板');
}

/**
 * 清空 SQL
 */
function clearSql() {
  sqlInput.value = '';
  sqlOutput.value = '';
}

/**
 * 清空数据
 */
function clearData() {
  dataInput.value = '';
  dataOutput.value = '';
}

/**
 * 清空正则
 */
function clearRegex() {
  regexPattern.value = '';
  regexText.value = '';
  regexMatches.value = [];
}
</script>

<style scoped>
.efficiency-tools {
  padding: 24px;
}

.tool-grid :deep(.ant-card) {
  height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.tool-grid :deep(.ant-card:hover) {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.tool-title {
  font-size: 18px;
  font-weight: bold;
}

.tool-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section,
.output-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  margin-bottom: 8px;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.regex-input {
  margin-bottom: 16px;
}

.regex-flags {
  margin-top: 12px;
}

.regex-matches {
  max-height: 400px;
  overflow-y: auto;
}

.match-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-item {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.match-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.match-index {
  font-size: 12px;
  color: #666;
}

.match-content {
  padding: 8px;
  background: white;
  border-radius: 4px;
  font-family: monospace;
  word-break: break-all;
}

.match-groups {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
}

.match-groups > div {
  margin-top: 4px;
}
</style>
