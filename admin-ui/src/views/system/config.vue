<template>
  <div class="system-config">
    <div class="page-header">
      <h1>系统配置</h1>
    </div>

    <a-tabs v-model:activeKey="activeTab">
      <!-- 安全部署 -->
      <a-tab-pane key="deploy" tab="安全部署">
        <a-card title="安全部署流程" :bordered="false">
          <a-steps direction="vertical" :current="-1" style="max-width: 600px">
            <a-step title="配置环境变量">
              <template #description>
                <div class="step-desc">
                  <p>复制 <code>.env.example</code> 为 <code>.env</code> 并填写真实配置</p>
                  <a-typography-paragraph copyable :content="'copy .env.example .env'" code />
                </div>
              </template>
            </a-step>
            <a-step title="加密敏感配置">
              <template #description>
                <div class="step-desc">
                  <p>运行加密命令，输入主密码加密敏感配置项</p>
                  <a-typography-paragraph copyable :content="'npm run encrypt-env'" code />
                  <p class="hint">加密项：CONFIG_DB_PASSWORD, JWT_SECRET, FILE_ENCRYPTION_KEY</p>
                </div>
              </template>
            </a-step>
            <a-step title="删除明文配置">
              <template #description>
                <div class="step-desc">
                  <p>生成 <code>.env.encrypted</code> 后，删除明文 <code>.env</code> 文件</p>
                  <a-typography-paragraph copyable :content="'del .env'" code />
                </div>
              </template>
            </a-step>
            <a-step title="安全启动服务">
              <template #description>
                <div class="step-desc">
                  <p>使用安全启动命令，启动时需要输入主密码解密配置</p>
                  <a-typography-paragraph copyable :content="'npm run start:secure'" code />
                </div>
              </template>
            </a-step>
          </a-steps>

          <a-divider />

          <a-alert type="info" show-icon style="margin-bottom: 16px">
            <template #message>生成安全密钥</template>
            <template #description>
              <p>JWT_SECRET 和 FILE_ENCRYPTION_KEY 建议使用随机字符串：</p>
              <a-typography-paragraph 
                copyable 
                :content="generateKeyCmd"
                code 
              />
            </template>
          </a-alert>

          <a-alert type="warning" show-icon>
            <template #message>重要提示</template>
            <template #description>
              <ul style="margin: 0; padding-left: 20px">
                <li>请牢记主密码，丢失后无法恢复配置</li>
                <li>生产环境务必删除明文 .env 文件</li>
                <li>.env.encrypted 可以安全提交到代码仓库</li>
                <li>修改数据库配置后需要重启服务</li>
              </ul>
            </template>
          </a-alert>
        </a-card>
      </a-tab-pane>

      <!-- 数据库配置 -->
      <a-tab-pane key="database" tab="数据库配置">
        <a-card title="MySQL 数据库连接" :bordered="false">
          <a-form
            :model="dbConfig"
            :label-col="{ span: 4 }"
            :wrapper-col="{ span: 12 }"
          >
            <a-form-item label="主机地址">
              <a-input v-model:value="dbConfig.host" placeholder="localhost" />
            </a-form-item>
            <a-form-item label="端口">
              <a-input-number
                v-model:value="dbConfig.port"
                :min="1"
                :max="65535"
                style="width: 150px"
              />
            </a-form-item>
            <a-form-item label="用户名">
              <a-input v-model:value="dbConfig.user" placeholder="root" />
            </a-form-item>
            <a-form-item label="密码">
              <a-input-password
                v-model:value="dbConfig.password"
                placeholder="输入新密码以修改"
              />
            </a-form-item>
            <a-form-item label="数据库名">
              <a-input v-model:value="dbConfig.database" placeholder="datamind" />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }">
              <a-space>
                <a-button type="primary" :loading="saving" @click="saveDbConfig">
                  保存配置
                </a-button>
                <a-button :loading="testing" @click="testConnection">
                  测试连接
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-alert
            type="warning"
            show-icon
            style="margin-top: 16px"
          >
            <template #message>
              修改数据库配置后需要重启服务才能生效
            </template>
          </a-alert>
        </a-card>
      </a-tab-pane>

      <!-- 其他系统配置 -->
      <a-tab-pane v-for="group in groups" :key="group" :tab="group">
        <a-form layout="vertical">
          <a-form-item
            v-for="config in getConfigsByGroup(group)"
            :key="config.key"
            :label="config.description"
          >
            <template v-if="config.type === 'boolean'">
              <a-switch
                :checked="config.value === 'true'"
                :disabled="!config.editable"
                @change="(val: boolean) => handleUpdate(config.key, String(val))"
              />
            </template>
            <template v-else-if="config.type === 'number'">
              <a-input-number
                :value="Number(config.value)"
                :disabled="!config.editable"
                @change="(val: number) => handleUpdate(config.key, String(val))"
                style="width: 200px"
              />
            </template>
            <template v-else-if="config.type === 'json'">
              <a-textarea
                :value="config.value"
                :disabled="!config.editable"
                :rows="4"
                @blur="(e: FocusEvent) => handleUpdate(config.key, (e.target as HTMLTextAreaElement).value)"
              />
            </template>
            <template v-else>
              <a-input
                :value="config.value"
                :disabled="!config.editable"
                @blur="(e: FocusEvent) => handleUpdate(config.key, (e.target as HTMLInputElement).value)"
                style="width: 400px"
              />
            </template>
          </a-form-item>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { systemApi, type DbConfig } from '@/api/system'
