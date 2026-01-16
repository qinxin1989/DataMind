<template>
  <div class="profile-page">
    <a-card title="个人设置" :bordered="false">
      <a-tabs>
        <a-tab-pane key="info" tab="基本信息">
          <a-form :model="form" :label-col="{ span: 4 }" :wrapper-col="{ span: 12 }">
            <a-form-item label="用户名">
              <a-input v-model:value="form.username" disabled />
            </a-form-item>
            <a-form-item label="邮箱">
              <a-input v-model:value="form.email" />
            </a-form-item>
            <a-form-item label="姓名">
              <a-input v-model:value="form.fullName" />
            </a-form-item>
            <a-form-item label="角色">
              <a-input v-model:value="form.role" disabled />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }">
              <a-space>
                <a-button type="primary" @click="handleUpdateInfo" :loading="updating">
                  保存修改
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="password" tab="修改密码">
          <a-form :model="passwordForm" :label-col="{ span: 4 }" :wrapper-col="{ span: 12 }">
            <a-form-item label="当前密码">
              <a-input-password v-model:value="passwordForm.oldPassword" />
            </a-form-item>
            <a-form-item label="新密码">
              <a-input-password v-model:value="passwordForm.newPassword" />
            </a-form-item>
            <a-form-item label="确认密码">
              <a-input-password v-model:value="passwordForm.confirmPassword" />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4 }">
              <a-space>
                <a-button type="primary" @click="handleChangePassword" :loading="changingPassword">
                  修改密码
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { post } from '@/api/request'

const userStore = useUserStore()

const form = ref({
  username: '',
  email: '',
  fullName: '',
  role: ''
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const updating = ref(false)
const changingPassword = ref(false)

onMounted(() => {
  form.value = {
    username: userStore.username || '',
    email: userStore.email || '',
    fullName: userStore.fullName || '',
    role: userStore.role || ''
  }
})

async function handleUpdateInfo() {
  updating.value = true
  try {
    // TODO: 调用更新用户信息的API
    message.success('信息更新成功')
  } catch (error: any) {
    message.error(error.message || '更新失败')
  } finally {
    updating.value = false
  }
}

async function handleChangePassword() {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) {
    message.error('请填写完整信息')
    return
  }

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    message.error('两次输入的密码不一致')
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    message.error('密码长度至少6位')
    return
  }

  changingPassword.value = true
  try {
    await post('/auth/change-password', {
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword
    })
    message.success('密码修改成功')
    passwordForm.value = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } catch (error: any) {
    message.error(error.message || '修改失败')
  } finally {
    changingPassword.value = false
  }
}
</script>

<style scoped>
.profile-page {
  max-width: 1200px;
}
</style>
