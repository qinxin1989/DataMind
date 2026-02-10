/**
 * RAG 引擎管理器
 * 统一管理各用户的 RAG 引擎实例，实现内存状态共享
 */

import { RAGEngine } from './ragEngine';
import type { Pool } from 'mysql2/promise';

export class RAGManager {
    private static instance: RAGManager;
    private engines: Map<string, RAGEngine> = new Map();

    private constructor() { }

    public static getInstance(): RAGManager {
        if (!RAGManager.instance) {
            RAGManager.instance = new RAGManager();
        }
        return RAGManager.instance;
    }

    /**
     * 获取或创建用户的 RAG 引擎
     */
    public async getOrCreate(
        userId: string,
        aiConfigs: any[],
        db: Pool
    ): Promise<RAGEngine | null> {
        if (this.engines.has(userId)) {
            return this.engines.get(userId)!;
        }

        if (aiConfigs.length === 0) {
            return null;
        }

        const config = aiConfigs[0];
        const engine = new RAGEngine(
            aiConfigs,
            config.baseUrl,
            config.model,
            'text-embedding-v2',
            userId,
            db
        );

        await engine.loadFromDatabase();
        this.engines.set(userId, engine);
        return engine;
    }

    /**
     * 获取现有引擎（不创建）
     */
    public get(userId: string): RAGEngine | undefined {
        return this.engines.get(userId);
    }

    /**
     * 移除引擎
     */
    public remove(userId: string): void {
        this.engines.delete(userId);
    }

    /**
     * 清除所有引擎
     */
    public clear(): void {
        this.engines.clear();
    }

    /**
     * 获取所有活跃引擎的统计
     */
    public getAllStats(): Record<string, any> {
        const stats: Record<string, any> = {};
        for (const [userId, engine] of this.engines.entries()) {
            stats[userId] = engine.getStats();
        }
        return stats;
    }
}

export const ragManager = RAGManager.getInstance();
