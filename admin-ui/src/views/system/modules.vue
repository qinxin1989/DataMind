<template>
  <div class="module-management">
    <div class="page-header">
      <h1>模块管理</h1>
      <a-space>
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索模块名称"
          style="width: 240px"
          allow-clear
        />
        <a-button @click="fetchModules">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </a-space>
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="16" class="stat-row">
      <a-col :span="6">
        <a-card size="small">
          <a-statistic title="模块总数" :value="modules.length" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card size="small">
          <a-statistic title="已启用" :value="enabledCount" :value-style="{ color: '#52c41a' }" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card size="small">
          <a-statistic title="已禁用" :value="disabledCount" :value-style="{ color: '#d9d9d9' }" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card size="small">
          <a-statistic title="异常" :value="errorCount" :value-style="{ color: '#ff4d4f' }" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 类型筛选 -->
    <a-radio-group v-model:value="filterType" style="margin-bottom: 16px">
      <a-radio-button value="all">全部</a-radio-button>
      <a-radio-button value="system">系统模块</a-radio-button>
      <a-radio-button value="business">业务模块</a-radio-button>
      <a-radio-button value="tool">工具模块</a-radio-button>
    </a-radio-group>

    <!-- 模块表格 -->
    <a-table
      :columns="columns"
      :data-source="filteredModules"
      :loading="loading"
      row-key="name"
      :pagination="{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 个模块` }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'displayName'">
          <a @click="showDetail(record)">{{ record.displayName || record.name }}</a>
        </template>

        <template v-if="column.key === 'type'">
          <a-tag :color="typeColorMap[record.type] || 'default'">
            {{ typeTextMap[record.type] || record.type }}
          </a-tag>
        </template>

        <template v-if="column.key === 'status'">
          <a-badge :status="statusBadgeMap[record.status] || 'default'" :text="statusTextMap[record.status] || record.status" />
        </template>

        <template v-if="column.key === 'features'">
          <a-space :size="4">
            <a-tooltip v-if="record.hasBackend" title="后端服务"><ApiOutlined style="color: #1677ff" /></a-tooltip>
            <a-tooltip v-if="record.hasFrontend" title="前端页面"><DesktopOutlined style="color: #52c41a" /></a-tooltip>
            <a-tooltip v-if="record.menuCount > 0" :title="`${record.menuCount} 个菜单`"><MenuOutlined style="color: #faad14" /></a-tooltip>
            <a-tooltip v-if="record.permissionCount > 0" :title="`${record.permissionCount} 个权限`"><LockOutlined style="color: #722ed1" /></a-tooltip>
          </a-space>
        </template>

        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" type="link" @click="showDetail(record)">详情</a-button>
            <a-popconfirm
              v-if="record.status === 'enabled'"
              title="确定要禁用此模块吗？"
              @confirm="toggleModule(record.name, 'disable')"
            >
              <a-button size="small" type="link" danger :loading="toggling === record.name">禁用</a-button>
            </a-popconfirm>
            <a-popconfirm
              v-else-if="record.status === 'disabled'"
              title="确定要启用此模块吗？"
              @confirm="toggleModule(record.name, 'enable')"
            >
              <a-button size="small" type="link" :loading="toggling === record.name">启用</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="currentDetail?.displayName || currentDetail?.name || '模块详情'"
      width="560"
      :destroy-on-close="true"
    >
      <a-spin :spinning="detailLoading">
        <template v-if="currentDetail">
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="模块名称">{{ currentDetail.name }}</a-descriptions-item>
            <a-descriptions-item label="显示名称">{{ currentDetail.displayName }}</a-descriptions-item>
            <a-descriptions-item label="版本">{{ currentDetail.version }}</a-descriptions-item>
            <a-descriptions-item label="描述">{{ currentDetail.description || '-' }}</a-descriptions-item>
            <a-descriptions-item label="作者">{{ currentDetail.author || '-' }}</a-descriptions-item>
            <a-descriptions-item label="类型">
              <a-tag :color="typeColorMap[currentDetail.type]">{{ typeTextMap[currentDetail.type] }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="分类">{{ currentDetail.category || '-' }}</a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-badge :status="statusBadgeMap[currentDetail.status]" :text="statusTextMap[currentDetail.status]" />
            </a-descriptions-item>
            <a-descriptions-item v-if="currentDetail.error" label="错误信息">
              <a-typography-text type="danger">{{ currentDetail.error }}</a-typography-text>
            </a-descriptions-item>
            <a-descriptions-item v-if="currentDetail.tags?.length" label="标签">
              <a-tag v-for="tag in currentDetail.tags" :key="tag">{{ tag }}</a-tag>
            </a-descriptions-item>
          </a-descriptions>

          <!-- 后端信息 -->
          <template v-if="currentDetail.backend">
            <a-divider orientation="left">后端服务</a-divider>
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="入口文件">{{ currentDetail.backend.entry }}</a-descriptions-item>
              <a-descriptions-item v-if="currentDetail.backend.routesPrefix" label="路由前缀">{{ currentDetail.backend.routesPrefix }}</a-descriptions-item>
            </a-descriptions>
          </template>

          <!-- 前端信息 -->
          <template v-if="currentDetail.frontend">
            <a-divider orientation="left">前端页面</a-divider>
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="入口文件">{{ currentDetail.frontend.entry }}</a-descriptions-item>
            </a-descriptions>
          </template>

          <!-- 菜单 -->
          <template v-if="currentDetail.menus?.length">
            <a-divider orientation="left">菜单 ({{ currentDetail.menus.length }})</a-divider>
            <a-list size="small" bordered :data-source="currentDetail.menus">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #title>{{ item.title || item.id }}</template>
                    <template #description>{{ item.path || '-' }}</template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </template>

          <!-- 权限 -->
          <template v-if="currentDetail.permissions?.length">
            <a-divider orientation="left">权限 ({{ currentDetail.permissions.length }})</a-divider>
            <a-list size="small" bordered :data-source="currentDetail.permissions">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #title>{{ item.name || item.code }}</template>
                    <template #description>{{ item.description || item.code }}</template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </template>

          <!-- API 端点 -->
          <template v-if="currentDetail.api?.endpoints?.length">
            <a-divider orientation="left">API 端点 ({{ currentDetail.api.endpoints.length }})</a-divider>
            <a-list size="small" bordered :data-source="currentDetail.api.endpoints">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-tag :color="methodColorMap[item.method?.toUpperCase()] || 'default'" style="min-width: 52px; text-align: center">
                    {{ item.method?.toUpperCase() }}
                  </a-tag>
                  <span style="margin-left: 8px">{{ item.path }}</span>
                  <span v-if="item.description" style="margin-left: 8px; color: rgba(0,0,0,0.45)">{{ item.description }}</span>
                </a-list-item>
              </template>
            </a-list>
          </template>

          <!-- 依赖 -->
          <template v-if="currentDetail.dependencies && Object.keys(currentDetail.dependencies).length">
            <a-divider orientation="left">依赖模块</a-divider>
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item v-for="(ver, dep) in currentDetail.dependencies" :key="dep" :label="dep">
                {{ ver }}
              </a-descriptions-item>
            </a-descriptions>
          </template>
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, ApiOutlined, DesktopOutlined, MenuOutlined, LockOutlined } from '@ant-design/icons-vue'
import { moduleApi, type ModuleSummary, type ModuleDetail } from '@/api/module'

