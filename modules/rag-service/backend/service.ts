/**
 * RAG 知识库服务层
 * 整合向量检索和 Agentic 检索
 */

import { v4 as uuidv4 } from 'uuid';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
    KnowledgeDocument,
    KnowledgeChunk,
    KnowledgeCategory,
    CreateDocumentDto,
    DocumentListQuery,
    DocumentListResponse,
    QaRequest,
    QaResponse,
    RagStats,
    RetrieveMode
} from './types';

import { ragManager } from './manager';
import type { RAGEngine } from './ragEngine';
import { AgenticRetriever } from './agenticRetriever';

export class RagService {
    private db: Pool;
    private userId: string;
    private agenticRetriever: AgenticRetriever | null = null;

    constructor(db: Pool, userId: string = 'system') {
        this.db = db;
        this.userId = userId;
    }

    /**
     * 初始化 RAG 引擎
     */
    async initialize(aiConfigs: any[]): Promise<void> {
        if (aiConfigs.length > 0) {
            await ragManager.getOrCreate(this.userId, aiConfigs, this.db);
        }

        // 初始化 Agentic 检索器
        const knowledgePath = process.cwd() + '/knowledge';
        this.agenticRetriever = new AgenticRetriever(knowledgePath);
    }

    private get ragEngine(): RAGEngine | null {
        return ragManager.get(this.userId) || null;
    }

    /**
     * 获取知识库统计
     */
    async getStats(): Promise<RagStats> {
        // 文档总数
        const [docRows] = await this.db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as total FROM knowledge_documents WHERE user_id = ?',
            [this.userId]
        );

        // 分块总数
        const [chunkRows] = await this.db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM knowledge_chunks c
       JOIN knowledge_documents d ON c.document_id = d.id
       WHERE d.user_id = ?`,
            [this.userId]
        );

        // 按类型统计
        const [typeRows] = await this.db.query<RowDataPacket[]>(
            `SELECT type, COUNT(*) as count FROM knowledge_documents
       WHERE user_id = ? GROUP BY type`,
            [this.userId]
        );

        // 按分类统计
        const [categoryRows] = await this.db.query<RowDataPacket[]>(
            `SELECT c.id as categoryId, c.name, COUNT(d.id) as count
       FROM knowledge_categories c
       LEFT JOIN knowledge_documents d ON d.category_id = c.id AND d.user_id = ?
       GROUP BY c.id, c.name`,
            [this.userId]
        );

        const documentsByType: Record<string, number> = {};
        for (const row of typeRows) {
            documentsByType[row.type] = row.count;
        }

        return {
            totalDocuments: docRows[0].total,
            totalChunks: chunkRows[0].total,
            totalCategories: categoryRows.length,
            totalSize: this.formatBytes(await this.getTotalSize()),
            lastUpdated: new Date(),
            documentsByType: documentsByType as any,
            documentsByCategory: categoryRows.map(r => ({
                categoryId: r.categoryId,
                name: r.name,
                count: r.count
            }))
        };
    }

    /**
     * 获取总文件大小
     */
    private async getTotalSize(): Promise<number> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT SUM(LENGTH(content)) as totalSize FROM knowledge_documents WHERE user_id = ?`,
            [this.userId]
        );
        return rows[0].totalSize || 0;
    }

    /**
     * 格式化字节大小
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取文档列表
     */
    async getDocumentList(query: DocumentListQuery): Promise<DocumentListResponse> {
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        const offset = (page - 1) * pageSize;

        let sql = 'SELECT * FROM knowledge_documents WHERE user_id = ?';
        const params: any[] = [this.userId];

        if (query.type) {
            sql += ' AND type = ?';
            params.push(query.type);
        }

        if (query.categoryId) {
            sql += ' AND category_id = ?';
            params.push(query.categoryId);
        }

        if (query.keyword) {
            sql += ' AND (title LIKE ? OR content LIKE ?)';
            const keyword = `%${query.keyword}%`;
            params.push(keyword, keyword);
        }

        if (query.status) {
            sql += ' AND status = ?';
            params.push(query.status);
        }

        // 获取总数
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countRows] = await this.db.query<RowDataPacket[]>(countSql, params);
        const total = countRows[0].total;

        // 获取列表
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);
        const [rows] = await this.db.query<RowDataPacket[]>(sql, params);

        return {
            items: rows as KnowledgeDocument[],
            total,
            page,
            pageSize
        };
    }

    /**
     * 创建文档
     */
    async createDocument(data: CreateDocumentDto): Promise<KnowledgeDocument> {
        if (!this.ragEngine) {
            throw new Error('RAG 引擎未初始化');
        }

        const doc = await this.ragEngine.addDocument(
            data.content,
            data.title,
            data.type,
            this.userId,
            {
                categoryId: data.categoryId,
                ...data.metadata
            }
        );

        // 返回完整的文档信息
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM knowledge_documents WHERE id = ?',
            [doc.id]
        );

        return rows[0] as KnowledgeDocument;
    }

    /**
     * 删除文档
     */
    async deleteDocument(id: string): Promise<void> {
        if (this.ragEngine) {
            await this.ragEngine.deleteDocument(id);
        }
    }

    /**
     * 知识问答
     */
    async query(request: QaRequest): Promise<QaResponse> {
        const mode = request.mode || 'vector';

        if (mode === 'agentic' && this.agenticRetriever) {
            // 使用 Agentic 检索
            const result = await this.agenticRetriever.retrieve(request.question);

            return {
                answer: result.success
                    ? `根据知识库检索，找到以下相关信息：\n\n${result.sources.map(s => s.content).join('\n\n')}`
                    : '未找到相关知识，请尝试其他问题或检查知识库内容。',
                sources: result.sources.map(s => ({
                    documentId: s.file,
                    title: s.file.split('/').pop() || s.file,
                    content: s.content,
                    score: s.relevance
                })),
                confidence: result.success ? 0.8 : 0.2,
                mode: 'agentic'
            };
        }

        // 使用向量检索
        if (!this.ragEngine) {
            throw new Error('RAG 引擎未初始化');
        }

        const result = await this.ragEngine.answer(
            request.question,
            undefined,
            request.categoryId,
            request.documentId
        );

        return {
            answer: result.answer,
            sources: result.sources.map(s => ({
                documentId: s.documentId,
                title: s.title,
                content: s.content || '',
                score: result.confidence
            })),
            confidence: result.confidence,
            mode: 'vector'
        };
    }

    /**
     * 搜索知识
     */
    async search(query: string, limit: number = 20): Promise<KnowledgeChunk[]> {
        if (!this.ragEngine) {
            return [];
        }

        const results = await this.ragEngine.searchChunks(query, limit);
        return results.map(r => ({
            id: r.chunkId,
            documentId: r.documentId,
            content: r.content,
            index: 0,
            startOffset: 0,
            endOffset: r.content.length,
            metadata: r.metadata
        }));
    }

    /**
     * 获取分类列表
     */
    async getCategories(): Promise<KnowledgeCategory[]> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM knowledge_categories ORDER BY sort_order'
        );
        return rows as KnowledgeCategory[];
    }

    /**
     * 创建分类
     */
    async createCategory(name: string, description?: string, parentId?: string): Promise<KnowledgeCategory> {
        const id = uuidv4();
        const now = new Date();

        await this.db.query<ResultSetHeader>(
            `INSERT INTO knowledge_categories (id, name, description, parent_id, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, description || null, parentId || null, 0, now]
        );

        return {
            id,
            name,
            description,
            parentId,
            sortOrder: 0,
            createdAt: now
        };
    }
}
