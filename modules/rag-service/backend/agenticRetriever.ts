/**
 * Agentic RAG 检索服务
 * 基于渐进式检索策略的知识库检索
 * 
 * 核心理念：
 * 1. 定位领域 - 通过目录索引定位相关文件夹
 * 2. 定位文件 - 使用 grep 筛选相关文件
 * 3. 定位内容 - 针对不同文件类型用不同策略
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 检索结果
export interface RetrieveResult {
    success: boolean;
    answer?: string;
    sources: Array<{
        file: string;
        content: string;
        relevance: number;
    }>;
    searchHistory: string[];  // 记录检索过程
    retryCount: number;
}

// 目录索引信息
export interface DirectoryIndex {
    path: string;
    description: string;
    files: Array<{
        name: string;
        description: string;
        keywords: string[];
    }>;
}

/**
 * Agentic 知识检索器
 */
export class AgenticRetriever {
    private knowledgePath: string;
    private maxRetries: number;

    constructor(knowledgePath: string, maxRetries: number = 5) {
        this.knowledgePath = knowledgePath;
        this.maxRetries = maxRetries;
    }

    /**
     * 主检索入口
     */
    async retrieve(query: string, aiClient?: any): Promise<RetrieveResult> {
        const searchHistory: string[] = [];
        let retryCount = 0;
        const allSources: RetrieveResult['sources'] = [];

        // 提取关键词
        const keywords = this.extractKeywords(query);
        searchHistory.push(`提取关键词: ${keywords.join(', ')}`);

        // 1. 定位领域
        const domains = await this.locateDomain(query, keywords);
        searchHistory.push(`定位领域: ${domains.map(d => d.path).join(', ') || '根目录'}`);

        // 2. 在各领域中搜索
        for (const domain of domains.length > 0 ? domains : [{ path: this.knowledgePath, description: '根目录' }]) {
            // 使用 grep 搜索相关文件
            const files = await this.grepSearch(domain.path, keywords);
            searchHistory.push(`在 ${domain.path} 找到 ${files.length} 个相关文件`);

            // 3. 读取文件内容
            for (const file of files.slice(0, 5)) { // 最多读取 5 个文件
                const content = await this.readFileContent(file.path, keywords);
                if (content) {
                    allSources.push({
                        file: file.path,
                        content: content.substring(0, 2000), // 限制长度
                        relevance: file.score
                    });
                    searchHistory.push(`读取文件: ${path.basename(file.path)} (${content.length} 字符)`);
                }
            }
        }

        // 4. 如果没有找到内容，尝试扩展搜索
        while (allSources.length === 0 && retryCount < this.maxRetries) {
            retryCount++;
            const alternativeKeywords = this.generateAlternativeKeywords(keywords, retryCount);
            searchHistory.push(`第 ${retryCount} 次重试，使用关键词: ${alternativeKeywords.join(', ')}`);

            const files = await this.grepSearch(this.knowledgePath, alternativeKeywords);
            for (const file of files.slice(0, 3)) {
                const content = await this.readFileContent(file.path, alternativeKeywords);
                if (content) {
                    allSources.push({
                        file: file.path,
                        content: content.substring(0, 2000),
                        relevance: file.score * 0.8 // 降低重试结果的相关度
                    });
                }
            }
        }

        return {
            success: allSources.length > 0,
            sources: allSources,
            searchHistory,
            retryCount
        };
    }

    /**
     * 提取关键词
     */
    private extractKeywords(query: string): string[] {
        // 移除常见停用词
        const stopWords = ['的', '是', '在', '有', '和', '与', '或', '了', '吗', '呢', '啊', '什么', '怎么', '如何', '为什么'];
        const words = query.split(/[\s,，。？！、]+/).filter(w => w.length > 1 && !stopWords.includes(w));
        return [...new Set(words)].slice(0, 5);
    }

    /**
     * 定位领域（读取目录索引）
     */
    private async locateDomain(query: string, keywords: string[]): Promise<DirectoryIndex[]> {
        const domains: DirectoryIndex[] = [];
        const rootIndex = path.join(this.knowledgePath, 'data_structure.md');

        // 读取根目录索引
        if (fs.existsSync(rootIndex)) {
            const content = fs.readFileSync(rootIndex, 'utf-8');

            // 解析目录索引，找到相关领域
            const dirs = fs.readdirSync(this.knowledgePath, { withFileTypes: true })
                .filter(d => d.isDirectory());

            for (const dir of dirs) {
                const dirPath = path.join(this.knowledgePath, dir.name);
                const dirIndexPath = path.join(dirPath, 'data_structure.md');

                // 检查目录是否与关键词相关
                if (keywords.some(k => dir.name.includes(k) || content.includes(dir.name))) {
                    domains.push({
                        path: dirPath,
                        description: dir.name,
                        files: await this.parseDirectoryIndex(dirIndexPath)
                    });
                }
            }
        }

        return domains;
    }

