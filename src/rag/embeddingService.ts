/**
 * 嵌入服务
 * 调用AI模型生成文本向量嵌入
 */

import OpenAI from 'openai';

export class EmbeddingService {
  private openai: OpenAI;
  private model: string;
  private dimension: number;

  constructor(apiKey: string, baseURL?: string, model: string = 'text-embedding-ada-002') {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
    // 不同模型的维度
    this.dimension = this.getModelDimension(model);
  }

  private getModelDimension(model: string): number {
    const dimensions: Record<string, number> = {
      'text-embedding-ada-002': 1536,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-v1': 1024,  // 通义千问
      'text-embedding-v2': 1536,  // 通义千问
    };
    return dimensions[model] || 1536;
  }

  getDimension(): number {
    return this.dimension;
  }

  // 生成单个文本的嵌入
  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      console.error('生成嵌入失败:', error.message);
      // 返回零向量作为fallback
      return new Array(this.dimension).fill(0);
    }
  }

  // 批量生成嵌入
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      // OpenAI API 支持批量嵌入
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
      });
      
      // 按原始顺序返回
      return response.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);
    } catch (error: any) {
      console.error('批量生成嵌入失败:', error.message);
      // 逐个尝试
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await this.embed(text));
      }
      return results;
    }
  }

  // 计算文本相似度
  async similarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await this.embedBatch([text1, text2]);
    return this.cosineSimilarity(emb1, emb2);
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

  // 查找最相似的文本
  async findMostSimilar(
    query: string, 
    candidates: string[], 
    topK: number = 5
  ): Promise<{ text: string; score: number; index: number }[]> {
    const queryEmb = await this.embed(query);
    const candidateEmbs = await this.embedBatch(candidates);

    const scores = candidateEmbs.map((emb, index) => ({
      text: candidates[index],
      score: this.cosineSimilarity(queryEmb, emb),
      index,
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
