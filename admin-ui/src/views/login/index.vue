<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>AI 数据平台</h1>
      </div>
      <a-form
        :model="formState"
        :rules="rules"
        @finish="handleLogin"
        layout="vertical"
      >
        <a-form-item name="username">
          <a-input
            v-model:value="formState.username"
            size="large"
            placeholder="用户名"
          >
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="password">
          <a-input-password
            v-model:value="formState.password"
            size="large"
            placeholder="密码"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" size="large" block :loading="loading">
            登录
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { post } from '@/api/request'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const loading = ref(false)
const formState = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码' }],
}

async function handleLogin() {
  loading.value = true
  try {
    // 调用登录API - 后台直接返回 { user, token }
    const res = await post<{ token: string; user: any }>('/auth/login', formState) as any
    
    // 后台直接返回数据，不是包装在 success/data 中
    const token = res.token || res.data?.token
    const user = res.user || res.data?.user
    
    if (token && user) {
      userStore.setToken(token)
      userStore.setUser({
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        roleIds: [user.role],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      
      // 加载权限 - 根据用户角色加载，管理员才有 '*' 权限
      const permissions = user.role === 'admin' ? ['*'] : []
      await permissionStore.loadPermissions(permissions)
      await permissionStore.loadMenuTree()
      
      message.success('登录成功')

      const redirect = route.query.redirect as string
      router.push(redirect || '/workbench')
    } else {
      message.error('登录失败')
    }
  } catch (error: any) {
    message.error(error?.response?.data?.error || '登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #1677ff;
  margin: 0;
}

.login-header p {
  color: rgba(0, 0, 0, 0.45);
  margin-top: 8px;
}
</style>
