<template>
  <div class="skeleton" :class="{ 'skeleton--active': active }">
    <!-- 头部骨架 -->
    <div v-if="avatar" class="skeleton__avatar" :style="avatarStyle"></div>
    
    <!-- 标题骨架 -->
    <div v-if="title" class="skeleton__title" :style="titleStyle"></div>
    
    <!-- 段落骨架 -->
    <div v-if="paragraph" class="skeleton__paragraph">
      <div
        v-for="i in rows"
        :key="i"
        class="skeleton__line"
        :style="getLineStyle(i)"
      ></div>
    </div>
    
    <!-- 自定义内容 -->
    <slot v-if="!avatar && !title && !paragraph"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  active?: boolean;
  avatar?: boolean;
  avatarSize?: number;
  avatarShape?: 'circle' | 'square';
  title?: boolean;
  titleWidth?: string | number;
  paragraph?: boolean;
  rows?: number;
  rowsWidth?: (string | number)[];
}

const props = withDefaults(defineProps<Props>(), {
  active: true,
  avatar: false,
  avatarSize: 40,
  avatarShape: 'circle',
  title: true,
  titleWidth: '40%',
  paragraph: true,
  rows: 3,
  rowsWidth: () => ['100%', '100%', '60%']
});

const avatarStyle = computed(() => ({
  width: `${props.avatarSize}px`,
  height: `${props.avatarSize}px`,
  borderRadius: props.avatarShape === 'circle' ? '50%' : '4px'
}));

const titleStyle = computed(() => ({
  width: typeof props.titleWidth === 'number' 
    ? `${props.titleWidth}px` 
    : props.titleWidth
}));

const getLineStyle = (index: number) => {
  const width = props.rowsWidth[index - 1] || '100%';
  return {
    width: typeof width === 'number' ? `${width}px` : width
  };
};
</script>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton__avatar,
.skeleton__title,
.skeleton__line {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
}

.skeleton--active .skeleton__avatar,
.skeleton--active .skeleton__title,
.skeleton--active .skeleton__line {
  animation: loading 1.5s infinite;
}

.skeleton__avatar {
  flex-shrink: 0;
}

.skeleton__title {
  height: 20px;
  border-radius: 4px;
}

.skeleton__paragraph {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton__line {
  height: 16px;
  border-radius: 4px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
