/**
 * 知识库模块共享状态和工具函数
 */
import { ref, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { get, del } from '@/api/request'
import dayjs from 'dayjs'

// ==================== 接口定义 ====================
export interface Document {
    id: string
    title: string
    type: string
    chunks: number
    tags?: string[]
    categoryId?: string
    datasourceId?: string
    datasourceName?: string
    createdAt: number
    content?: string
}

export interface Stats {
    documentCount: number
    chunkCount: number
    entityCount: number
    relationCount: number
}

export interface Category {
    id: string
    name: string
    description?: string
    documentCount?: number
}

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    loading?: boolean
    time: number
    confidence?: number
    sources?: any[]
    dataContext?: any
}

// ==================== 共享状态 ====================
export const documents = ref<Document[]>([])
export const stats = ref<Stats>({ documentCount: 0, chunkCount: 0, entityCount: 0, relationCount: 0 })
export const loading = ref(false)
export const categories = ref<Category[]>([{ id: 'all', name: '全部', documentCount: 0 }])
export const datasources = ref<any[]>([])
export const selectedCategoryKeys = ref<string[]>(['all'])
export const expandedCategoryKeys = ref<string[]>(['all'])

export const pagination = ref({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条`
})

// ==================== 工具函数 ====================
export const searchKeyword = ref('')
export const previewVisible = ref(false)
export const previewDocument = ref<Document | null>(null)
export const previewContent = ref('')
export const highlightChunkContent = ref('')

// ==================== 工具函数 ====================
export function getTypeColor(type: string) {
    const colors: Record<string, string> = {
        text: 'blue',
        faq: 'green',
        manual: 'orange',
        api: 'purple'
    }
    return colors[type] || 'default'
}

export function getTypeLabel(type: string) {
    if (!type) return '未知'
    const labels: Record<string, string> = {
        text: '文本',
        faq: 'FAQ',
        manual: '手册',
        api: 'API文档'
    }
    return labels[type] || type
}

export function formatDate(ts: number) {
    return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

export function getCategoryName(categoryId?: string) {
    if (!categoryId) return '未分类'
    const cat = categories.value.find(c => c.id === categoryId)
    return cat?.name || '未分类'
}

export function getConfidenceColor(confidence: number) {
    if (confidence >= 0.8) return '#52c41a'
    if (confidence >= 0.6) return '#faad14'
    return '#ff4d4f'
}

// ==================== API 调用 ====================
export async function loadCategories() {
    try {
        const res = await get<any[]>('/admin/ai-qa/categories')
        if (res.success) {
            const list = res.data || []
            categories.value = [{ id: 'all', name: '全部', documentCount: documents.value.length }, ...list.filter((c: any) => c)]
            console.log('[Knowledge] Loaded categories:', categories.value.length)
        }
    } catch (e) {
        console.error('加载分类失败', e)
    }
}

export async function loadDatasources() {
    try {
        const res = await get<any[]>('/datasource')
        // 处理不同的响应格式
        if (Array.isArray(res)) {
            datasources.value = res
        } else if (res.success) {
            datasources.value = res.data || []
        } else if (res.data) {
            datasources.value = res.data
        } else {
            datasources.value = []
        }
    } catch (e) {
        console.error('加载数据源失败', e)
        datasources.value = []
    }
}


export async function refreshDocuments() {
    loading.value = true
    try {
        const params = new URLSearchParams({
            page: pagination.value.current.toString(),
            pageSize: pagination.value.pageSize.toString(),
        })

        if (selectedCategoryKeys.value.length > 0 && selectedCategoryKeys.value[0] !== 'all') {
            params.append('categoryId', selectedCategoryKeys.value[0])
        }

        if (searchKeyword.value) {
            params.append('keyword', searchKeyword.value)
        }

        const [docsRes, statsRes] = await Promise.all([
            get<any>(`/admin/ai-qa/rag/documents?${params.toString()}`),
            get<Stats>('/admin/ai-qa/rag/stats')
        ])

        if (docsRes.success) {
            const items = docsRes.data.items || []
            // 防御性过滤，防止 null 进入列表
            documents.value = items.filter((item: any) => item !== null && item !== undefined)
            pagination.value.total = docsRes.data.total || 0
            console.log('[Knowledge] Loaded documents:', documents.value.length)
        }
        if (statsRes.success) stats.value = statsRes.data || stats.value
        loadCategories()
    } catch (e) {
        console.error('[Knowledge] Refresh documents failed:', e)
        message.error('加载失败')
    } finally {
        loading.value = false
    }
}

// 预览相关
import { nextTick } from 'vue'

export async function handlePreview(record: Document, highlightContent?: string) {
    let content = record.content
    if (!content) {
        try {
            loading.value = true
            const res = await get<Document>(`/admin/ai-qa/rag/documents/${record.id}`)
            if (res.success && res.data) {
                content = res.data.content
                record.content = content
            }
        } catch (e) {
            message.error('加载文档内容失败')
            return
        } finally {
            loading.value = false
        }
    }

    previewDocument.value = record
    previewContent.value = content || ''
    previewVisible.value = true
    highlightChunkContent.value = highlightContent || ''

    if (highlightChunkContent.value) {
        nextTick(() => {
            const el = document.getElementById('highlight-target')
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        })
    }
}

export async function handlePreviewById(docId: string) {
    const doc = documents.value.find(d => d.id === docId)
    if (doc) {
        await handlePreview(doc)
    }
}

export async function deleteDocument(record: Document) {
    Modal.confirm({
        title: '确认删除',
        content: `确定要删除文档 "${record.title}" 吗？`,
        onOk: async () => {
            try {
                const res = await del(`/admin/ai-qa/rag/documents/${record.id}`)
                if (res.success) {
                    message.success('删除成功')
                    refreshDocuments()
                }
            } catch (e) {
                message.error('删除失败')
            }
        }
    })
}

// Markdown 渲染
import { marked } from 'marked'
export function renderMarkdown(text: string) {
    if (!text) return ''
    // 移除 <think>...</think> 标签及其内容
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    try {
        return marked.parse(cleanText)
    } catch (e) {
        return cleanText.replace(/\n/g, '<br>')
    }
}

// 计算属性
export const currentCategoryName = computed(() => {
    if (selectedCategoryKeys.value[0] === 'all') return '全部文档'
    const cat = categories.value.find(c => c.id === selectedCategoryKeys.value[0])
    return cat?.name || '未分类'
})

export const categoryTreeData = computed(() => {
    // 防御性检查：确保 categories 是数组
    if (!Array.isArray(categories.value)) {
        return [{ id: 'all', name: '全部', documentCount: 0 }]
    }

    const tree: any[] = [{ id: 'all', name: '全部', documentCount: documents.value?.length || 0 }]

    categories.value.filter(c => c.id !== 'all').forEach(cat => {
        tree.push({
            id: cat.id,
            name: cat.name,
            documentCount: cat.documentCount || 0,
        })
    })

    return tree
})

export const qaScopeOptions = computed(() => {
    // 防御性检查：确保 categories 和 documents 是数组
    if (!Array.isArray(categories.value) || !Array.isArray(documents.value)) {
        return [{
            value: 'all',
            label: '全部知识库',
            isLeaf: false
        }]
    }

    const options: any[] = [
        {
            value: 'all',
            label: '全部知识库',
            isLeaf: false
        }
    ]

    categories.value.filter(c => c.id !== 'all').forEach(cat => {
        const categoryDocs = documents.value.filter(d => d.categoryId === cat.id)
        if (categoryDocs.length > 0) {
            options.push({
                value: cat.id,
                label: cat.name,
                isLeaf: false,
                children: categoryDocs.map(d => ({
                    value: d.id,
                    label: d.title,
                    isLeaf: true
                }))
            })
        }
    })

    return options
})
