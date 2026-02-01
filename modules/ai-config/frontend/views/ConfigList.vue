<template>
  <div class="ai-config">
    <div class="page-header">
      <h1>AI配置</h1>
      <span class="header-tip">拖拽行可调整优先级，AI调用时按优先级顺序尝试</span>
    </div>

    <div class="table-toolbar">
      <a-button type="primary" @click="handleAdd" v-permission="'ai:config:update'">
        <template #icon><PlusOutlined /></template>
        新增配置
      </a-button>
    </div>

    <a-table 
      :columns="columns" 
      :data-source="configs" 
      :loading="loading" 
      row-key="id"
      :custom-row="customRow"
      @dragend="onDragEnd"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'drag'">
          <HolderOutlined class="drag-handle" style="cursor: move; color: #999" />
        </template>
        <template v-else-if="column.key === 'priority'">
          <a-tag>{{ index + 1 }}</a-tag>
        </template>
        <template v-else-if="column.key === 'provider'">
          {{ getProviderLabel(record.provider) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-switch
            :checked="record.status === 'active'"
            @change="(checked: boolean) => handleToggleStatus(record, checked)"
            checked-children="启用"
            un-checked-children="禁用"
          />
        </template>
        <template v-else-if="column.key === 'apiKey'">
          {{ maskApiKey(record.apiKey) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleValidate(record)">
              验证
            </a-button>
            <a-button type="link" size="small" @click="handleEdit(record)" v-permission="'ai:config:update'">
              编辑
            </a-button>
            <a-popconfirm title="确定删除该配置？" @confirm="handleDelete(record)" v-permission="'ai:config:update'">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingConfig ? '编辑配置' : '新增配置'"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
      width="600px"
    >
      <a-form :model="formState" :rules="formRules" ref="formRef" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="配置名称" name="name">
              <a-input v-model:value="formState.name" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="提供商" name="provider">
              <a-select v-model:value="formState.provider" @change="onProviderChange">
                <a-select-opt-group label="云服务">
                  <a-select-option value="siliconflow">SiliconFlow (硅基流动)</a-select-option>
                  <a-select-option value="qwen">通义千问 (阿里云)</a-select-option>
                  <a-select-option value="zhipu">智谱AI (GLM)</a-select-option>
                  <a-select-option value="openai">OpenAI</a-select-option>
                  <a-select-option value="azure">Azure OpenAI</a-select-option>
                  <a-select-option value="deepseek">DeepSeek</a-select-option>
                </a-select-opt-group>
                <a-select-opt-group label="本地部署">
                  <a-select-option value="local-qwen">Qwen3-32B (本地)</a-select-option>
                  <a-select-option value="ollama">Ollama (本地)</a-select-option>
                  <a-select-option value="text-generation-webui">Text Generation WebUI</a-select-option>
                  <a-select-option value="lm-studio">LM Studio</a-select-option>
                  <a-select-option value="vllm">vLLM</a-select-option>
                  <a-select-option value="xinference">Xinference</a-select-option>
                  <a-select-option value="fastchat">FastChat</a-select-option>
                </a-select-opt-group>
                <a-select-opt-group label="其他">
                  <a-select-option value="custom">自定义</a-select-option>
                </a-select-opt-group>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="API Key" name="apiKey">
          <a-input-password v-model:value="formState.apiKey" :placeholder="editingConfig ? '留空则不修改' : '请输入 API Key'" />
        </a-form-item>
        <a-form-item label="API Endpoint" name="baseUrl">
          <a-input v-model:value="formState.baseUrl" :placeholder="getEndpointPlaceholder()" />
          <div v-if="isLocalProvider()" class="endpoint-tips">
            <div class="tip-item">
              <strong>{{ getProviderLabel(formState.provider) }} 配置说明：</strong>
            </div>
            <div v-if="formState.provider === 'local-qwen'" class="tip-item">
              • 本地部署的 Qwen3-32B 模型服务<br>
              • 地址：http://10.9.42.174:3000/v1<br>
              • 模型ID：qwen3-32b<br>
              • API Key 可以留空或填写任意值
            </div>
            <div v-else-if="formState.provider === 'ollama'" class="tip-item">
              • 确保 Ollama 服务运行在 http://localhost:11434<br>
              • 使用 <code>ollama pull llama3.2</code> 下载模型<br>
              • API Key 可以留空或填写任意值
            </div>
            <div v-else-if="formState.provider === 'text-generation-webui'" class="tip-item">
              • 启动时添加 <code>--api</code> 参数<br>
              • 默认端口 5000，API Key 可留空
            </div>
            <div v-else-if="formState.provider === 'lm-studio'" class="tip-item">
              • 在 LM Studio 中启动本地服务器<br>
              • 默认端口 1234，API Key 可留空
            </div>
            <div v-else-if="formState.provider === 'vllm'" class="tip-item">
              • 使用 <code>python -m vllm.entrypoints.openai.api_server</code> 启动<br>
              • 默认端口 8000，API Key 可留空
            </div>
            <div v-else-if="formState.provider === 'xinference'" class="tip-item">
              • 使用 <code>xinference-local --host 0.0.0.0 --port 9997</code> 启动<br>
              • 支持多种开源模型，API Key 可留空
            </div>
            <div v-else-if="formState.provider === 'fastchat'" class="tip-item">
              • 启动 FastChat 控制器和 API 服务器<br>
              • 默认端口 8000，API Key 可留空
            </div>
          </div>
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="模型" name="model">
              <a-select v-model:value="formState.model" :options="getModelOptions()" show-search allow-clear>
                <template #dropdownRender="{ menuNode }">
                  <component :is="menuNode" />
                  <a-divider style="margin: 4px 0" />
                  <div style="padding: 4px 8px; color: #999; font-size: 12px">
                    可手动输入其他模型名称
                  </div>
                </template>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="嵌入模型 (Embedding)" name="embeddingModel">
              <a-select v-model:value="formState.embeddingModel" :options="getEmbeddingOptions()" show-search allow-clear>
                <template #dropdownRender="{ menuNode }">
                  <component :is="menuNode" />
                  <a-divider style="margin: 4px 0" />
                  <div style="padding: 4px 8px; color: #999; font-size: 12px">
                    RAG 向量化使用的模型
                  </div>
                </template>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="最大Token" name="maxTokens">
              <a-input-number v-model:value="formState.maxTokens" :min="100" :max="128000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Temperature" name="temperature">
              <a-slider v-model:value="formState.temperature" :min="0" :max="2" :step="0.1" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="状态" name="status">
              <a-select v-model:value="formState.status">
                <a-select-option value="active">启用</a-select-option>
                <a-select-option value="inactive">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, HolderOutlined } from '@ant-design/icons-vue'
import { aiApi } from '@/api/ai'
import type { AIConfig } from '@/types'

// 提供商配置
const providerConfigs: Record<string, { 
  label: string; 
  endpoint: string; 
  models: string[]; 
  defaultModel: string;
  embeddingModels?: string[];
  defaultEmbeddingModel?: string;
}> = {
  siliconflow: {
    label: 'SiliconFlow',
    endpoint: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen3-32B', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Pro/deepseek-ai/DeepSeek-R1'],
    defaultModel: 'Qwen/Qwen3-32B',
    embeddingModels: ['BAAI/bge-large-zh-v1.5', 'netease-youdao/bce-embedding-base_v1'],
    defaultEmbeddingModel: 'BAAI/bge-large-zh-v1.5',
  },
  qwen: {
    label: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    defaultModel: 'qwen-plus',
    embeddingModels: ['text-embedding-v2', 'text-embedding-v1'],
    defaultEmbeddingModel: 'text-embedding-v2',
  },
  zhipu: {
    label: '智谱AI',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['GLM-4.7', 'GLM-4.5-Air', 'glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-long', 'glm-4-flash'],
    defaultModel: 'GLM-4.7',
    embeddingModels: ['embedding-3', 'embedding-2'],
    defaultEmbeddingModel: 'embedding-3',
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gemini-2.5-flash', 'qwen3-32b'],
    defaultModel: 'gpt-4o',
    embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    defaultEmbeddingModel: 'text-embedding-3-small',
  },
  azure: {
    label: 'Azure OpenAI',
    endpoint: '',
    models: ['gpt-4o', 'gpt-4', 'gpt-35-turbo'],
    defaultModel: 'gpt-4o',
  },
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  'local-qwen': {
    label: 'Qwen3-32B (本地)',
    endpoint: 'http://10.9.42.174:3000/v1',
    models: ['qwen3-32b'],
    defaultModel: 'qwen3-32b',
  },
  ollama: {
    label: 'Ollama (本地)',
    endpoint: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5', 'gemma2', 'mistral', 'codellama', 'llama3.1'],
    defaultModel: 'llama3.2',
  },
  'text-generation-webui': {
    label: 'Text Generation WebUI',
    endpoint: 'http://localhost:5000/v1',
    models: ['text-generation-webui'],
    defaultModel: 'text-generation-webui',
  },
  'lm-studio': {
    label: 'LM Studio',
    endpoint: 'http://localhost:1234/v1',
    models: ['local-model'],
    defaultModel: 'local-model',
  },
  'vllm': {
    label: 'vLLM',
    endpoint: 'http://localhost:8000/v1',
    models: ['vllm-model'],
    defaultModel: 'vllm-model',
  },
  'xinference': {
    label: 'Xinference',
    endpoint: 'http://localhost:9997/v1',
    models: ['qwen2.5-instruct', 'llama-3.1-instruct', 'chatglm3'],
    defaultModel: 'qwen2.5-instruct',
    embeddingModels: ['bge-large-zh-v1.5'],
    defaultEmbeddingModel: 'bge-large-zh-v1.5',
  },
  'fastchat': {
    label: 'FastChat',
    endpoint: 'http://localhost:8000/v1',
    models: ['vicuna-7b-v1.5', 'vicuna-13b-v1.5'],
    defaultModel: 'vicuna-7b-v1.5',
    embeddingModels: ['bge-large-zh-v1.5'],
    defaultEmbeddingModel: 'bge-large-zh-v1.5',
  },
  custom: {
    label: '自定义',
    endpoint: '',
    models: [],
    defaultModel: '',
    embeddingModels: [],
    defaultEmbeddingModel: '',
  },
}

const loading = ref(false)
const configs = ref<AIConfig[]>([])
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingConfig = ref<AIConfig | null>(null)
const formRef = ref()

// 拖拽相关
let dragIndex = -1

const formState = reactive({
  name: '',
  provider: 'siliconflow' as AIConfig['provider'],
  apiKey: '',
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'Qwen/Qwen3-32B',
  embeddingModel: 'BAAI/bge-large-zh-v1.5',
  maxTokens: 8192,
  temperature: 0.7,
  status: 'active' as 'active' | 'inactive',
})

const formRules = {
  name: [{ required: true, message: '请输入配置名称' }],
  provider: [{ required: true, message: '请选择提供商' }],
  model: [{ required: true, message: '请输入模型名称' }],
}

const columns = [
  { title: '', key: 'drag', width: 40 },
  { title: '优先级', key: 'priority', width: 70 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '提供商', key: 'provider', width: 100 },
  { title: '模型', dataIndex: 'model', key: 'model' },
  { title: 'API Key', key: 'apiKey', width: 100 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 120 },
]

// 自定义行属性，支持拖拽
function customRow(_record: AIConfig, index: number) {
  return {
    draggable: true,
    style: { cursor: 'move' },
    onDragstart: (e: DragEvent) => {
      dragIndex = index
      e.dataTransfer?.setData('text/plain', String(index))
    },
    onDragover: (e: DragEvent) => {
      e.preventDefault()
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const fromIndex = dragIndex
      const toIndex = index
      if (fromIndex !== toIndex) {
        const item = configs.value.splice(fromIndex, 1)[0]
        configs.value.splice(toIndex, 0, item)
        savePriorities()
      }
    },
  }
}

function onDragEnd() {
  dragIndex = -1
}

async function savePriorities() {
  try {
    const priorities = configs.value.map((c, i) => ({ id: c.id, priority: i + 1 }))
    await aiApi.updatePriorities(priorities)
    message.success('优先级已更新')
  } catch (error) {
    message.error('更新优先级失败')
    fetchConfigs() // 恢复原顺序
  }
}

onMounted(() => {
  fetchConfigs()
})

function getProviderLabel(provider: string): string {
  return providerConfigs[provider]?.label || provider
}

function getEndpointPlaceholder(): string {
  const config = providerConfigs[formState.provider]
  return config?.endpoint || '请输入 API Endpoint'
}

function getModelOptions() {
  const config = providerConfigs[formState.provider]
  if (!config?.models.length) return []
  return config.models.map(m => ({ label: m, value: m }))
}

function getEmbeddingOptions() {
  const config = providerConfigs[formState.provider]
  if (!config?.embeddingModels?.length) return []
  return config.embeddingModels.map(m => ({ label: m, value: m }))
}

function isLocalProvider(): boolean {
  return ['local-qwen', 'ollama', 'text-generation-webui', 'lm-studio', 'vllm', 'xinference', 'fastchat'].includes(formState.provider)
}

function onProviderChange(provider: AIConfig['provider']) {
  const config = providerConfigs[provider]
  if (config) {
    if (!editingConfig.value || !formState.baseUrl) {
      formState.baseUrl = config.endpoint
    }
    if (!editingConfig.value) {
      formState.model = config.defaultModel
      formState.embeddingModel = config.defaultEmbeddingModel || ''
      formState.name = config.label
    }
  }
}

async function fetchConfigs() {
  loading.value = true
  try {
    const res = await aiApi.getConfigs()
    if (res.success && res.data) {
      configs.value = res.data
    }
  } catch (error) {
    configs.value = []
  } finally {
    loading.value = false
  }
}

function maskApiKey(key: string) {
  if (!key || key.length < 10) return '***'
  return key.substring(0, 6) + '...' + key.substring(key.length - 4)
}

function handleAdd() {
  editingConfig.value = null
  const defaultProvider = 'siliconflow'
  const config = providerConfigs[defaultProvider]
  Object.assign(formState, {
    name: config.label,
    provider: defaultProvider,
    apiKey: '',
    baseUrl: config.endpoint,
    model: config.defaultModel,
    embeddingModel: config.defaultEmbeddingModel || '',
    temperature: 0.7,
    status: 'active',
  })
  modalVisible.value = true
}

function handleEdit(record: AIConfig) {
  editingConfig.value = record
  Object.assign(formState, {
    name: record.name,
    provider: record.provider,
    apiKey: '',
    baseUrl: record.baseUrl || '',
    model: record.model,
    embeddingModel: record.embeddingModel || '',
    maxTokens: record.maxTokens || 8192,
    temperature: record.temperature || 0.7,
    status: record.status,
  })
  modalVisible.value = true
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    
    if (editingConfig.value) {
      await aiApi.updateConfig(editingConfig.value.id, formState)
      message.success('更新成功')
    } else {
      await aiApi.createConfig(formState)
      message.success('创建成功')
    }
    
    modalVisible.value = false
    fetchConfigs()
  } catch (error) {
    // 验证失败
  } finally {
    modalLoading.value = false
  }
}

async function handleDelete(record: AIConfig) {
  try {
    await aiApi.deleteConfig(record.id)
    message.success('删除成功')
    fetchConfigs()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleValidate(record: AIConfig) {
  try {
    const res = await aiApi.validateApiKey(record.provider, record.apiKey || '', record.baseUrl, record.id, record.model)
    if (res.success && res.data?.valid) {
      message.success('API Key 验证成功')
    } else {
      message.error(res.data?.message || 'API Key 验证失败')
    }
  } catch (error) {
    message.error('验证请求失败')
  }
}

async function handleToggleStatus(record: AIConfig, checked: boolean) {
  try {
    await aiApi.updateConfig(record.id, { status: checked ? 'active' : 'inactive' })
    record.status = checked ? 'active' : 'inactive'
    message.success(checked ? '已启用' : '已禁用')
  } catch (error) {
    message.error('操作失败')
  }
}
</script>

<style scoped>
.ai-config {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.header-tip {
  font-size: 13px;
  color: #888;
}

.table-toolbar {
  margin-bottom: 16px;
}

.drag-handle {
  cursor: move;
}

:deep(.ant-table-row) {
  transition: background-color 0.2s;
}

:deep(.ant-table-row:hover) {
  background-color: #fafafa;
}

.endpoint-tips {
  margin-top: 8px;
  padding: 12px;
  background: #f6f8fa;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.tip-item {
  margin-bottom: 4px;
}

.tip-item:last-child {
  margin-bottom: 0;
}

.tip-item code {
  background: #e7f3ff;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}
</style>
