<template>
  <div class="system-config">
    <div class="page-header">
      <h1>系统配置</h1>
    </div>

    <a-tabs v-model:activeKey="activeTab">
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
              <a-input v-model:value="dbConfig.database" placeholder="ai-data-platform" />
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
import { systemConfigApi } from '../api'
import type { SystemConfig, DbConfig } from '../../backend/types'

const configs = ref<SystemConfig[]>([])
const activeTab = ref('database')
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
    const res = await systemConfigApi.getDbConfig()
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
    const res = await systemConfigApi.getConfigs()
    if (res.success && res.data) {
      configs.value = res.data
    }
  } catch (error) {
    console.error('获取配置失败:', error)
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
    
    const res = await systemConfigApi.updateDbConfig(updateData)
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
    
    const res = await systemConfigApi.testDbConnection(testData)
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
    await systemConfigApi.updateConfig(key, { value })
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
</style>
