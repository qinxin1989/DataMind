<template>
  <div class="virtual-list" ref="containerRef" @scroll="onScroll">
    <div class="virtual-list-phantom" :style="{ height: totalHeight + 'px' }"></div>
    <div class="virtual-list-content" :style="{ transform: `translateY(${offset}px)` }">
      <div
        v-for="item in visibleItems"
        :key="getItemKey(item)"
        class="virtual-list-item"
        :style="{ height: itemHeight + 'px' }"
      >
        <slot :item="item" :index="item.__index"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

interface Props {
  items: any[];
  itemHeight: number;
  keyField?: string;
  buffer?: number;
}

const props = withDefaults(defineProps<Props>(), {
  keyField: 'id',
  buffer: 5
});

const containerRef = ref<HTMLElement>();
const scrollTop = ref(0);
const containerHeight = ref(0);

// 计算总高度
const totalHeight = computed(() => props.items.length * props.itemHeight);

// 计算可见区域的起始索引
const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer);
});

// 计算可见区域的结束索引
const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight);
  return Math.min(
    props.items.length,
    startIndex.value + visibleCount + props.buffer * 2
  );
});

// 计算偏移量
const offset = computed(() => startIndex.value * props.itemHeight);

// 计算可见项
const visibleItems = computed(() => {
  return props.items
    .slice(startIndex.value, endIndex.value)
    .map((item, index) => ({
      ...item,
      __index: startIndex.value + index
    }));
});

// 获取项的键
const getItemKey = (item: any) => {
  return item[props.keyField];
};

// 滚动事件处理
const onScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  scrollTop.value = target.scrollTop;
};

// 更新容器高度
const updateContainerHeight = () => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight;
  }
};

// 监听窗口大小变化
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateContainerHeight();
  
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateContainerHeight);
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value);
  }
});

// 监听 items 变化,重置滚动位置
watch(() => props.items, () => {
  scrollTop.value = 0;
  if (containerRef.value) {
    containerRef.value.scrollTop = 0;
  }
});

// 暴露方法
defineExpose({
  scrollTo: (index: number) => {
    if (containerRef.value) {
      containerRef.value.scrollTop = index * props.itemHeight;
    }
  },
  scrollToTop: () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0;
    }
  }
});
</script>

<style scoped>
.virtual-list {
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.virtual-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: -1;
}

.virtual-list-content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}

.virtual-list-item {
  box-sizing: border-box;
}
</style>
