# 爬虫助手对话历史功能实现指南

## 需要修改的文件

### 1. 前端页面 `admin-ui/src/views/ai/crawler-assistant.vue`

在 `<script setup>` 部分添加以下代码：

```typescript
// 对话历史相关
const conversations = ref<any[]>([])
const currentConversationId = ref<string | null>(null)
const conversationsVisible = ref(false)

// 加载对话列表
async function loadConversations() {
  try {
    const res = await aiApi.getCrawlerConversations()
    if (res.success && res.data) {
      conversations.value = res.data
    }
  } catch (error) {
    console.error('加载对话列表失败:', error)
  }
}

// 加载最新对话
async function loadLatestConversation() {
  try {
    const res = await aiApi.getLatestCrawlerConversation()
    if (res.success && res.data) {
      currentConversationId.value = res.data.id
      messages.value = res.data.messages || []
      await nextTick()
      scrollToBottom()
    }
  } catch (error) {
    console.error('加载最新对话失败:', error)
  }
}

// 新建对话
async function handleNewConversation() {
  try {
    // 如果当前有对话且有消息，先保存
    if (currentConversationId.value && messages.value.length > 0) {
      await saveCurrentConversation()
    }
    
    // 创建新对话
    const res = await aiApi.createCrawlerConversation({
      title: '新对话',
      messages: []
    })
    
    if (res.success && res.data) {
      currentConversationId.value = res.data.id
      messages.value = []
      message.success('已创建新对话')
    }
  } catch (error) {
    message.error('创建对话失败')
  }
}

// 保存当前对话
async function saveCurrentConversation() {
  if (!currentConversationId.value) return
  
  try {
    // 生成标题（使用第一条用户消息）
    const firstUserMsg = messages.value.find(m => m.role === 'user')
    const title = firstUserMsg ? 
      firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 
      '新对话'
    
    await aiApi.updateCrawlerConversation(currentConversationId.value, {
      title,
      messages: messages.value
    })
  } catch (error) {
    console.error('保存对话失败:', error)
  }
}

// 加载指定对话
async function loadConversation(id: string) {
  try {
    const res = await aiApi.getCrawlerConversation(id)
    if (res.success && res.data) {
      currentConversationId.value = res.data.id
      messages.value = res.data.messages || []
      conversationsVisible.value = false
      await nextTick()
      scrollToBottom()
    }
  } catch (error) {
    message.error('加载对话失败')
  }
}

// 删除对话
async function deleteConversation(id: string) {
  try {
    await aiApi.deleteCrawlerConversation(id)
    message.success('删除成功')
    loadConversations()
    
    // 如果删除的是当前对话，创建新对话
    if (id === currentConversationId.value) {
      handleNewConversation()
    }
  } catch (error) {
    message.error('删除失败')
  }
}

// 在组件挂载时加载最新对话
onMounted(async () => {
  await loadLatestConversation()
  await loadConversations()
})

// 监听消息变化，自动保存
watch(messages, () => {
  if (currentConversationId.value && messages.value.length > 0) {
    // 防抖保存
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveCurrentConversation()
    }, 2000)
  }
}, { deep: true })

let saveTimer: any = null
```

### 2. 在模板中添加UI组件

在 `<template>` 的聊天头部添加按钮：

```vue
<div class="chat-header">
  <h2>AI 爬虫助手</h2>
  <div class="header-actions">
    <a-button @click="conversationsVisible = true">
      <template #icon><HistoryOutlined /></template>
      历史对话
    </a-button>
    <a-button type="primary" @click="handleNewConversation">
      <template #icon><PlusOutlined /></template>
      新建对话
    </a-button>
  </div>
  <p class="subtitle">告诉我网址和需要爬取的内容，我来帮您生成爬虫模板</p>
</div>
```

### 3. 添加对话历史抽屉

在模板末尾添加：

```vue
<!-- 对话历史抽屉 -->
<a-drawer
  v-model:open="conversationsVisible"
  title="对话历史"
  placement="right"
  width="400"
>
  <a-list :data-source="conversations" :loading="false">
    <template #renderItem="{ item }">
      <a-list-item>
        <a-list-item-meta>
          <template #title>
            <a @click="loadConversation(item.id)">{{ item.title }}</a>
          </template>
          <template #description>
            {{ formatDate(item.updated_at) }}
          </template>
        </a-list-item-meta>
        <template #actions>
          <a-popconfirm
            title="确定删除此对话？"
            @confirm="deleteConversation(item.id)"
          >
            <a-button type="text" danger size="small">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </a-popconfirm>
        </template>
      </a-list-item>
    </template>
  </a-list>
</a-drawer>
```

### 4. 添加样式

```css
.chat-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}
```

## 创建爬虫一级菜单

运行以下脚本创建菜单结构：

```bash
npx tsx scripts/create-crawler-menu-structure.ts
```

菜单结构：
```
数据采集中心 (一级菜单)
├── AI爬虫助手
├── 采集模板配置
└── 爬虫管理
```

## 测试步骤

1. 启动后端服务
2. 刷新前端页面
3. 访问 AI爬虫助手
4. 测试功能：
   - 创建新对话
   - 发送消息
   - 切换对话
   - 删除对话
   - 自动保存
   - 自动加载最新对话

## 注意事项

1. 对话自动保存有2秒防抖
2. 对话标题自动从第一条用户消息生成
3. 删除当前对话会自动创建新对话
4. 页面刷新会自动加载最新对话
