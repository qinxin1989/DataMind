<template>
  <div class="menu-management">
    <div class="page-header">
      <h1>菜单管理</h1>
    </div>

    <div class="table-toolbar">
      <a-button type="primary" @click="handleAdd()" v-permission="'menu:update'">
        <template #icon><PlusOutlined /></template>
        新增菜单
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="menuTree"
      :loading="loading"
      row-key="id"
      :defaultExpandAllRows="true"
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
        <template v-else-if="column.key === 'visible'">
          <a-tag :color="record.visible ? 'green' : 'red'">
            {{ record.visible ? '显示' : '隐藏' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleAdd(record)" v-permission="'menu:update'">
              添加子菜单
            </a-button>
            <a-button type="link" size="small" @click="handleEdit(record)" v-permission="'menu:update'">
              编辑
            </a-button>
            <a-popconfirm
              v-if="!record.isSystem"
              title="确定删除该菜单？"
              @confirm="handleDelete(record)"
              v-permission="'menu:update'"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingMenu ? '编辑菜单' : '新增菜单'"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
      width="600px"
    >
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

        <!-- 内部路由 -->
        <a-form-item v-if="formState.menuType === 'internal'" label="路由路径" name="path">
          <a-input v-model:value="formState.path" placeholder="如: /user 或 /ai/chat" />
        </a-form-item>

        <!-- 外部链接/iframe -->
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

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="图标" name="icon">
              <a-input v-model:value="formState.icon" placeholder="如: UserOutlined" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模块代码" name="moduleCode">
              <a-input v-model:value="formState.moduleCode" placeholder="用于区分不同平台" />
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
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, markRaw } from 'vue'
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
import type { MenuItem } from '@/types'

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
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingMenu = ref<MenuItem | null>(null)
const parentMenu = ref<MenuItem | null>(null)
const formRef = ref()

const formState = reactive({
  title: '',
  path: '',
  icon: '',
  permission: '',
  order: 0,
  visible: true,
  menuType: 'internal' as 'internal' | 'external' | 'iframe',
  externalUrl: '',
  openMode: 'blank' as 'current' | 'blank' | 'iframe',
  moduleCode: '',
})

const formRules = {
  title: [{ required: true, message: '请输入菜单标题' }],
}

const columns = [
  { title: '菜单标题', dataIndex: 'title', key: 'title' },
  { title: '图标', key: 'icon', width: 60 },
  { title: '类型', key: 'menuType', width: 100 },
  { title: '路径/地址', key: 'pathOrUrl' },
  { title: '模块', dataIndex: 'moduleCode', key: 'moduleCode', width: 100 },
  { title: '排序', dataIndex: 'order', key: 'order', width: 60 },
  { title: '状态', key: 'visible', width: 70 },
  { title: '操作', key: 'action', width: 200 },
]

onMounted(() => {
  fetchMenuTree()
})

async function fetchMenuTree() {
  loading.value = true
  try {
    const res = await menuApi.getFullMenuTree()
    if (res.success && res.data) {
      menuTree.value = res.data
    }
  } catch (error) {
    menuTree.value = []
  } finally {
    loading.value = false
  }
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

function handleAdd(parent?: MenuItem) {
  editingMenu.value = null
  parentMenu.value = parent || null
  Object.assign(formState, {
    title: '',
    path: '',
    icon: '',
    permission: '',
    order: 0,
    visible: true,
    menuType: 'internal',
    externalUrl: '',
    openMode: 'blank',
    moduleCode: '',
  })
  modalVisible.value = true
}

function handleEdit(record: MenuItem) {
  editingMenu.value = record
  parentMenu.value = null
  Object.assign(formState, {
    title: record.title,
    path: record.path || '',
    icon: record.icon || '',
    permission: record.permission || '',
    order: record.order || 0,
    visible: record.visible,
    menuType: record.menuType || 'internal',
    externalUrl: record.externalUrl || '',
    openMode: record.openMode || 'blank',
    moduleCode: record.moduleCode || '',
  })
  modalVisible.value = true
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    
    const data = {
      ...formState,
      parentId: parentMenu.value?.id || editingMenu.value?.parentId,
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
    // 验证失败
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
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.table-toolbar {
  margin-bottom: 16px;
}
</style>
