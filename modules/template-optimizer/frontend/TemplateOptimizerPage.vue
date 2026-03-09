<template>
  <div class="template-optimizer-page">
    <a-page-header
      title="SQL模板优化器"
      sub-title="测试和优化SQL模板匹配准确率"
      :backIcon="false"
    >
      <template #extra>
        <a-button type="primary" @click="showHelp" icon="QuestionCircleOutlined">
          使用帮助
        </a-button>
      </template>
    </a-page-header>

    <a-row :gutter="16" class="content-row">
      <!-- 左侧：控制面板 -->
      <a-col :span="8">
        <a-card title="测试配置" :bordered="false">
          <a-form layout="vertical">
            <a-form-item label="数据源">
              <a-select
                v-model:value="selectedDatasource"
                placeholder="选择要测试的数据源"
                :loading="loadingDatasources"
              >
                <a-select-option 
                  v-for="ds in datasources" 
                  :key="ds.id" 
                  :value="ds.id"
                >
                  {{ ds.name }} ({{ ds.type }})
                </a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="测试模式">
              <a-radio-group v-model:value="testMode">
                <a-radio-button value="quick">快速测试</a-radio-button>
                <a-radio-button value="full">完整测试</a-radio-button>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="优化选项" v-if="showOptimizeOptions">
              <a-checkbox v-model:checked="autoOptimize">
                自动优化（AI驱动）
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="autoOptimize">
              <div class="slider-item">
                <span>目标准确率: {{ (targetAccuracy * 100).toFixed(0) }}%</span>
                <a-slider 
                  v-model:value="targetAccuracy" 
                  :min="0.5" 
                  :max="0.99" 
                  :step="0.05"
                />
              </div>
            </a-form-item>

            <a-form-item>
              <a-space>
                <a-button 
                  type="primary" 
                  @click="runTest"
                  :loading="testing"
                  :disabled="!selectedDatasource"
                  icon="PlayCircleOutlined"
                >
                  {{ testing ? '测试中...' : '运行测试' }}
                </a-button>
                <a-button 
                  @click="runOptimize"
                  :loading="optimizing"
                  :disabled="!selectedDatasource || !autoOptimize"
                  icon="ThunderboltOutlined"
                >
                  自动优化
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>

        <!-- 快速测试 -->
        <a-card title="快速测试" :bordered="false" class="quick-test-card">
          <a-form layout="vertical">
            <a-form-item label="测试问题">
              <a-textarea
                v-model:value="quickTestQuestion"
                :rows="2"
                placeholder="输入要测试的问题，例如：哪些发明人的专利产出最高？"
              />
            </a-form-item>
            <a-form-item>
              <a-button 
                @click="runQuickTest"
                :loading="quickTesting"
                :disabled="!selectedDatasource || !quickTestQuestion"
                icon="ExperimentOutlined"
              >
                测试
              </a-button>
            </a-form-item>
          </a-form>

          <div v-if="quickTestResult" class="quick-test-result">
            <a-divider />
            <p><strong>匹配结果:</strong> 
              <a-tag :color="quickTestResult.matched ? 'success' : 'error'">
                {{ quickTestResult.matched ? '匹配成功' : '未匹配' }}
              </a-tag>
            </p>
            <p v-if="quickTestResult.pattern"><strong>匹配模式:</strong> {{ quickTestResult.pattern }}</p>
            <p v-if="quickTestResult.sql"><strong>生成SQL:</strong></p>
            <pre class="sql-code">{{ quickTestResult.sql }}</pre>
            <p><strong>耗时:</strong> {{ quickTestResult.duration }}ms</p>
          </div>
        </a-card>
      </a-col>

      <!-- 右侧：结果展示 -->
      <a-col :span="16">
        <!-- 测试进度 -->
        <a-card v-if="testing || optimizing" :bordered="false" class="progress-card">
          <a-progress :percent="progress" :status="progressStatus" />
          <p class="progress-message">{{ statusMessage }}</p>
        </a-card>

        <!-- 测试结果 -->
        <template v-if="testResult && !testing">
          <a-card :bordered="false" class="result-card">
            <template #title>
              <span>测试结果</span>
              <a-tag :color="accuracyColor" class="accuracy-tag">
                准确率: {{ (testResult.accuracy * 100).toFixed(1) }}%
              </a-tag>
            </template>
            <template #extra>
              <a-button @click="saveReport" icon="DownloadOutlined">
                保存报告
              </a-button>
            </template>

            <a-row :gutter="16" class="stats-row">
              <a-col :span="6">
                <a-statistic 
                  title="总测试数" 
                  :value="testResult.total" 
                />
              </a-col>
              <a-col :span="6">
                <a-statistic 
                  title="正确数" 
                  :value="testResult.correct"
                  :valueStyle="{ color: '#3f8600' }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic 
                  title="失败数" 
                  :value="testResult.total - testResult.correct"
                  :valueStyle="{ color: '#cf1322' }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic 
                  title="耗时" 
                  :value="testResult.duration"
                  suffix="ms"
                />
              </a-col>
            </a-row>

            <a-divider />

            <!-- 分类统计 -->
            <h4>分类统计</h4>
            <a-table
              :dataSource="testResult.byCategory"
              :columns="categoryColumns"
              :pagination="false"
              size="small"
            />

            <a-divider />

            <!-- 失败案例 -->
            <h4>失败案例 ({{ testResult.failedCases.length }}个)</h4>
            <a-list
              :dataSource="testResult.failedCases"
              :pagination="{ pageSize: 5 }"
              size="small"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #title>
                      <span>{{ item.question }}</span>
                      <a-tag color="orange" style="margin-left: 8px">
                        {{ item.category }}
                      </a-tag>
                    </template>
                    <template #description>
                      <span>期望: {{ item.expected }}</span>
                      <a-divider type="vertical" />
                      <span>实际: {{ item.actual }}</span>
                    </template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </template>

        <!-- 历史报告 -->
        <a-card title="历史报告" :bordered="false" class="history-card">
          <a-table
            :dataSource="historyReports"
            :columns="historyColumns"
            :loading="loadingHistory"
            :pagination="{ pageSize: 5 }"
            size="small"
            @rowClick="viewReport"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 帮助弹窗 -->
    <a-modal
      v-model:visible="helpVisible"
      title="使用帮助"
      :footer="null"
      width="700px"
    >
      <a-typography>
        <a-typography-title :level="4">SQL模板优化器</a-typography-title>
        <a-typography-paragraph>
          用于测试和优化SQL模板匹配的准确率，让数据查询更快更准确。
        </a-typography-paragraph>

        <a-typography-title :level="5">功能说明</a-typography-title>
        <a-typography-paragraph>
          <ul>
            <li><strong>快速测试：</strong>运行少量测试用例，快速验证模板匹配情况</li>
            <li><strong>完整测试：</strong>运行全面的测试用例（约50个），覆盖各类查询场景</li>
            <li><strong>自动优化：</strong>AI驱动的模板自动优化，迭代提升准确率</li>
          </ul>
        </a-typography-paragraph>

        <a-typography-title :level="5">测试类别</a-typography-title>
        <a-typography-paragraph>
          <ul>
            <li>产出统计：GROUP BY + COUNT 查询</li>
            <li>时间窗口：近N年、特定年份范围查询</li>
            <li>极值查询：MAX/MIN 查询</li>
            <li>排名查询：ORDER BY + LIMIT 查询</li>
            <li>平均值：AVG 查询</li>
            <li>总数统计：COUNT 查询</li>
          </ul>
        </a-typography-paragraph>
      </a-typography>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import axios from 'axios';

