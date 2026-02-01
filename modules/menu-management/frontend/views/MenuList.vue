<template>
  <div class="menu-management">
    <div class="page-header">
      <h1>菜单管理</h1>
    </div>

    <div class="table-toolbar">
      <a-space>
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          新增菜单
        </a-button>
        <a-button @click="handleRefresh">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </a-space>
      
      <a-space>
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索菜单名称"
          style="width: 250px"
          @search="handleSearch"
        />
      </a-space>
    </div>

    <a-table 
      :columns="columns" 
      :data-source="menuTree" 
      :loading="loading" 
      :pagination="false"
      row-key="id"
      :default-expand-all-rows="true"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'title'">
          <a-space>
            <component :is="record.icon" v-if="record.icon" />
            <span>{{ record.title }}</span>
          </a-space>
        </template>
        <template v-else-if="column.key === 'menuType'">
          <a-tag v-if="record.menuType === 'internal'" color="blue">内部路由</a-tag>
          <a-tag v-else-if="record.menuType === 'external'" color="green">外部链接</a-tag>
          <a-tag v-else-if="record.menuType === 'iframe'" color="orange">iframe嵌入</a-tag>
        </template>
        <template v-else-if="column.key === 'visible'">
          <a-switch 
            :checked="record.visible" 
            @change="handleToggleVisibility(record)"
            :loading="record.id === toggleLoadingId"
          />
        </template>
        <template v-else-if="column.key === 'isSystem'">
          <a-tag v-if="record.isSystem" color="blue">系统内置</a-tag>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleEdit(record)">
              编辑
            </a-button>
            <a-button type="link" size="small" @click="handleAddChild(record)">
              添加子菜单
            </a-button>
            <a-popconfirm
              v-if="!record.isSystem"
              title="确定删除该菜单？删除后子菜单也会被删除"
              @confirm="handleDelete(record)"
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
        <a-form-item label="菜单标题" name="title">
          <a-input v-model:value="formState.title" placeholder="请输入菜单标题" />
        </a-form-item>
        
        <a-form-item label="菜单类型" name="menuType">
          <a-radio-group v-model:value="formState.menuType">
            <a-radio value="internal">内部路由</a-radio>
            <a-radio value="external">外部链接</a-radio>
            <a-radio value="iframe">iframe嵌入</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item 
          v-if="formState.menuType === 'internal'" 
          label="路由路径" 
          name="path"
        >
          <a-input v-model:value="formState.path" placeholder="/example" />
        </a-form-item>

        <a-form-item 
          v-if="formState.menuType !== 'internal'" 
          label="外部链接" 
          name="externalUrl"
        >
          <a-input v-model:value="formState.externalUrl" placeholder="https://example.com" />
        </a-form-item>

        <a-form-item 
          v-if="formState.menuType !== 'internal'" 
          label="打开方式" 
          name="openMode"
        >
          <a-select v-model:value="formState.openMode">
            <a-select-option value="current">当前窗口</a-select-option>
            <a-select-option value="blank">新窗口</a-select-option>
            <a-select-option value="iframe">iframe</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="图标" name="icon">
          <a-input v-model:value="formState.icon" placeholder="HomeOutlined" />
        </a-form-item>

        <a-form-item label="父菜单" name="parentId">
          <a-tree-select
            v-model:value="formState.parentId"
            :tree-data="parentMenuOptions"
            placeholder="选择父菜单(不选则为顶级菜单)"
            allow-clear
            :field-names="{ label: 'title', value: 'id', children: 'children' }"
          />
        </a-form-item>

        <a-form-item label="排序" name="order">
          <a-input-number v-model:value="formState.order" :min="0" style="width: 100%" />
        </a-form-item>

        <a-form-item label="权限代码" name="permission">
          <a-input v-model:value="formState.permission" placeholder="menu:view" />
        </a-form-item>

        <a-form-item label="模块代码" name="moduleCode">
          <a-input v-model:value="formState.moduleCode" placeholder="system" />
        </a-form-item>

        <a-form-item label="是否可见" name="visible">
          <a-switch v-model:checked="formState.visible" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { menuApi } from '../api'
import type { Menu } from '../../backend/types'

const loading = ref(false)
const menuTree = ref<Menu[]>([])
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingMenu = ref<Menu | null>(null)
const formRef = ref()
const searchKeyword = ref('')
const toggleLoadingId = ref<string>('')

