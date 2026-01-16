<template>
  <a-breadcrumb class="admin-breadcrumb">
    <a-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index">
      <router-link v-if="item.path && index < breadcrumbs.length - 1" :to="item.path">
        {{ item.title }}
      </router-link>
      <span v-else>{{ item.title }}</span>
    </a-breadcrumb-item>
  </a-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface BreadcrumbItem {
  title: string
  path?: string
}

const route = useRoute()

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ title: '首页', path: '/dashboard' }]
  
  const matched = route.matched.filter((item) => item.meta?.title)
  
  matched.forEach((item) => {
    if (item.meta?.title && item.meta.title !== '首页') {
      items.push({
        title: item.meta.title as string,
        path: item.path,
      })
    }
  })
  
  return items
})
</script>

<style scoped>
.admin-breadcrumb {
  margin: 0;
}
</style>
