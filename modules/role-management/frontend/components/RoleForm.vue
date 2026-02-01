<template>
  <a-form :model="formData" :rules="rules" ref="formRef" layout="vertical">
    <a-form-item label="角色名称" name="name">
      <a-input v-model:value="formData.name" placeholder="请输入角色名称" />
    </a-form-item>
    
    <a-form-item label="角色编码" name="code">
      <a-input 
        v-model:value="formData.code" 
        placeholder="请输入角色编码（如：admin）"
        :disabled="isEdit"
      />
    </a-form-item>
    
    <a-form-item label="描述" name="description">
      <a-textarea 
        v-model:value="formData.description" 
        placeholder="请输入角色描述"
        :rows="3"
      />
    </a-form-item>
    
    <a-form-item label="状态" name="status">
      <a-radio-group v-model:value="formData.status">
        <a-radio value="active">启用</a-radio>
        <a-radio value="inactive">禁用</a-radio>
      </a-radio-group>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { Role } from '../../backend/types'

interface Props {
  role?: Role | null
}

const props = defineProps<Props>()
const emit = defineEmits(['submit'])

const formRef = ref()
const isEdit = ref(false)

const formData = reactive({
  name: '',
  code: '',
  description: '',
  status: 'active' as 'active' | 'inactive',
})

const rules = {
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { min: 2, max: 50, message: '角色名称长度为2-50个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '角色编码只能包含小写字母、数字和下划线，且以字母开头', trigger: 'blur' },
  ],
}

watch(() => props.role, (role) => {
  if (role) {
    isEdit.value = true
    Object.assign(formData, {
      name: role.name,
      code: role.code,
      description: role.description || '',
      status: role.status,
    })
  } else {
    isEdit.value = false
    Object.assign(formData, {
      name: '',
      code: '',
      description: '',
      status: 'active',
    })
  }
}, { immediate: true })

async function validate() {
  return await formRef.value?.validate()
}

function getData() {
  return { ...formData }
}

defineExpose({
  validate,
  getData,
})
</script>
