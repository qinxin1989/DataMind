<template>
  <div class="template-optimizer-page">
    <a-page-header
      title="SQL模板优化器"
      sub-title="测试和优化SQL模板匹配准确率"
      :backIcon="false"
    >
      <template #extra>
        <a-button type="primary" @click="showHelp">
          使用帮助
        </a-button>
      </template>
    </a-page-header>

    <a-row :gutter="16" class="content-row">
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

            <a-form-item label="优化选项">
              <a-checkbox v-model:checked="autoOptimize">自动优化（AI驱动）</a-checkbox>
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
                >
                  {{ testing ? '测试中...' : '运行测试' }}
                </a-button>
                <a-button
                  @click="runOptimize"
                  :loading="optimizing"
                  :disabled="!selectedDatasource || !autoOptimize"
                >
                  自动优化
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>

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
              >
                测试
              </a-button>
            </a-form-item>
          </a-form>

          <div v-if="quickTestResult" class="quick-test-result">
            <a-divider />
            <p>
              <strong>匹配结果:</strong>
              <a-tag :color="quickTestResult.matched ? 'success' : 'error'">
                {{ quickTestResult.matched ? '匹配成功' : '未匹配' }}
              </a-tag>
            </p>
            <p v-if="quickTestResult.pattern"><strong>匹配模式:</strong> {{ quickTestResult.pattern }}</p>
            <p v-if="quickTestResult.sql"><strong>生成SQL:</strong></p>
            <pre class="sql-code" v-if="quickTestResult.sql">{{ quickTestResult.sql }}</pre>
            <p><strong>耗时:</strong> {{ quickTestResult.duration }}ms</p>
          </div>
        </a-card>
      </a-col>

      <a-col :span="16">
        <a-card v-if="testing || optimizing" :bordered="false" class="progress-card">
          <a-progress :percent="progress" :status="progressStatus" />
          <p class="progress-message">{{ statusMessage }}</p>
        </a-card>

        <a-card v-if="testResult && !testing" :bordered="false" class="result-card">
          <template #title>
            <span>测试结果</span>
            <a-tag :color="accuracyColor" class="accuracy-tag">
              准确率: {{ (testResult.accuracy * 100).toFixed(1) }}%
            </a-tag>
          </template>

          <a-row :gutter="16" class="stats-row">
            <a-col :span="6"><a-statistic title="总测试数" :value="testResult.total" /></a-col>
            <a-col :span="6"><a-statistic title="正确数" :value="testResult.correct" /></a-col>
            <a-col :span="6"><a-statistic title="失败数" :value="testResult.total - testResult.correct" /></a-col>
            <a-col :span="6"><a-statistic title="耗时" :value="testResult.duration" suffix="ms" /></a-col>
          </a-row>

          <a-divider />
          <h4>分类统计</h4>
          <a-table
            :dataSource="testResult.byCategory"
            :columns="categoryColumns"
            :pagination="false"
            size="small"
          />

          <a-divider />
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
                    <a-tag color="orange" style="margin-left: 8px">{{ item.category }}</a-tag>
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
      </a-col>
    </a-row>

    <a-modal v-model:visible="helpVisible" title="使用帮助" :footer="null" width="700px">
      <a-typography>
        <a-typography-title :level="4">SQL模板优化器</a-typography-title>
        <a-typography-paragraph>
          用于测试和优化SQL模板匹配的准确率，让数据查询更快更准确。
        </a-typography-paragraph>
      </a-typography>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { get, post } from '@/api/request'

const datasources = ref<any[]>([])
const loadingDatasources = ref(false)
const selectedDatasource = ref<string>('')

const testMode = ref<'quick' | 'full'>('quick')
const autoOptimize = ref(false)
const targetAccuracy = ref(0.85)

const testing = ref(false)
const optimizing = ref(false)
const quickTesting = ref(false)
const progress = ref(0)
const progressStatus = ref<'active' | 'success' | 'exception'>('active')
const statusMessage = ref('')