const loading = ref(false)
const detailLoading = ref(false)
const toggling = ref<string | null>(null)
const searchText = ref('')
const filterType = ref('all')
const modules = ref<ModuleSummary[]>([])
const drawerVisible = ref(false)
const currentDetail = ref<ModuleDetail | null>(null)

const enabledCount = computed(() => modules.value.filter(m => m.status === 'enabled').length)
const disabledCount = computed(() => modules.value.filter(m => m.status === 'disabled').length)
const errorCount = computed(() => modules.value.filter(m => m.status === 'error').length)

const filteredModules = computed(() => {
  let list = modules.value
  if (filterType.value !== 'all') {
    list = list.filter(m => m.type === filterType.value)
  }
  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()
    list = list.filter(m =>
      m.name.toLowerCase().includes(keyword) ||
      (m.displayName || '').toLowerCase().includes(keyword)
    )
  }
  return list
})

const columns = [
  { title: '模块名称', key: 'displayName', dataIndex: 'displayName', width: 180 },
  { title: '版本', dataIndex: 'version', width: 80 },
  { title: '类型', key: 'type', dataIndex: 'type', width: 100 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 100 },
  { title: '功能', key: 'features', width: 120 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '操作', key: 'action', width: 140, fixed: 'right' as const },
]

const typeColorMap: Record<string, string> = { system: 'blue', business: 'green', tool: 'orange' }
const typeTextMap: Record<string, string> = { system: '系统', business: '业务', tool: '工具' }
const statusBadgeMap: Record<string, string> = { enabled: 'success', disabled: 'default', installed: 'processing', error: 'error' }
const statusTextMap: Record<string, string> = { enabled: '已启用', disabled: '已禁用', installed: '已安装', error: '异常' }
const methodColorMap: Record<string, string> = { GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'cyan' }

onMounted(() => {
  fetchModules()
})

async function fetchModules() {
  loading.value = true
  try {
    const res = await moduleApi.getModules()
    if (res.success && res.data) {
      modules.value = res.data
    }
  } catch (error) {
    message.error('获取模块列表失败')
  } finally {
    loading.value = false
  }
}

async function showDetail(record: ModuleSummary) {
  drawerVisible.value = true
  detailLoading.value = true
  try {
    const res = await moduleApi.getModule(record.name)
    if (res.success && res.data) {
      currentDetail.value = res.data
    }
  } catch (error) {
    message.error('获取模块详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function toggleModule(name: string, action: 'enable' | 'disable') {
  toggling.value = name
  try {
    const res = action === 'enable'
      ? await moduleApi.enableModule(name)
      : await moduleApi.disableModule(name)
    if (res.success) {
      message.success(action === 'enable' ? '模块已启用' : '模块已禁用')
      await fetchModules()
    } else {
      message.error(res.error || '操作失败')
    }
  } catch (error: any) {
    message.error(error?.response?.data?.error || '操作失败')
  } finally {
    toggling.value = null
  }
}
</script>

<style scoped>
.module-management {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.stat-row {
  margin-bottom: 16px;
}
</style>
