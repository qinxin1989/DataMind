<template>
  <a-modal
    :open="visible"
    :title="user ? '编辑用户' : '新增用户'"
    @ok="handleOk"
    @cancel="handleCancel"
    :confirmLoading="loading"
  >
    <a-form :model="formState" :rules="formRules" ref="formRef" layout="vertical">
      <a-form-item label="用户名" name="username">
        <a-input v-model:value="formState.username" :disabled="!!user" />
      </a-form-item>
      <a-form-item label="邮箱" name="email">
        <a-input v-model:value="formState.email" />
      </a-form-item>
      <a-form-item label="姓名" name="fullName">
        <a-input v-model:value="formState.fullName" />
      </a-form-item>
      <a-form-item v-if="!user" label="密码" name="password">
        <a-input-password v-model:value="formState.password" />
      </a-form-item>
      <a-form-item label="角色" name="role">
        <a-select v-model:value="formState.role">
          <a-select-option value="admin">管理员</a-select-option>
          <a-select-option value="user">普通用户</a-select-option>
          <a-select-option value="viewer">只读用户</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="状态" name="status">
        <a-select v-model:value="formState.status">
          <a-select-option value="active">正常</a-select-option>
          <a-select-option value="inactive">禁用</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { message } from 'ant-design-vue';
import { userApi, type User } from '../api';

const props = defineProps<{
  visible: boolean;
  user: User | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}>();

const loading = ref(false);
const formRef = ref();

const formState = reactive({
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'user' as 'admin' | 'user' | 'viewer',
  status: 'active' as 'active' | 'inactive',
});

const formRules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色' }],
};

watch(() => props.visible, (val) => {
  if (val) {
    if (props.user) {
      Object.assign(formState, { ...props.user, password: '' });
    } else {
      Object.assign(formState, {
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: 'user',
        status: 'active',
      });
    }
  }
});

async function handleOk() {
  try {
    await formRef.value?.validate();
    loading.value = true;
    
    if (props.user) {
      await userApi.update(props.user.id, formState);
      message.success('更新成功');
    } else {
      await userApi.create(formState);
      message.success('创建成功');
    }
    
    emit('success');
  } catch (error) {
    // 验证失败或API错误
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  emit('update:visible', false);
}
</script>
