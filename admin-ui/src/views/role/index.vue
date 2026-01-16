<template>
  <div class="role-management">
    <div class="page-header">
      <h1>角色管理</h1>
    </div>

    <div class="table-toolbar">
      <a-button type="primary" @click="handleAdd" v-permission="'role:create'">
        <template #icon><PlusOutlined /></template>
        新增角色
      </a-button>
    </div>

    <a-table :columns="columns" :data-source="roles" :loading="loading" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'red'">
            {{ record.status === 'active' ? '启用' : '禁用' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'isSystem'">
          <a-tag v-if="record.isSystem" color="blue">系统内置</a-tag>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'permissions'">
          <a-tag v-for="perm in record.permissionCodes.slice(0, 3)" :key="perm">
            {{ perm }}
          </a-tag>
          <a-tag v-if="record.permissionCodes.length > 3">
            +{{ record.permissionCodes.length - 3 }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleEdit(record)" v-permission="'role:update'">
              编辑
            </a-button>
            <a-button type="link" size="small" @click="handlePermission(record)" v-permission="'role:update'">
              权限配置
            </a-button>
            <a-popconfirm
              v-if="!record.isSystem"
              title="确定删除该角色？"
              @confirm="handleDelete(record)"
              v-permission="'role:delete'"
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
      :title="editingRole ? '编辑角色' : '新增角色'"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
    >
      <a-form :model="formState" :rules="formRules" ref="formRef" layout="vertical">
        <a-form-item label="角色名称" name="name">
          <a-input v-model:value="formState.name" />
        </a-form-item>
        <a-form-item label="角色编码" name="code">
          <a-input v-model:value="formState.code" :disabled="!!editingRole" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="formState.description" :rows="3" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-select v-model:value="formState.status">
            <a-select-option value="active">启用</a-select-option>
            <a-select-option value="inactive">禁用</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 权限配置弹窗 -->
    <a-modal
      v-model:open="permModalVisible"
      title="权限配置"
      width="600px"
      @ok="handlePermModalOk"
      :confirmLoading="permModalLoading"
    >
      <a-tabs v-model:activeKey="permTabKey">
        <a-tab-pane key="permission" tab="功能权限">
          <a-tree
            v-model:checkedKeys="checkedPermissions"
            :tree-data="permissionTree"
            checkable
            :selectable="false"
          />
        </a-tab-pane>
        <a-tab-pane key="menu" tab="菜单权限">
          <a-spin :spinning="menuLoading">
            <a-tree
              v-model:checkedKeys="checkedMenus"
              :tree-data="menuTree"
              checkable
              :selectable="false"
              :field-names="{ title: 'title', key: 'id', children: 'children' }"
            />
          </a-spin>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { roleApi } from '@/api/role'
import { menuApi } from '@/api/menu'
import type { Role, MenuItem } from '@/types'

const loading = ref(false)
const roles = ref<Role[]>([])
const modalVisible = ref(false)
const modalLoading = ref(false)
const permModalVisible = ref(false)
const permModalLoading = ref(false)
const menuLoading = ref(false)
const editingRole = ref<Role | null>(null)
const formRef = ref()
const checkedPermissions = ref<string[]>([])
const checkedMenus = ref<string[]>([])
const menuTree = ref<MenuItem[]>([])
const permTabKey = ref('permission')

const formState = reactive({
  name: '',
  code: '',
  description: '',
  status: 'active' as 'active' | 'inactive',
})

const formRules = {
  name: [{ required: true, message: '请输入角色名称' }],
  code: [{ required: true, message: '请输入角色编码' }],
}

const columns = [
  { title: '角色名称', dataIndex: 'name', key: 'name' },
  { title: '角色编码', dataIndex: 'code', key: 'code' },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '权限', key: 'permissions' },
  { title: '类型', key: 'isSystem' },
  { title: '状态', key: 'status' },
  { title: '操作', key: 'action', width: 220 },
]

const permissionTree = ref([
  {
    title: '用户管理',
    key: 'user',
    children: [
      { title: '查看用户', key: 'user:view' },
      { title: '创建用户', key: 'user:create' },
      { title: '编辑用户', key: 'user:update' },
      { title: '删除用户', key: 'user:delete' },
    ],
  },
  {
    title: '角色管理',
    key: 'role',
    children: [
      { title: '查看角色', key: 'role:view' },
      { title: '创建角色', key: 'role:create' },
      { title: '编辑角色', key: 'role:update' },
      { title: '删除角色', key: 'role:delete' },
    ],
  },
  {
    title: '菜单管理',
    key: 'menu',
    children: [
      { title: '查看菜单', key: 'menu:view' },
      { title: '编辑菜单', key: 'menu:update' },
    ],
  },
  {
    title: 'AI管理',
    key: 'ai',
    children: [
      { title: '查看配置', key: 'ai:config:view' },
      { title: '编辑配置', key: 'ai:config:update' },
      { title: '查看统计', key: 'ai:stats:view' },
      { title: '查看历史', key: 'ai:history:view' },
    ],
  },
  {
    title: '数据源管理',
    key: 'datasource',
    children: [
      { title: '查看数据源', key: 'datasource:view' },
      { title: '创建数据源', key: 'datasource:create' },
      { title: '编辑数据源', key: 'datasource:update' },
      { title: '删除数据源', key: 'datasource:delete' },
    ],
  },
  {
    title: '系统管理',
    key: 'system',
    children: [
      { title: '查看配置', key: 'system:config:view' },
      { title: '编辑配置', key: 'system:config:update' },
      { title: '查看状态', key: 'system:status:view' },
      { title: '备份恢复', key: 'system:backup:view' },
      { title: '查看审计', key: 'audit:view' },
    ],
  },
])

onMounted(() => {
  fetchRoles()
})

async function fetchRoles() {
  loading.value = true
  try {
    const res = await roleApi.getList()
    if (res.success && res.data) {
      roles.value = res.data
    }
  } catch (error) {
    // 使用模拟数据
    roles.value = [
      { id: '1', name: '超级管理员', code: 'super_admin', description: '拥有所有权限', permissionCodes: ['*'], status: 'active', isSystem: true, createdAt: Date.now(), updatedAt: Date.now() },
      { id: '2', name: '普通管理员', code: 'admin', description: '管理用户和数据源', permissionCodes: ['user:view', 'user:create', 'datasource:view'], status: 'active', isSystem: false, createdAt: Date.now(), updatedAt: Date.now() },
    ]
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  editingRole.value = null
  Object.assign(formState, { name: '', code: '', description: '', status: 'active' })
  modalVisible.value = true
}

function handleEdit(record: Role) {
  editingRole.value = record
  Object.assign(formState, record)
  modalVisible.value = true
}

function handlePermission(record: Role) {
  editingRole.value = record
  checkedPermissions.value = [...record.permissionCodes]
  checkedMenus.value = record.menuIds || []
  permTabKey.value = 'permission'
  permModalVisible.value = true
  fetchMenuTree()
}

async function fetchMenuTree() {
  menuLoading.value = true
  try {
    const res = await menuApi.getFullMenuTree()
    if (res.success && res.data) {
      menuTree.value = res.data
    }
  } catch (error) {
    menuTree.value = []
  } finally {
    menuLoading.value = false
  }
}

async function handleModalOk() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    
    if (editingRole.value) {
      await roleApi.update(editingRole.value.id, formState)
      message.success('更新成功')
    } else {
      await roleApi.create(formState)
      message.success('创建成功')
    }
    
    modalVisible.value = false
    fetchRoles()
  } catch (error) {
    // 验证失败
  } finally {
    modalLoading.value = false
  }
}

async function handlePermModalOk() {
  if (!editingRole.value) return
  
  permModalLoading.value = true
  try {
    await roleApi.update(editingRole.value.id, {
      permissionCodes: checkedPermissions.value,
      menuIds: checkedMenus.value,
    })
    message.success('权限配置成功')
    permModalVisible.value = false
    fetchRoles()
  } catch (error) {
    message.error('权限配置失败')
  } finally {
    permModalLoading.value = false
  }
}

async function handleDelete(record: Role) {
  try {
    await roleApi.delete(record.id)
    message.success('删除成功')
    fetchRoles()
  } catch (error) {
    message.error('删除失败')
  }
}
</script>

<style scoped>
.role-management {
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
