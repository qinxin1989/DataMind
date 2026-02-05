/**
 * RAG 知识库服务模块入口
 */

import type { Pool } from 'mysql2/promise';
import { createRagRoutes } from './routes';
import { RagService } from './service';

export interface RagModuleOptions {
    db: Pool;
    aiConfigs?: any[];
}

export function initRagModule(options: RagModuleOptions) {
    const { db, aiConfigs } = options;

    return {
        routes: createRagRoutes(db, aiConfigs),
        name: 'rag-service',
        version: '1.0.0',

        // 提供服务实例工厂
        createService: (userId: string) => {
            const service = new RagService(db, userId);
            if (aiConfigs) {
                service.initialize(aiConfigs);
            }
            return service;
        }
    };
}

// 导出所有类型和服务
export * from './types';
export * from './service';
export * from './agenticRetriever';
export { RAGEngine } from './ragEngine';
export { KnowledgeBase } from './knowledgeBase';
export { KnowledgeGraph } from './knowledgeGraph';
export { VectorStore } from './vectorStore';
export { EmbeddingService } from './embeddingService';
export { DocumentProcessor } from './documentProcessor';