// 数据源
const datasources = ref<any[]>([]);
const loadingDatasources = ref(false);
const selectedDatasource = ref<string>('');

// 测试配置
const testMode = ref<'quick' | 'full'>('quick');
const autoOptimize = ref(false);
const targetAccuracy = ref(0.85);
const showOptimizeOptions = ref(true);

// 状态
const testing = ref(false);
const optimizing = ref(false);
const quickTesting = ref(false);
const progress = ref(0);
const progressStatus = ref<'active' | 'success' | 'exception'>('active');
const statusMessage = ref('');

// 快速测试
const quickTestQuestion = ref('');
const quickTestResult = ref<any>(null);

// 测试结果
const testResult = ref<any>(null);

// 历史报告
const historyReports = ref<any[]>([]);
const loadingHistory = ref(false);

// 帮助弹窗
const helpVisible = ref(false);

// 表格列定义
const categoryColumns = [
  { title: '类别', dataIndex: 'category', key: 'category' },
  { title: '测试数', dataIndex: 'total', key: 'total' },
  { title: '正确数', dataIndex: 'correct', key: 'correct' },
  { 
    title: '准确率', 
    dataIndex: 'accuracy', 
    key: 'accuracy',
    customRender: ({ text }: any) => `${(text * 100).toFixed(1)}%`
  }
];

const historyColumns = [
  { title: '时间', dataIndex: 'timestamp', key: 'timestamp' },
  { title: '数据源', dataIndex: 'datasourceId', key: 'datasourceId' },
  { 
    title: '准确率', 
    dataIndex: 'accuracy', 
    key: 'accuracy',
    customRender: ({ text }: any) => `${(text * 100).toFixed(1)}%`
  }
];

