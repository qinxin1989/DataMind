/**
 * 简单的日志工具
 * 根据环境变量控制日志输出级别
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4
};

// 从环境变量读取日志级别，默认 info
const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const currentLevelNum = LOG_LEVELS[currentLevel] ?? 1;

// 是否为生产环境
const isProduction = process.env.NODE_ENV === 'production';

/**
 * 日志工具类
 */
class Logger {
    private prefix: string;

    constructor(prefix: string = '') {
        this.prefix = prefix ? `[${prefix}]` : '';
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= currentLevelNum;
    }

    private formatMessage(level: string, args: any[]): string {
        const timestamp = new Date().toISOString();
        return `${timestamp} ${level.toUpperCase()} ${this.prefix}`;
    }

    debug(...args: any[]): void {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', args), ...args);
        }
    }

    info(...args: any[]): void {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', args), ...args);
        }
    }

    warn(...args: any[]): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', args), ...args);
        }
    }

    error(...args: any[]): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', args), ...args);
        }
    }

    /**
     * 创建带前缀的子日志器
     */
    child(prefix: string): Logger {
        return new Logger(this.prefix ? `${this.prefix.slice(1, -1)}:${prefix}` : prefix);
    }
}

// 导出默认日志器
export const logger = new Logger();

// 导出创建新日志器的函数
export function createLogger(prefix: string): Logger {
    return new Logger(prefix);
}

// 导出当前日志级别信息（便于调试）
export const loggerInfo = {
    level: currentLevel,
    isProduction
};
