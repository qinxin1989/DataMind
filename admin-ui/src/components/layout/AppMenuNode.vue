<template>
  <a-sub-menu v-if="hasChildren" :key="submenuKey">
    <template #title>
      <span>
        <component :is="resolvedIcon" />
        <span>{{ item.title }}</span>
      </span>
    </template>

    <AppMenuNode
      v-for="child in item.children"
      :key="child.id"
      :item="child"
      :get-icon="getIcon"
    />
  </a-sub-menu>

  <a-menu-item v-else :key="item.id">
    <component :is="resolvedIcon" />
    <span>{{ item.title }}</span>
  </a-menu-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MenuItem } from '@/types'

const props = defineProps<{
  item: MenuItem
  getIcon: (iconName?: string) => any
}>()

const hasChildren = computed(() => Array.isArray(props.item.children) && props.item.children.length > 0)
const submenuKey = computed(() => `p_${props.item.id}`)
const resolvedIcon = computed(() => props.getIcon(props.item.icon))
</script>
