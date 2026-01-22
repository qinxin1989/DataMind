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

  constructor() {
    // 不再限制单一维度，支持多维度向量共存
  }

  // 获取所有向量维度
  getDimensions(): number[] {
    const dimensions = new Set<number>();
    for (const entry of this.vectors.values()) {
      dimensions.add(entry.vector.length);
    }
    return Array.from(dimensions).sort((a, b) => a - b);
  }

  // 获取指定维度的向量数量
  getVectorCountByDimension(dimension: number): number {
    let count = 0;
    for (const entry of this.vectors.values()) {
      if (entry.vector.length === dimension) {
        count++;
      }
    }
    return count;
  }

  // 添加向量
  addVector(chunk: KnowledgeChunk, vector: number[]): void {
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
    const results: VectorSearchResult[] = [];

    for (const entry of this.vectors.values()) {
      // 只计算相同维度的向量
      if (entry.vector.length !== queryVector.length) {
        continue;
      }
      
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
      if (entry.documentId === documentId && entry.vector.length === queryVector.length) {
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
  getStats(): { totalVectors: number; documents: number; dimensions: number[] } {
    const documentIds = new Set<string>();
    const dimensions = new Set<number>();
    
    for (const entry of this.vectors.values()) {
      documentIds.add(entry.documentId);
      dimensions.add(entry.vector.length);
    }

    return {
      totalVectors: this.vectors.size,
      documents: documentIds.size,
      dimensions: Array.from(dimensions).sort((a, b) => a - b),
    };
  }

  // 清空存储
  clear(): void {
    this.vectors.clear();
  }

  // 导出数据（用于持久化）
  export(): { entries: VectorEntry[]; dimensions: number[] } {
    const dimensions = new Set<number>();
    for (const entry of this.vectors.values()) {
      dimensions.add(entry.vector.length);
    }
    
    return {
      entries: Array.from(this.vectors.values()),
      dimensions: Array.from(dimensions).sort((a, b) => a - b),
    };
  }

  // 导入数据
  import(data: { entries: VectorEntry[]; dimensions?: number[] }): void {
    this.vectors.clear();
    for (const entry of data.entries) {
      this.vectors.set(entry.id, entry);
    }
    
    if (data.dimensions) {
      console.log(`[VectorStore] 导入数据，包含维度: ${data.dimensions.join(', ')}`);
    }
  }
}
