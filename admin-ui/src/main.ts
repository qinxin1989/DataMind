import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import { setupPermissionDirective } from './directives/permission'
import 'ant-design-vue/dist/reset.css'
import './assets/styles/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Antd)

setupPermissionDirective(app)

app.mount('#app')
