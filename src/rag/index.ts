/**
 * RAG 知识库系统
 * 支持结构化数据源和非结构化文档的统一知识管理
 * 
 * 注意：此文件已迁移到模块化结构
 * 实际代码位于: modules/rag-service/backend/
 * 此文件保留用于向后兼容
 */

// 从模块重新导出（保持向后兼容）
export { KnowledgeBase, KnowledgeDocument, KnowledgeChunk, KnowledgeBaseConfig } from './knowledgeBase';
export { VectorStore, VectorSearchResult } from './vectorStore';
export { KnowledgeGraph, Entity, Relation } from './knowledgeGraph';
export { RAGEngine, RAGResponse, RAGContext } from './ragEngine';
export { DocumentProcessor } from './documentProcessor';
export { EmbeddingService } from './embeddingService';

// 导出模块化版本（推荐使用）
// export * from '../../modules/rag-service/backend';
