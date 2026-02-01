<template>
  <div class="lazy-image" :class="{ 'lazy-image--loaded': loaded }">
    <img
      v-if="shouldLoad"
      :src="src"
      :alt="alt"
      :class="imageClass"
      @load="onLoad"
      @error="onError"
    />
    <div v-else class="lazy-image__placeholder">
      <slot name="placeholder">
        <div class="lazy-image__skeleton"></div>
      </slot>
    </div>
    <div v-if="error" class="lazy-image__error">
      <slot name="error">
        <span>加载失败</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

interface Props {
  src: string;
  alt?: string;
  imageClass?: string;
  lazy?: boolean;
  threshold?: number;
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  imageClass: '',
  lazy: true,
  threshold: 0.1
});

const shouldLoad = ref(!props.lazy);
const loaded = ref(false);
const error = ref(false);
const imageRef = ref<HTMLElement>();

let observer: IntersectionObserver | null = null;

const onLoad = () => {
  loaded.value = true;
  error.value = false;
};

const onError = () => {
  error.value = true;
  loaded.value = false;
};

const startObserving = () => {
  if (!props.lazy || !imageRef.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          shouldLoad.value = true;
          if (observer && imageRef.value) {
            observer.unobserve(imageRef.value);
          }
        }
      });
    },
    {
      threshold: props.threshold
    }
  );

  observer.observe(imageRef.value);
};

onMounted(() => {
  if (props.lazy) {
    imageRef.value = document.querySelector('.lazy-image') as HTMLElement;
    startObserving();
  }
});

onBeforeUnmount(() => {
  if (observer && imageRef.value) {
    observer.unobserve(imageRef.value);
  }
});
</script>

<style scoped>
.lazy-image {
  position: relative;
  overflow: hidden;
  background-color: #f5f5f5;
}

.lazy-image__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lazy-image__skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.lazy-image__error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  color: #999;
}

.lazy-image--loaded img {
  opacity: 1;
  transition: opacity 0.3s ease-in-out;
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
