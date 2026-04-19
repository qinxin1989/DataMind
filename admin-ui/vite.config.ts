import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@modules': resolve(__dirname, '../modules'),
      vue: resolve(__dirname, 'node_modules/vue/dist/vue.runtime.esm-bundler.js'),
      'vue-router': resolve(__dirname, 'node_modules/vue-router'),
      'pinia': resolve(__dirname, 'node_modules/pinia'),
      'ant-design-vue': resolve(__dirname, 'node_modules/ant-design-vue'),
      '@ant-design/icons-vue': resolve(__dirname, 'node_modules/@ant-design/icons-vue'),
    },
  },
  server: {
    port: 3002,
    fs: {
      allow: [resolve(__dirname, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
