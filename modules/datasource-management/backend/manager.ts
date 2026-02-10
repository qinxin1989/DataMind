import { BaseDataSource, createDataSource } from '../../../src/datasource';
import { DataSourceConfig } from '../../../src/types';
import { createLogger } from '../../../src/utils/logger';

const log = createLogger('DataSourceManager');

/**
 * 数据源管理器 (单例)
 * 负责统一管理内存中的活跃连接池
 */
export class DataSourceManager {
    private static instance: DataSourceManager;
    private connections = new Map<string, { config: DataSourceConfig; instance: BaseDataSource }>();
    private lockQueue = new Map<string, Promise<any>>();

    private constructor() { }

    public static getInstance(): DataSourceManager {
        if (!DataSourceManager.instance) {
            DataSourceManager.instance = new DataSourceManager();
        }
        return DataSourceManager.instance;
    }

    /**
     * 加载/更新单个数据源实例
     */
    public async register(config: DataSourceConfig): Promise<BaseDataSource> {
        const id = config.id;

        // 获取之前的锁（如果有），并将当前操作加入队列
        const previousLock = this.lockQueue.get(id) || Promise.resolve();
        const currentOperation = (async () => {
            await previousLock.catch(() => { }); // 无论上一个操作成功还是失败都要继续

            try {
                log.info(`开始注册数据源: ${config.name} (${id})`);
                const existing = this.connections.get(id);
                if (existing) {
                    log.debug(`断开旧连接: ${id}`);
                    await existing.instance.disconnect().catch(err =>
                        log.warn(`断开旧连接失败 ${id}:`, err.message)
                    );
                }

                const instance = createDataSource(config);
                this.connections.set(id, { config, instance });
                log.info(`数据源注册成功: ${config.name}`);
                return instance;
            } catch (error: any) {
                log.error(`注册数据源失败 ${config.name}:`, error.message);
                this.connections.delete(id);
                throw error;
            }
        })();

        // 更新队列中的最新快照
        this.lockQueue.set(id, currentOperation);

        // 当这个 ID 的所有队列都清空时，可以清理 lockQueue 以防内存泄漏
        currentOperation.finally(() => {
            if (this.lockQueue.get(id) === currentOperation) {
                this.lockQueue.delete(id);
            }
        });

        return currentOperation;
    }

    /**
     * 获取数据源实例
     */
    public get(id: string): { config: DataSourceConfig; instance: BaseDataSource } | undefined {
        try {
            return this.connections.get(id);
        } catch (error: any) {
            log.error(`获取数据源实例失败 ${id}:`, error.message);
            return undefined;
        }
    }

    /**
     * 检查数据源是否存在
     */
    public has(id: string): boolean {
        return this.connections.has(id);
    }

    /**
     * 移除并断开数据源
     */
    public async remove(id: string): Promise<void> {
        const id_str = id;
        const previousLock = this.lockQueue.get(id_str) || Promise.resolve();

        const currentOperation = (async () => {
            await previousLock.catch(() => { });

            try {
                const ds = this.connections.get(id_str);
                if (ds) {
                    log.info(`移除数据源: ${id_str}`);
                    await ds.instance.disconnect().catch(err =>
                        log.warn(`移除数据源时断开连接失败 ${id_str}:`, err.message)
                    );
                    this.connections.delete(id_str);
                }
            } catch (error: any) {
                log.error(`移除数据源失败 ${id_str}:`, error.message);
            }
        })();

        this.lockQueue.set(id_str, currentOperation);
        currentOperation.finally(() => {
            if (this.lockQueue.get(id_str) === currentOperation) {
                this.lockQueue.delete(id_str);
            }
        });

        return currentOperation;
    }

    /**
     * 获取所有活跃连接
     */
    public getAll(): IterableIterator<{ config: DataSourceConfig; instance: BaseDataSource }> {
        return this.connections.values();
    }

    /**
     * 获取所有连接的 Entry
     */
    public entries() {
        return this.connections.entries();
    }

    /**
     * 应急清理：彻底重置管理器状态
     */
    public async clearAll(): Promise<void> {
        const ids = Array.from(this.connections.keys());
        for (const id of ids) {
            await this.remove(id);
        }
        this.connections.clear();
        this.lockQueue.clear();
    }
}

export const dataSourceManager = DataSourceManager.getInstance();
