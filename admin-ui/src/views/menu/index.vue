<template>
  <div class="menu-management">
    <div class="page-header">
      <div>
        <h1>菜单管理</h1>
        <p class="page-desc">把菜单结构、模块归属和手动维护入口放在同一个视图里管理。</p>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stat-row">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card size="small">
          <a-statistic title="菜单总数" :value="flatMenus.length" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card size="small">
          <a-statistic title="模块菜单" :value="moduleManagedCount" :value-style="{ color: '#1677ff' }" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card size="small">
          <a-statistic title="核心框架" :value="coreMenuCount" :value-style="{ color: '#d48806' }" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card size="small">
          <a-statistic title="手动菜单" :value="customMenuCount" :value-style="{ color: '#595959' }" />
        </a-card>
      </a-col>
    </a-row>

    <div class="table-toolbar">
      <a-space wrap>
        <a-button type="primary" @click="handleAdd()" v-permission="'menu:update'">
          <template #icon><PlusOutlined /></template>
          新增菜单
        </a-button>

        <a-input-search
          v-model:value="searchText"
          placeholder="搜索菜单标题、路径或模块"
          allow-clear
          style="width: 260px"
        />

        <a-select
          v-model:value="selectedModule"
          placeholder="按模块筛选"
          allow-clear
          show-search
          style="width: 240px"
          :options="moduleFilterOptions"
          option-filter-prop="label"
        />

        <a-radio-group v-model:value="ownerFilter">
          <a-radio-button value="all">全部</a-radio-button>
          <a-radio-button value="module">模块菜单</a-radio-button>
          <a-radio-button value="core">核心框架</a-radio-button>
          <a-radio-button value="custom">手动菜单</a-radio-button>
        </a-radio-group>

        <a-button v-if="hasActiveFilters" @click="clearFilters">清空筛选</a-button>
      </a-space>
    </div>

    <a-alert
      v-if="activeModuleSummary"
      type="info"
      show-icon
      class="filter-alert"
      :message="`当前正在查看模块：${activeModuleSummary.displayName || activeModuleSummary.name}`"
      :description="`这个视图会把该模块注册的菜单和手动菜单区分开，方便你判断哪里该改 module.json，哪里该走页面管理。`"
    />

    <a-table
      :columns="columns"
      :data-source="filteredMenuTree"
      :loading="loading"
      row-key="id"
      :defaultExpandAllRows="true"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'icon'">
          <component v-if="record.icon" :is="getIcon(record.icon)" />
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'menuType'">
          <a-tag :color="getMenuTypeColor(record.menuType)">
            {{ getMenuTypeLabel(record.menuType) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'pathOrUrl'">
          <span v-if="record.menuType === 'internal'">{{ record.path || '-' }}</span>
          <a v-else :href="record.externalUrl" target="_blank">{{ record.externalUrl }}</a>
        </template>
        <template v-else-if="column.key === 'owner'">
          <div class="owner-cell">
            <a-space :size="[0, 6]" wrap>
              <a-tag :color="resolveMenuOwner(record).color">
                {{ resolveMenuOwner(record).label }}
              </a-tag>
              <a-tag
                v-if="resolveMenuOwner(record).moduleKey && resolveMenuOwner(record).moduleKey !== resolveMenuOwner(record).label"
                color="default"
              >
                {{ resolveMenuOwner(record).moduleKey }}
              </a-tag>
            </a-space>
            <div v-if="resolveMenuOwner(record).description" class="owner-hint">
              {{ resolveMenuOwner(record).description }}
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'manageMode'">
          <a-tag :color="getManagementMode(record).color">
            {{ getManagementMode(record).label }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'visible'">
          <a-tag :color="record.visible ? 'green' : 'red'">
            {{ record.visible ? '显示' : '隐藏' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="!isRegisteredModuleMenu(record)"
              type="link"
              size="small"
              @click="handleAdd(record)"
              v-permission="'menu:update'"
            >
              添加子菜单
            </a-button>
            <a-button
              v-if="!isRegisteredModuleMenu(record)"
              type="link"
              size="small"
              @click="handleEdit(record)"
              v-permission="'menu:update'"
            >
              编辑
            </a-button>
            <a-button
              v-if="getRegisteredModule(record)"
              type="link"
              size="small"
              @click="viewModule(record)"
            >
              查看模块
            </a-button>
            <a-popconfirm
              v-if="!isSystemMenu(record.id) && !isRegisteredModuleMenu(record)"
              title="确定删除该菜单？"
              @confirm="handleDelete(record)"
              v-permission="'menu:update'"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
            <a-tag v-if="isRegisteredModuleMenu(record)" color="blue">模块注册</a-tag>
            <a-tag v-else-if="isSystemMenu(record.id)" color="orange">系统菜单</a-tag>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="editingMenu ? '编辑菜单' : '新增菜单'"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
      width="640px"
    >
      <a-space direction="vertical" style="width: 100%" :size="16">
        <a-alert
          v-if="editingMenu && isRegisteredModuleMenu(editingMenu)"
          type="warning"
          show-icon
          message="该菜单由模块注册维护"
          :description="`当前菜单归属于 ${resolveMenuOwner(editingMenu).label}，现在页面侧已禁止直接修改，请回到对应模块的 module.json 里维护。`"
        />

        <a-form :model="formState" :rules="formRules" ref="formRef" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="菜单标题" name="title">
                <a-input v-model:value="formState.title" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="菜单类型" name="menuType">
                <a-select v-model:value="formState.menuType">
                  <a-select-option value="internal">内部路由</a-select-option>
                  <a-select-option value="external">外部链接</a-select-option>
                  <a-select-option value="iframe">iframe嵌入</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item v-if="formState.menuType === 'internal'" label="路由路径" name="path">
            <a-input v-model:value="formState.path" placeholder="如: /user 或 /ai/chat" />
          </a-form-item>

          <template v-if="formState.menuType !== 'internal'">
            <a-form-item label="外部地址" name="externalUrl">
              <a-input v-model:value="formState.externalUrl" placeholder="https://example.com" />
            </a-form-item>
            <a-form-item label="打开方式" name="openMode">
              <a-radio-group v-model:value="formState.openMode">
                <a-radio value="blank">新窗口打开</a-radio>
                <a-radio value="iframe" v-if="formState.menuType === 'iframe'">iframe嵌入</a-radio>
              </a-radio-group>
            </a-form-item>
          </template>

          <a-form-item label="父菜单" name="parentId">
            <a-tree-select
              v-model:value="formState.parentId"
              :tree-data="parentMenuOptions"
              placeholder="选择父菜单（不选则为顶级菜单）"
              allow-clear
              :field-names="{ label: 'title', value: 'id', children: 'children' }"
            />
          </a-form-item>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="图标" name="icon">
                <a-input v-model:value="formState.icon" placeholder="如: UserOutlined" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="所属模块" name="moduleCode">
                <a-auto-complete
                  v-model:value="formState.moduleCode"
                  :options="moduleFilterOptions"
                  placeholder="优先选择已注册模块，留空则为手动菜单"
                  allow-clear
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="权限标识" name="permission">
                <a-input v-model:value="formState.permission" placeholder="如: user:view" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="排序" name="order">
                <a-input-number v-model:value="formState.order" :min="0" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="是否显示">
            <a-switch v-model:checked="formState.visible" />
          </a-form-item>
        </a-form>
      </a-space>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, markRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  UserOutlined,
  TeamOutlined,
  MenuOutlined,
  RobotOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
  DashboardOutlined,
  MessageOutlined,
  BookOutlined,
  HistoryOutlined,
  BarChartOutlined,
  ControlOutlined,
  LinkOutlined,
  GlobalOutlined,
} from '@ant-design/icons-vue'
import { menuApi } from '@/api/menu'
import { moduleApi, type ModuleSummary } from '@/api/module'
import type { MenuItem } from '@/types'

type OwnerFilter = 'all' | 'module' | 'core' | 'custom'
type MenuOwnerType = 'module' | 'code' | 'core' | 'custom'

interface MenuOwnerInfo {
  type: MenuOwnerType
  label: string
  color: string
  description: string
  moduleKey?: string
}

const route = useRoute()
const router = useRouter()

const SYSTEM_MENU_IDS = [
  'workbench',
  'ai-center',
  'data-center',
  'data-collection',
  'tools-center',
  'ops-management',
  'system-management',
  'user-management-menu',
  'role-management-menu',
  'menu-management-menu',
]

function isSystemMenu(menuId: string): boolean {
  return SYSTEM_MENU_IDS.includes(menuId)
}

const iconMap: Record<string, any> = {
  UserOutlined: markRaw(UserOutlined),
  TeamOutlined: markRaw(TeamOutlined),
  MenuOutlined: markRaw(MenuOutlined),
  RobotOutlined: markRaw(RobotOutlined),
  DatabaseOutlined: markRaw(DatabaseOutlined),
  SettingOutlined: markRaw(SettingOutlined),
  BellOutlined: markRaw(BellOutlined),
  DashboardOutlined: markRaw(DashboardOutlined),
  MessageOutlined: markRaw(MessageOutlined),
  BookOutlined: markRaw(BookOutlined),
  HistoryOutlined: markRaw(HistoryOutlined),
  BarChartOutlined: markRaw(BarChartOutlined),
  ControlOutlined: markRaw(ControlOutlined),
  LinkOutlined: markRaw(LinkOutlined),
  GlobalOutlined: markRaw(GlobalOutlined),
}

const loading = ref(false)
const menuTree = ref<MenuItem[]>([])
const modules = ref<ModuleSummary[]>([])
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingMenu = ref<MenuItem | null>(null)
const formRef = ref()
const searchText = ref('')
const ownerFilter = ref<OwnerFilter>('all')
const selectedModule = ref<string | undefined>(
  typeof route.query.module === 'string' ? route.query.module : undefined
)

const formState = reactive({
  title: '',
  path: '',
  icon: '',
  parentId: undefined as string | undefined,
  permission: '',
  order: 0,
  visible: true,
  menuType: 'internal' as 'internal' | 'external' | 'iframe',
  externalUrl: '',
  openMode: 'blank' as 'current' | 'blank' | 'iframe',
  moduleCode: '',
})

const moduleMap = computed(() => {
  const map = new Map<string, ModuleSummary>()
  for (const item of modules.value) {
    map.set(item.name, item)
  }
  return map
})

const moduleFilterOptions = computed(() =>
  modules.value
    .map(item => ({
      value: item.name,
      label: `${item.displayName || item.name} (${item.name})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
)

const activeModuleSummary = computed(() =>
  selectedModule.value ? moduleMap.value.get(selectedModule.value) : undefined
)

const flatMenus = computed(() => flattenMenus(menuTree.value))

const moduleManagedCount = computed(() =>
  flatMenus.value.filter(menu => {
    const owner = resolveMenuOwner(menu)
    return owner.type === 'module' || owner.type === 'code'
  }).length
)

const coreMenuCount = computed(() =>
  flatMenus.value.filter(menu => resolveMenuOwner(menu).type === 'core').length
)

const customMenuCount = computed(() =>
  flatMenus.value.filter(menu => resolveMenuOwner(menu).type === 'custom').length
)

const hasActiveFilters = computed(() =>
  !!searchText.value || ownerFilter.value !== 'all' || !!selectedModule.value
)

const parentMenuOptions = computed(() => {
  if (editingMenu.value) {
    return filterMenuOptions(menuTree.value, editingMenu.value.id)
  }
  return menuTree.value
})

const filteredMenuTree = computed(() =>
  filterMenuTree(menuTree.value, menu => matchesMenuFilters(menu))
)

const formRules = {
  title: [{ required: true, message: '请输入菜单标题' }],
}

const columns = [
  { title: '菜单标题', dataIndex: 'title', key: 'title', width: 180 },
  { title: '图标', key: 'icon', width: 60 },
  { title: '类型', key: 'menuType', width: 92 },
  { title: '路径/地址', key: 'pathOrUrl', ellipsis: true },
  { title: '模块归属', key: 'owner', width: 220 },
  { title: '管理方式', key: 'manageMode', width: 110 },
  { title: '排序', dataIndex: 'order', key: 'order', width: 70 },
  { title: '状态', key: 'visible', width: 90 },
  { title: '操作', key: 'action', width: 280 },
]

onMounted(() => {
  fetchModules()
  fetchMenuTree()
})

watch(
  () => route.query.module,
  value => {
    selectedModule.value = typeof value === 'string' ? value : undefined
  }
)

watch(selectedModule, value => {
  const current = typeof route.query.module === 'string' ? route.query.module : undefined
  if (current === value) {
    return
  }
  const query = { ...route.query }
  if (value) {
    query.module = value
  } else {
    delete query.module
  }
  router.replace({ query })
})

function flattenMenus(items: MenuItem[]): MenuItem[] {
  const list: MenuItem[] = []
  for (const item of items) {
    list.push(item)
    if (item.children?.length) {
      list.push(...flattenMenus(item.children))
    }
  }
  return list
}

function getRegisteredModule(menu: MenuItem) {
  const moduleKey = menu.moduleSource || menu.moduleCode
  if (!moduleKey) {
    return undefined
  }
  return moduleMap.value.get(moduleKey)
}

function resolveMenuOwner(menu: MenuItem): MenuOwnerInfo {
  const moduleKey = menu.moduleSource || menu.moduleCode
  const registeredModule = getRegisteredModule(menu)

  if (registeredModule) {
    return {
      type: 'module',
      label: registeredModule.displayName || registeredModule.name,
      color: 'blue',
      description: '由模块 manifest 注册并维护',
      moduleKey: registeredModule.name,
    }
  }

  if (moduleKey) {
    return {
      type: 'code',
      label: moduleKey,
      color: 'cyan',
      description: '携带模块代码，但未匹配到已注册模块',
      moduleKey,
    }
  }

  if (isSystemMenu(menu.id)) {
    return {
      type: 'core',
      label: '核心框架',
      color: 'gold',
      description: '框架级基础菜单或一级容器',
    }
  }

  return {
    type: 'custom',
    label: '手动菜单',
    color: 'default',
    description: '通过菜单管理页手动维护',
  }
}

function isRegisteredModuleMenu(menu: MenuItem) {
  return resolveMenuOwner(menu).type === 'module'
}

function getManagementMode(menu: MenuItem) {
  const owner = resolveMenuOwner(menu)
  if (owner.type === 'module') {
    return { label: '模块注册', color: 'blue' }
  }
  if (owner.type === 'code') {
    return { label: '扩展代码', color: 'cyan' }
  }
  if (owner.type === 'core') {
    return { label: '核心框架', color: 'gold' }
  }
  return { label: '手动维护', color: 'default' }
}

function matchesMenuFilters(menu: MenuItem) {
  const owner = resolveMenuOwner(menu)
  const keyword = searchText.value.trim().toLowerCase()
  const keywordMatch = !keyword || [
    menu.title,
    menu.path,
    menu.externalUrl,
    menu.permission,
    owner.label,
    owner.moduleKey,
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(keyword))

  const moduleMatch = !selectedModule.value || owner.moduleKey === selectedModule.value

  const ownerMatch =
    ownerFilter.value === 'all' ||
    (ownerFilter.value === 'module' && (owner.type === 'module' || owner.type === 'code')) ||
    (ownerFilter.value === 'core' && owner.type === 'core') ||
    (ownerFilter.value === 'custom' && owner.type === 'custom')

  return keywordMatch && moduleMatch && ownerMatch
}

function filterMenuTree(items: MenuItem[], matcher: (item: MenuItem) => boolean): MenuItem[] {
  return items
    .map(item => {
      const nextChildren = item.children?.length ? filterMenuTree(item.children, matcher) : []
      if (matcher(item) || nextChildren.length > 0) {
        return {
          ...item,
          children: nextChildren.length > 0 ? nextChildren : undefined,
        }
      }
      return null
    })
    .filter((item): item is MenuItem => item !== null)
}

function filterMenuOptions(menus: MenuItem[], excludeId: string): MenuItem[] {
  return menus
    .filter(m => m.id !== excludeId)
    .map(m => ({
      ...m,
      children: m.children ? filterMenuOptions(m.children, excludeId) : undefined,
    }))
}

async function fetchModules() {
  try {
    const res = await moduleApi.getModules()
    if (res.success && res.data) {
      modules.value = res.data
    }
  } catch (error) {
    message.warning('模块列表加载失败，模块归属信息可能不完整')
  }
}

async function fetchMenuTree() {
  loading.value = true
  try {
    const res = await menuApi.getFullMenuTree()
    if (res.success && res.data) {
      menuTree.value = buildTree(res.data)
    }
  } catch (error) {
    menuTree.value = []
    message.error('获取菜单数据失败')
  } finally {
    loading.value = false
  }
}

function buildTree(data: MenuItem[]) {
  if (data.some(item => item.children && item.children.length > 0)) {
    return data
  }

  const map = new Map<string, MenuItem>()
  const items = JSON.parse(JSON.stringify(data))

  items.forEach((item: MenuItem & { children?: MenuItem[] }) => {
    if (!item.children) item.children = []
    map.set(item.id, item)
  })

  const tree: MenuItem[] = []

  items.forEach((item: MenuItem & { children?: MenuItem[] }) => {
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!
      parent.children!.push(item)
    } else {
      tree.push(item)
    }
  })

  if (tree.length === 0 && items.length > 0) {
    return data
  }

  return tree
}

function getIcon(iconName: string) {
  return iconMap[iconName] || null
}

function getMenuTypeColor(type: string) {
  const colors: Record<string, string> = {
    internal: 'blue',
    external: 'orange',
    iframe: 'purple',
  }
  return colors[type] || 'default'
}

function getMenuTypeLabel(type: string) {
  const labels: Record<string, string> = {
    internal: '内部',
    external: '外链',
    iframe: 'iframe',
  }
  return labels[type] || type || '内部'
}

function clearFilters() {
  searchText.value = ''
  ownerFilter.value = 'all'
  selectedModule.value = undefined
}

function handleAdd(parent?: MenuItem) {
  if (parent && isRegisteredModuleMenu(parent)) {
    message.warning('模块注册菜单请在对应模块的 module.json 中新增子菜单')
    return
  }

  editingMenu.value = null
  Object.assign(formState, {
    title: '',
    path: '',
    icon: '',
    parentId: parent?.id || undefined,
    permission: '',
    order: 0,
    visible: true,
    menuType: 'internal',
    externalUrl: '',
    openMode: 'blank',
    moduleCode: parent?.moduleSource || parent?.moduleCode || selectedModule.value || '',
  })
  modalVisible.value = true
}

function handleEdit(record: MenuItem) {
  if (isRegisteredModuleMenu(record)) {
    message.warning('模块注册菜单请在对应模块的 module.json 中维护')
    return
  }

  editingMenu.value = record
  Object.assign(formState, {
    title: record.title,
    path: record.path || '',
    icon: record.icon || '',
    parentId: record.parentId || undefined,
    permission: record.permission || '',
    order: record.order || 0,
    visible: record.visible,
    menuType: record.menuType || 'internal',
    externalUrl: record.externalUrl || '',
    openMode: record.openMode || 'blank',
    moduleCode: record.moduleSource || record.moduleCode || '',
  })
  modalVisible.value = true
}

function viewModule(record: MenuItem) {
  const moduleKey = resolveMenuOwner(record).moduleKey
  if (!moduleKey) {
    return
  }
  router.push({
    name: 'ModuleManagement',
    query: { module: moduleKey },
  })
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()

    if (editingMenu.value && isRegisteredModuleMenu(editingMenu.value)) {
      message.warning('模块注册菜单请在对应模块的 module.json 中维护')
      return
    }

    if (formState.moduleCode && moduleMap.value.has(formState.moduleCode)) {
      message.warning(`已注册模块 ${formState.moduleCode} 的菜单请直接写入对应 module.json`)
      return
    }

    if (formState.parentId) {
      const parent = flatMenus.value.find(item => item.id === formState.parentId)
      if (parent && isRegisteredModuleMenu(parent)) {
        message.warning('不能把手动菜单挂到模块注册菜单下，请改对应模块的 module.json')
        return
      }
    }

    modalLoading.value = true

    const data = {
      ...formState,
      moduleCode: formState.moduleCode || undefined,
    }

    if (editingMenu.value) {
      await menuApi.update(editingMenu.value.id, data)
      message.success('更新成功')
    } else {
      await menuApi.create(data)
      message.success('创建成功')
    }

    modalVisible.value = false
    fetchMenuTree()
  } catch (error) {
    // 表单验证失败时由组件自己展示提示
  } finally {
    modalLoading.value = false
  }
}

async function handleDelete(record: MenuItem) {
  try {
    await menuApi.delete(record.id)
    message.success('删除成功')
    fetchMenuTree()
  } catch (error) {
    message.error('删除失败')
  }
}
</script>

<style scoped>
.menu-management {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.page-desc {
  margin: 6px 0 0;
  color: rgba(0, 0, 0, 0.45);
}

.stat-row {
  margin-bottom: 16px;
}

.table-toolbar {
  margin-bottom: 16px;
}

.filter-alert {
  margin-bottom: 16px;
}

.owner-cell {
  min-height: 32px;
}

.owner-hint {
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.4;
}
</style>