    /**
     * 解析目录索引文件
     */
    private async parseDirectoryIndex(indexPath: string): Promise<DirectoryIndex['files']> {
        const files: DirectoryIndex['files'] = [];

        if (!fs.existsSync(indexPath)) {
            return files;
        }

        const content = fs.readFileSync(indexPath, 'utf-8');

        // 简单解析 Markdown 表格格式
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.startsWith('|') && !line.includes('---') && !line.includes('文件名')) {
                const parts = line.split('|').filter(p => p.trim());
                if (parts.length >= 2) {
                    files.push({
                        name: parts[0].trim(),
                        description: parts[1].trim(),
                        keywords: parts[2]?.trim().split(',').map(k => k.trim()) || []
                    });
                }
            }
        }

        return files;
    }

    /**
     * 使用 grep 搜索文件
     */
    private async grepSearch(
        searchPath: string,
        keywords: string[]
    ): Promise<Array<{ path: string; score: number; matches: string[] }>> {
        const results: Map<string, { score: number; matches: string[] }> = new Map();

        for (const keyword of keywords) {
            try {
                // 使用 grep 或 findstr (Windows)
                const isWindows = process.platform === 'win32';
                const cmd = isWindows
                    ? `findstr /S /I /M "${keyword}" "${searchPath}\\*.md" "${searchPath}\\*.txt" "${searchPath}\\*.json" 2>nul`
                    : `grep -r -l -i "${keyword}" "${searchPath}" --include="*.md" --include="*.txt" --include="*.json" 2>/dev/null`;

                const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
                const files = stdout.trim().split('\n').filter(f => f);

                for (const file of files) {
                    const existing = results.get(file) || { score: 0, matches: [] };
                    existing.score += 1;
                    existing.matches.push(keyword);
                    results.set(file, existing);
                }
            } catch (e) {
                // grep 没找到结果时会报错，忽略
            }
        }

        // 按匹配数量排序
        return Array.from(results.entries())
            .map(([filePath, data]) => ({
                path: filePath,
                score: data.score / keywords.length,
                matches: data.matches
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * 读取文件内容（针对不同类型采用不同策略）
     */
    private async readFileContent(filePath: string, keywords: string[]): Promise<string | null> {
        const ext = path.extname(filePath).toLowerCase();

        try {
            switch (ext) {
                case '.md':
                case '.txt':
                case '.json':
                    return this.readTextFile(filePath, keywords);
                case '.pdf':
                    return this.readPdfFile(filePath, keywords);
                case '.xlsx':
                case '.xls':
                    return this.readExcelFile(filePath, keywords);
                case '.docx':
                case '.doc':
                    return this.readWordFile(filePath, keywords);
                default:
                    return null;
            }
        } catch (e) {
            console.error(`读取文件失败: ${filePath}`, e);
            return null;
        }
    }

    /**
     * 读取文本文件（只读取相关段落）
     */
    private readTextFile(filePath: string, keywords: string[]): string {
        const content = fs.readFileSync(filePath, 'utf-8');
        const paragraphs = content.split(/\n\n+/);

        // 只返回包含关键词的段落及其上下文
        const relevantParagraphs: string[] = [];
        for (let i = 0; i < paragraphs.length; i++) {
            if (keywords.some(k => paragraphs[i].toLowerCase().includes(k.toLowerCase()))) {
                // 添加上下文
                if (i > 0 && !relevantParagraphs.includes(paragraphs[i - 1])) {
                    relevantParagraphs.push(paragraphs[i - 1]);
                }
                relevantParagraphs.push(paragraphs[i]);
                if (i < paragraphs.length - 1) {
                    relevantParagraphs.push(paragraphs[i + 1]);
                }
            }
        }

        return relevantParagraphs.join('\n\n') || content.substring(0, 1000);
    }

    /**
     * 读取 PDF 文件
     */
    private async readPdfFile(filePath: string, keywords: string[]): Promise<string | null> {
        // 检查是否有预处理的文本版本
        const textVersion = filePath.replace(/\.pdf$/i, '.txt');
        if (fs.existsSync(textVersion)) {
            return this.readTextFile(textVersion, keywords);
        }

        // TODO: 调用 PDF 解析脚本
        // 暂时返回提示信息
        return `[PDF文件: ${path.basename(filePath)}，需要预处理为文本格式]`;
    }

    /**
     * 读取 Excel 文件
     */
    private async readExcelFile(filePath: string, keywords: string[]): Promise<string | null> {
        // 检查是否有预处理的 JSON 版本
        const jsonVersion = filePath.replace(/\.xlsx?$/i, '.json');
        if (fs.existsSync(jsonVersion)) {
            const data = JSON.parse(fs.readFileSync(jsonVersion, 'utf-8'));
            return JSON.stringify(data, null, 2).substring(0, 2000);
        }

        // TODO: 调用 Excel 解析脚本
        return `[Excel文件: ${path.basename(filePath)}，需要预处理为JSON格式]`;
    }

    /**
     * 读取 Word 文件
     */
    private async readWordFile(filePath: string, keywords: string[]): Promise<string | null> {
        // 检查是否有预处理的文本版本
        const textVersion = filePath.replace(/\.docx?$/i, '.txt');
        if (fs.existsSync(textVersion)) {
            return this.readTextFile(textVersion, keywords);
        }

        return `[Word文件: ${path.basename(filePath)}，需要预处理为文本格式]`;
    }

    /**
     * 生成替代关键词（用于重试）
     */
    private generateAlternativeKeywords(originalKeywords: string[], retryCount: number): string[] {
        // 简单策略：使用更短的关键词或同义词
        const alternatives: string[] = [];

        for (const keyword of originalKeywords) {
            // 尝试缩短关键词
            if (keyword.length > 2) {
                alternatives.push(keyword.substring(0, Math.ceil(keyword.length * 0.7)));
            }
            alternatives.push(keyword);
        }

        return [...new Set(alternatives)].slice(0, 3);
    }
}

// 导出单例工厂
export function createAgenticRetriever(knowledgePath?: string): AgenticRetriever {
    const defaultPath = path.join(process.cwd(), 'knowledge');
    return new AgenticRetriever(knowledgePath || defaultPath);
}
