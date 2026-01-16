/**
 * 向量存储
 * 使用内存存储 + 余弦相似度搜索
 * 可扩展为 Pinecone、Milvus、Chroma 等向量数据库
 */

import { KnowledgeChunk } from './knowledgeBase';

export interface VectorSearchResult {
  chunk: KnowledgeChunk;
  score: number;
  documentId: string;
}

interface VectorEntry {
  id: string;
  documentId: string;
  chunk: KnowledgeChunk;
  vector: number[];
}

export class VectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private dimension: number;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  // 添加向量
  addVector(chunk: KnowledgeChunk, vector: number[]): void {
    if (vector.length !== this.dimension) {
      throw new Error(`向量维度不匹配: 期望 ${this.dimension}, 实际 ${vector.length}`);
    }

    this.vectors.set(chunk.id, {
      id: chunk.id,
      documentId: chunk.documentId,
      chunk,
      vector,
    });
  }

  // 批量添加向量
  addVectors(chunks: KnowledgeChunk[], vectors: number[][]): void {
    if (chunks.length !== vectors.length) {
      throw new Error('chunks 和 vectors 数量不匹配');
    }

    for (let i = 0; i < chunks.length; i++) {
      this.addVector(chunks[i], vectors[i]);
    }
  }

  // 删除向量
  deleteVector(chunkId: string): boolean {
    return this.vectors.delete(chunkId);
  }

  // 删除文档的所有向量
  deleteDocumentVectors(documentId: string): number {
    let count = 0;
    for (const [id, entry] of this.vectors) {
      if (entry.documentId === documentId) {
        this.vectors.delete(id);
        count++;
      }
    }
    return count;
  }

  // 余弦相似度
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 向量搜索
  search(queryVector: number[], topK: number = 5, threshold: number = 0.7): VectorSearchResult[] {
    if (queryVector.length !== this.dimension) {
      throw new Error(`查询向量维度不匹配: 期望 ${this.dimension}, 实际 ${queryVector.length}`);
    }

    const results: VectorSearchResult[] = [];

    for (const entry of this.vectors.values()) {
      const score = this.cosineSimilarity(queryVector, entry.vector);
      if (score >= threshold) {
        results.push({
          chunk: entry.chunk,
          score,
          documentId: entry.documentId,
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // 按文档ID搜索
  searchByDocument(documentId: string, queryVector: number[], topK: number = 5): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];

    for (const entry of this.vectors.values()) {
      if (entry.documentId === documentId) {
        const score = this.cosineSimilarity(queryVector, entry.vector);
        results.push({
          chunk: entry.chunk,
          score,
          documentId: entry.documentId,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // 获取统计信息
  getStats(): { totalVectors: number; documents: number; dimension: number } {
    const documentIds = new Set<string>();
    for (const entry of this.vectors.values()) {
      documentIds.add(entry.documentId);
    }

    return {
      totalVectors: this.vectors.size,
      documents: documentIds.size,
      dimension: this.dimension,
    };
  }

  // 清空存储
  clear(): void {
    this.vectors.clear();
  }

  // 导出数据（用于持久化）
  export(): { entries: VectorEntry[]; dimension: number } {
    return {
      entries: Array.from(this.vectors.values()),
      dimension: this.dimension,
    };
  }

  // 导入数据
  import(data: { entries: VectorEntry[]; dimension: number }): void {
    this.dimension = data.dimension;
    this.vectors.clear();
    for (const entry of data.entries) {
      this.vectors.set(entry.id, entry);
    }
  }
}
