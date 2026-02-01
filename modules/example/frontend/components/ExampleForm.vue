<template>
  <a-modal
    :visible="visible"
    :title="isEdit ? '编辑示例' : '新建示例'"
    :confirm-loading="loading"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
    >
      <a-form-item label="标题" name="title">
        <a-input v-model:value="formData.title" placeholder="请输入标题" />
      </a-form-item>

      <a-form-item label="描述" name="description">
        <a-textarea
          v-model:value="formData.description"
          placeholder="请输入描述"
          :rows="4"
        />
      </a-form-item>

      <a-form-item label="状态" name="status">
        <a-select v-model:value="formData.status" placeholder="请选择状态">
          <a-select-option value="active">激活</a-select-option>
          <a-select-option value="inactive">未激活</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { FormInstance } from 'ant-design-vue';
import { exampleApi } from '../api';
import type { ExampleItem, CreateExampleDto, UpdateExampleDto } from '../../backend/types';

interface Props {
  visible: boolean;
  record?: ExampleItem;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formRef = ref<FormInstance>();
const loading = ref(false);

const isEdit = computed(() => !!props.record);

const formData = reactive<CreateExampleDto & { id?: string }>({
  title: '',
  description: '',
  status: 'active'
});

const rules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { max: 200, message: '标题不能超过200个字符', trigger: 'blur' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
};

// 监听 record 变化
watch(
  () => props.record,
  (record) => {
    if (record) {
      formData.id = record.id;
      formData.title = record.title;
      formData.description = record.description || '';
      formData.status = record.status;
    } else {
      formData.id = undefined;
      formData.title = '';
      formData.description = '';
      formData.status = 'active';
    }
  },
  { immediate: true }
);

// 提交
const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    
    loading.value = true;
    
    if (isEdit.value && formData.id) {
      const updateDto: UpdateExampleDto = {
        title: formData.title,
        description: formData.description,
        status: formData.status
      };
      await exampleApi.update(formData.id, updateDto);
      message.success('更新成功');
    } else {
      const createDto: CreateExampleDto = {
        title: formData.title,
        description: formData.description,
        status: formData.status
      };
      await exampleApi.create(createDto);
      message.success('创建成功');
    }
    
    emit('success');
  } catch (error: any) {
    if (error.errorFields) {
      // 表单验证错误
      return;
    }
    message.error(error.message || '操作失败');
  } finally {
    loading.value = false;
  }
};

// 取消
const handleCancel = () => {
  emit('update:visible', false);
  formRef.value?.resetFields();
};
</script>