const quickTestQuestion = ref('')
const quickTestResult = ref<any>(null)
const testResult = ref<any>(null)
const helpVisible = ref(false)

const categoryColumns = [
  { title: '类别', dataIndex: 'category', key: 'category' },
  { title: '测试数', dataIndex: 'total', key: 'total' },
  { title: '正确数', dataIndex: 'correct', key: 'correct' },
  {
    title: '准确率',
    dataIndex: 'accuracy',
    key: 'accuracy',
    customRender: ({ text }: any) => `${(text * 100).toFixed(1)}%`,
  },
]

const accuracyColor = computed(() => {
  if (!testResult.value) return 'default'
  const acc = testResult.value.accuracy
  if (acc >= 0.8) return 'success'
  if (acc >= 0.6) return 'warning'
  return 'error'
})

const loadDatasources = async () => {
  loadingDatasources.value = true
  try {
    // 使用模板优化器自己的数据源列表端点（admin认证体系内）
    const res = await get('/admin/template-optimizer/datasources')
    if (res.success) {
      datasources.value = res.data || []
    } else {
      message.error(res.error || '加载数据源失败')
    }
  } catch (e: any) {
    console.error('[TemplateOptimizer] 加载数据源失败:', e)
    message.error('加载数据源失败: ' + (e.message || '未知错误'))
  } finally {
    loadingDatasources.value = false
  }
}

const runTest = async () => {
  if (!selectedDatasource.value) return

  testing.value = true
  progress.value = 0
  progressStatus.value = 'active'
  statusMessage.value = '准备开始测试...'
  testResult.value = null

  try {
    const progressInterval = setInterval(() => {
      if (progress.value < 90) progress.value += Math.random() * 10
    }, 1000)

    const res = await post('/admin/template-optimizer/test', {
      datasourceId: selectedDatasource.value,
      options: {
        quick: testMode.value === 'quick',
      },
    })

    clearInterval(progressInterval)

    if (res.success) {
      testResult.value = res.data
      progress.value = 100
      progressStatus.value = 'success'
      message.success('测试完成！')
    } else {
      progressStatus.value = 'exception'
      message.error(typeof res.error === 'string' ? res.error : (res.error?.message || '测试失败'))
    }
  } catch (e: any) {
    progressStatus.value = 'exception'
    message.error(e.message || '测试运行失败')
  } finally {
    testing.value = false
  }
}

const runOptimize = async () => {
  if (!selectedDatasource.value || !autoOptimize.value) return

  optimizing.value = true
  progress.value = 0
  progressStatus.value = 'active'
  statusMessage.value = '开始自动优化...'

  try {
    const res = await post('/admin/template-optimizer/optimize', {
      datasourceId: selectedDatasource.value,
      targetAccuracy: targetAccuracy.value,
      maxIterations: 3,
    })

    if (res.success) {
      progress.value = 100
      progressStatus.value = 'success'
      message.success(`优化完成！最终准确率: ${(res.data.finalAccuracy * 100).toFixed(1)}%`)
    } else {
      progressStatus.value = 'exception'
      message.error(typeof res.error === 'string' ? res.error : '优化失败')
    }
  } catch (e: any) {
    progressStatus.value = 'exception'
    message.error(e.message || '优化运行失败')
  } finally {
    optimizing.value = false
  }
}

const runQuickTest = async () => {
  if (!selectedDatasource.value || !quickTestQuestion.value) return

  quickTesting.value = true
  quickTestResult.value = null

  try {
    const res = await post('/admin/template-optimizer/quick-test', {
      datasourceId: selectedDatasource.value,
      question: quickTestQuestion.value,
    })

    if (res.success) {
      quickTestResult.value = res.data
    } else {
      message.error(res.error || '测试失败')
    }
  } catch (e: any) {
    message.error(e.message || '测试运行失败')
  } finally {
    quickTesting.value = false
  }
}

const showHelp = () => {
  helpVisible.value = true
}

onMounted(() => {
  loadDatasources()
})
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
</style>