// 计算属性
const accuracyColor = computed(() => {
  if (!testResult.value) return 'default';
  const acc = testResult.value.accuracy;
  if (acc >= 0.8) return 'success';
  if (acc >= 0.6) return 'warning';
  return 'error';
});

// 方法
const loadDatasources = async () => {
  loadingDatasources.value = true;
  try {
    const res = await axios.get('/api/admin/datasources');
    if (res.data.success) {
      datasources.value = res.data.data || [];
    }
  } catch (e) {
    message.error('加载数据源失败');
  } finally {
    loadingDatasources.value = false;
  }
};

const loadHistory = async () => {
  loadingHistory.value = true;
  try {
    const res = await axios.get('/api/template-optimizer/reports');
    if (res.data.success) {
      historyReports.value = res.data.data || [];
    }
  } catch (e) {
    console.error('加载历史报告失败', e);
  } finally {
    loadingHistory.value = false;
  }
};

const runTest = async () => {
  if (!selectedDatasource.value) return;
  
  testing.value = true;
  progress.value = 0;
  progressStatus.value = 'active';
  statusMessage.value = '准备开始测试...';
  testResult.value = null;

  try {
    // 模拟进度更新
    const progressInterval = setInterval(() => {
      if (progress.value < 90) {
        progress.value += Math.random() * 10;
      }
    }, 1000);

    const res = await axios.post('/api/template-optimizer/test', {
      datasourceId: selectedDatasource.value,
      options: {
        quick: testMode.value === 'quick'
      }
    });

    clearInterval(progressInterval);

    if (res.data.success) {
      testResult.value = res.data.data;
      progress.value = 100;
      progressStatus.value = 'success';
      message.success('测试完成！');
      loadHistory();
    } else {
      progressStatus.value = 'exception';
      message.error(res.data.error || '测试失败');
    }
  } catch (e: any) {
    progressStatus.value = 'exception';
    message.error(e.message || '测试运行失败');
  } finally {
    testing.value = false;
  }
};

const runOptimize = async () => {
  if (!selectedDatasource.value || !autoOptimize.value) return;

  optimizing.value = true;
  progress.value = 0;
  progressStatus.value = 'active';
  statusMessage.value = '开始自动优化...';

  try {
    const res = await axios.post('/api/template-optimizer/optimize', {
      datasourceId: selectedDatasource.value,
      targetAccuracy: targetAccuracy.value,
      maxIterations: 3
    });

    if (res.data.success) {
      progress.value = 100;
      progressStatus.value = 'success';
      message.success(`优化完成！最终准确率: ${(res.data.data.finalAccuracy * 100).toFixed(1)}%`);
    } else {
      progressStatus.value = 'exception';
      message.error(res.data.error || '优化失败');
    }
  } catch (e: any) {
    progressStatus.value = 'exception';
    message.error(e.message || '优化运行失败');
  } finally {
    optimizing.value = false;
  }
};

const runQuickTest = async () => {
  if (!selectedDatasource.value || !quickTestQuestion.value) return;

  quickTesting.value = true;
  quickTestResult.value = null;

  try {
    const res = await axios.post('/api/template-optimizer/quick-test', {
      datasourceId: selectedDatasource.value,
      question: quickTestQuestion.value
    });

    if (res.data.success) {
      quickTestResult.value = res.data.data;
    } else {
      message.error(res.data.error || '测试失败');
    }
  } catch (e: any) {
    message.error(e.message || '测试运行失败');
  } finally {
    quickTesting.value = false;
  }
};

const saveReport = () => {
  if (!testResult.value) return;
  
  const dataStr = JSON.stringify(testResult.value, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `template-test-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  message.success('报告已下载');
};

const viewReport = (record: any) => {
  // TODO: 查看报告详情
  console.log('查看报告', record);
};

const showHelp = () => {
  helpVisible.value = true;
};

onMounted(() => {
  loadDatasources();
  loadHistory();
});
</script>

<style scoped>
.template-optimizer-page {
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
}

.content-row {
  margin-top: 16px;
}

.quick-test-card {
  margin-top: 16px;
}

.progress-card {
  margin-bottom: 16px;
}

.progress-message {
  text-align: center;
  margin-top: 8px;
  color: #666;
}

.result-card {
  margin-bottom: 16px;
}

.accuracy-tag {
  margin-left: 8px;
}

.stats-row {
  margin-bottom: 16px;
}

.quick-test-result {
  margin-top: 16px;
}

.sql-code {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.slider-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-card {
  margin-top: 16px;
}
</style>