const formState = reactive({
  title: '',
  path: '',
  icon: '',
  parentId: undefined as string | undefined,
  order: 0,
  visible: true,
  permission: '',
  menuType: 'internal' as 'internal' | 'external' | 'iframe',
  externalUrl: '',
  openMode: 'current' as 'current' | 'blank' | 'iframe',
  moduleCode: '',
})

const formRules = {
  title: [{ required: true, message: '请输入菜单标题' }],
  path: [{ 
    required: computed(() => formState.menuType === 'internal'), 
    message: '请输入路由路径' 
  }],
  externalUrl: [{ 
    required: computed(() => formState.menuType !== 'internal'), 
    message: '请输入外部链接' 
  }],
}

const columns = [
  { title: '菜单名称', dataIndex: 'title', key: 'title', width: 200 },
  { title: '路径', dataIndex: 'path', key: 'path' },
  { title: '类型', key: 'menuType', width: 100 },
  { title: '图标', dataIndex: 'icon', key: 'icon', width: 120 },
  { title: '排序', dataIndex: 'order', key: 'order', width: 80 },
  { title: '权限代码', dataIndex: 'permission', key: 'permission', width: 150 },
  { title: '可见', key: 'visible', width: 80 },
  { title: '类型', key: 'isSystem', width: 100 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' },
]

const parentMenuOptions = computed(() => {
  // 如果是编辑模式,需要排除当前菜单及其子菜单
  if (editingMenu.value) {
    return filterMenuOptions(menuTree.value, editingMenu.value.id)
  }
  return menuTree.value
})

function filterMenuOptions(menus: Menu[], excludeId: string): Menu[] {
  return menus
    .filter(m => m.id !== excludeId)
    .map(m => ({
      ...m,
      children: m.children ? filterMenuOptions(m.children, excludeId) : undefined,
    }))
}

onMounted(() => {
  fetchMenus()
})

async function fetchMenus() {
  loading.value = true
  try {
    const res = await menuApi.getTree()
    if (res.success && res.data) {
      menuTree.value = res.data
    }
  } catch (error: any) {
    message.error(error.message || '获取菜单列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  // 简单的前端搜索
  if (!searchKeyword.value) {
    fetchMenus()
    return
  }
  // TODO: 实现搜索逻辑
}

function handleRefresh() {
  fetchMenus()
}

function handleAdd() {
  editingMenu.value = null
  Object.assign(formState, {
    title: '',
    path: '',
    icon: '',
    parentId: undefined,
    order: 0,
    visible: true,
    permission: '',
    menuType: 'internal',
    externalUrl: '',
    openMode: 'current',
    moduleCode: '',
  })
  modalVisible.value = true
}

function handleAddChild(record: Menu) {
  editingMenu.value = null
  Object.assign(formState, {
    title: '',
    path: '',
    icon: '',
    parentId: record.id,
    order: 0,
    visible: true,
    permission: '',
    menuType: 'internal',
    externalUrl: '',
    openMode: 'current',
    moduleCode: '',
  })
  modalVisible.value = true
}

function handleEdit(record: Menu) {
  editingMenu.value = record
  Object.assign(formState, {
    title: record.title,
    path: record.path || '',
    icon: record.icon || '',
    parentId: record.parentId,
    order: record.order,
    visible: record.visible,
    permission: record.permission || '',
    menuType: record.menuType,
    externalUrl: record.externalUrl || '',
    openMode: record.openMode,
    moduleCode: record.moduleCode || '',
  })
  modalVisible.value = true
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    
    if (editingMenu.value) {
      await menuApi.update(editingMenu.value.id, formState)
      message.success('更新成功')
    } else {
      await menuApi.create(formState)
      message.success('创建成功')
    }
    
    modalVisible.value = false
    fetchMenus()
  } catch (error: any) {
    if (error.errorFields) return
    message.error(error.message || '操作失败')
  } finally {
    modalLoading.value = false
  }
}

async function handleToggleVisibility(record: Menu) {
  toggleLoadingId.value = record.id
  try {
    await menuApi.toggleVisibility(record.id)
    message.success('可见性已更新')
    fetchMenus()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    toggleLoadingId.value = ''
  }
}

async function handleDelete(record: Menu) {
  try {
    await menuApi.delete(record.id)
    message.success('删除成功')
    fetchMenus()
  } catch (error: any) {
    message.error(error.message || '删除失败')
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