import type { SystemConfig } from '@/types'

const configs = ref<SystemConfig[]>([])
const activeTab = ref('deploy')
const generateKeyCmd = 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
const saving = ref(false)
const testing = ref(false)

// 数据库配置
const dbConfig = ref<DbConfig>({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: '',
})

const groups = computed(() => {
  const groupSet = new Set(configs.value.map(c => c.group))
  return Array.from(groupSet)
})

function getConfigsByGroup(group: string) {
  return configs.value.filter(c => c.group === group)
}

onMounted(() => {
  fetchDbConfig()
  fetchConfigs()
})

async function fetchDbConfig() {
  try {
    const res = await systemApi.getDbConfig()
    if (res.success && res.data) {
      dbConfig.value = {
        ...res.data,
        password: '', // 不显示密码
      }
    }
  } catch (error) {
    console.error('获取数据库配置失败:', error)
  }
}

async function fetchConfigs() {
  try {
    const res = await systemApi.getConfigs()
    if (res.success && res.data) {
      configs.value = res.data
    }
  } catch (error) {
    // 使用模拟数据
    configs.value = [
      { key: 'site_name', value: 'AI数据平台', type: 'string', description: '站点名称', group: '基础设置', editable: true },
      { key: 'max_upload_size', value: '10485760', type: 'number', description: '最大上传大小(字节)', group: '基础设置', editable: true },
      { key: 'enable_register', value: 'false', type: 'boolean', description: '开放注册', group: '基础设置', editable: true },
      { key: 'session_timeout', value: '3600', type: 'number', description: '会话超时(秒)', group: '安全设置', editable: true },
      { key: 'max_login_attempts', value: '5', type: 'number', description: '最大登录尝试次数', group: '安全设置', editable: true },
      { key: 'enable_2fa', value: 'false', type: 'boolean', description: '启用双因素认证', group: '安全设置', editable: true },
    ]
  }
}

async function saveDbConfig() {
  saving.value = true
  try {
    const updateData: Partial<DbConfig> = {
      host: dbConfig.value.host,
      port: dbConfig.value.port,
      user: dbConfig.value.user,
      database: dbConfig.value.database,
    }
    // 只有输入了新密码才更新
    if (dbConfig.value.password) {
      updateData.password = dbConfig.value.password
    }
    
    const res = await systemApi.updateDbConfig(updateData)
    if (res.success) {
      message.success(res.data?.message || '配置已保存')
      dbConfig.value.password = '' // 清空密码输入
    } else {
      message.error('保存失败')
    }
  } catch (error: any) {
    message.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  try {
    const testData: Partial<DbConfig> = {
      host: dbConfig.value.host,
      port: dbConfig.value.port,
      user: dbConfig.value.user,
      database: dbConfig.value.database,
    }
    if (dbConfig.value.password) {
      testData.password = dbConfig.value.password
    }
    
    const res = await systemApi.testDbConnection(testData)
    if (res.success && res.data) {
      if (res.data.success) {
        message.success('连接成功')
      } else {
        message.error(`连接失败: ${res.data.message}`)
      }
    }
  } catch (error: any) {
    message.error(error.message || '测试失败')
  } finally {
    testing.value = false
  }
}

async function handleUpdate(key: string, value: string) {
  try {
    await systemApi.updateConfig(key, value)
    const config = configs.value.find(c => c.key === key)
    if (config) {
      config.value = value
    }
    message.success('配置已更新')
  } catch (error) {
    message.error('更新失败')
  }
}
</script>

<style scoped>
.system-config {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.step-desc {
  padding: 8px 0;
}

.step-desc p {
  margin: 4px 0;
}

.step-desc .hint {
  color: #888;
  font-size: 12px;
}

.step-desc code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
