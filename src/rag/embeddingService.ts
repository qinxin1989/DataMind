/**
 * 嵌入服务
 * 调用AI模型生成文本向量嵌入
 * 支持多模型自动切换
 */

import OpenAI from 'openai';

export interface EmbeddingModelConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  provider?: string;
}

export class EmbeddingService {
  private models: EmbeddingModelConfig[];
  private currentIndex: number;
  private openai!: OpenAI;
  private model!: string;
  private dimension!: number;

  constructor(models: EmbeddingModelConfig | EmbeddingModelConfig[]) {
    this.models = Array.isArray(models) ? models : [models];
    this.currentIndex = 0;
    this.initCurrentModel();
  }

  private initCurrentModel(): void {
    const config = this.models[this.currentIndex];
    
    // 支持 API Key 为空的情况
    const openaiConfig: any = {
      baseURL: config.baseURL,
    };
    
    if (config.apiKey && config.apiKey.trim() !== '') {
      openaiConfig.apiKey = config.apiKey;
    }
    
    this.openai = new OpenAI(openaiConfig);
    this.model = config.model;
    this.dimension = this.getModelDimension(config.model);
    console.log(`[EmbeddingService] 使用模型: ${config.model} (provider: ${config.provider || 'unknown'})`);
  }

  private switchToNextModel(): void {
    if (this.models.length <= 1) {
      throw new Error('没有可用的备用模型');
    }

    this.currentIndex = (this.currentIndex + 1) % this.models.length;
    const config = this.models[this.currentIndex];
    this.initCurrentModel();
    console.log(`[EmbeddingService] 切换到模型: ${config.model} (provider: ${config.provider || 'unknown'})`);
  }

  private getModelDimension(model: string): number {
    const dimensions: Record<string, number> = {
      'text-embedding-ada-002': 1536,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-v1': 1024,  // 通义千问
      'text-embedding-v2': 1536,  // 通义千问
      'BAAI/bge-large-zh-v1.5': 1024,  // SiliconFlow
    };
    return dimensions[model] || 1536;
  }

  getDimension(): number {
    return this.dimension;
  }

  // 生成单个文本的嵌入
  async embed(text: string, maxRetries: number = 3): Promise<number[]> {
    let lastError: Error | null = null;
    let attempts = 0;
    const startIndex = this.currentIndex;

    while (attempts < this.models.length) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: text,
        });
        return response.data[0].embedding;
      } catch (error: any) {
        lastError = error;
        console.error(`[EmbeddingService] 模型 ${this.model} 生成嵌入失败:`, error.message);
        console.error('[EmbeddingService] 错误详情:', {
          model: this.model,
          statusCode: error.status || error.code,
          errorType: error.type
        });
        
        if (error.status === 403 || error.status === 401 || error.status === 429 || error.status === 413 || error.status === 503) {
          console.error(`[EmbeddingService] ${error.status} 错误: API Key 无效、没有权限、速率限制、请求过大或服务不可用`);
          console.error('[EmbeddingService] 尝试切换到下一个模型...');
          
          try {
            this.switchToNextModel();
            attempts++;
          } catch (switchError) {
            console.error('[EmbeddingService] 无法切换模型:', switchError);
            break;
          }
        } else {
          console.error('[EmbeddingService] 非权限错误，不切换模型');
          break;
        }
      }
    }

    console.error('[EmbeddingService] 所有模型都失败，返回零向量');
    return new Array(this.dimension).fill(0);
  }

  // 批量生成嵌入
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const batchSize = 10;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: batch,
        });
        
        const batchResults = response.data
          .sort((a, b) => a.index - b.index)
          .map(d => d.embedding);
        
        results.push(...batchResults);
      } catch (error: any) {
        console.error('[EmbeddingService] 批量生成嵌入失败:', error.message);
        console.error('[EmbeddingService] 错误详情:', {
          model: this.model,
          statusCode: error.status || error.code,
          batchSize: batch.length
        });
        
        if (error.status === 413 || error.status === 503) {
          console.error(`[EmbeddingService] ${error.status} 错误: 请求体过大或服务不可用，尝试切换到下一个模型...`);
          try {
            this.switchToNextModel();
            console.error('[EmbeddingService] 已切换模型，重新尝试批量嵌入...');
            return this.embedBatch(texts);
          } catch (switchError) {
            console.error('[EmbeddingService] 无法切换模型，改用逐个生成');
          }
        }
        
        console.error('[EmbeddingService] 逐个生成嵌入...');
        for (const text of batch) {
          results.push(await this.embed(text));
        }
      }
    }

    return results;
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
