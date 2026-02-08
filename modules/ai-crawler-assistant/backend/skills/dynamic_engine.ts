import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';

/**
 * 抓取选项接口
 */
export interface FetchOptions {
    /** 等待出现的元素选择器 */
    waitSelector?: string;
    /** 需要设置的 Cookies */
    cookies?: any[];
    /** 额外的 HTTP 标头 */
    headers?: Record<string, string>;
    /** 等待网络空闲的超时时间 (ms) */
    timeout?: number;
}

/**
 * 动态网页抓取引擎 (增强稳定性版)
 * 采用单例浏览器 + BrowserContext 隔离，根治 Windows EBUSY 资源竞争问题。
 */
export class DynamicEngine {
    private static browser: Browser | null = null;
    private static launchPromise: Promise<Browser> | null = null;

    /**
     * 获取或初始化浏览器实例 (单例模式)
     */
    private static async getBrowser(): Promise<Browser> {
        // 如果浏览器已连接且可用，直接返回
        if (this.browser && this.browser.connected) {
            try {
                // 尝试执行一个简单操作验证连接是否真实有效
                await this.browser.version();
                return this.browser;
            } catch (e) {
                console.warn('[DynamicEngine] Browser connection check failed, restarting...');
                this.browser = null;
            }
        }

        // 防止并发触发多次 launch
        if (this.launchPromise) {
            return this.launchPromise;
        }

        console.log('[DynamicEngine] Launching stable browser singleton...');
        this.launchPromise = puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--disable-web-security',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--hide-scrollbars'
            ]
        }).then((b: Browser) => {
            this.browser = b;
            this.launchPromise = null;

            b.on('disconnected', () => {
                console.warn('[DynamicEngine] Browser instance disconnected, clearing singleton.');
                this.browser = null;
            });

            return b;
        }).catch((err: Error) => {
            this.launchPromise = null;
            console.error('[DynamicEngine] Failed to launch browser:', err);
            throw err;
        });

        return this.launchPromise;
    }

    /**
     * 获取动态渲染后的 HTML
     * @param url 目标网址
     * @param optionsOrWaitSelector 抓取选项或等待的选择器
     * @returns 渲染后的 HTML
     */
    static async fetchHtml(url: string, optionsOrWaitSelector?: string | FetchOptions): Promise<string> {
        let options: FetchOptions = {};
        if (typeof optionsOrWaitSelector === 'string') {
            options = { waitSelector: optionsOrWaitSelector };
        } else if (optionsOrWaitSelector) {
            options = optionsOrWaitSelector;
        }

        // 获取共享浏览器实例
        const browser = await this.getBrowser();

        // 为每个请求创建独立的隔离环境 (BrowserContext)
        // 这样可以规避 Windows 临时目录导致的 EBUSY 错误，且相互不干扰 Cookies
        const context = await browser.createBrowserContext();

        try {
            const page = await context.newPage();

            // 设置 UA 和视口
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            // 应用配置
            if (options.cookies && options.cookies.length > 0) {
                await page.setCookie(...options.cookies);
            }
            if (options.headers) {
                await page.setExtraHTTPHeaders(options.headers);
            }

            console.log(`[DynamicEngine] [${Date.now()}] Navigating to: ${url}`);

            // 访问页面
            await page.goto(url, {
                waitUntil: 'networkidle2', // 使用 networkidle2 代替 networkidle0，对慢速政府网站更友好
                timeout: options.timeout || 90000 // 增加总超时时间
            });

            // 等待特定元素或缓冲
            if (options.waitSelector) {
                try {
                    // 增加等待选择器的时间到 30秒
                    await page.waitForSelector(options.waitSelector, { timeout: 30000 });
                } catch (e) {
                    console.warn(`[DynamicEngine] Wait selector timeout: ${options.waitSelector}, but returning current content anyway.`);
                    // 超时了也返回当前内容，总比直接报错好
                }
            }

            // 额外留出渲染缓冲
            await new Promise(r => setTimeout(r, 2000));

            const content = await page.content();

            // 调试用截图
            try {
                const screenshotDir = path.join(process.cwd(), 'scripts', 'screenshots');
                if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
                const screenshotPath = path.join(screenshotDir, `render_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: false });
            } catch (shotErr) { }

            return content;

        } catch (error: any) {
            console.error(`[DynamicEngine] Fetching error for ${url}: ${error.message}`);
            throw error;
        } finally {
            // 只关闭隔离的 Context，极其稳健，不会导致主进程崩溃
            try {
                await context.close();
            } catch (closeErr: any) {
                console.warn(`[DynamicEngine] Context cleanup warning: ${closeErr.message}`);
            }
        }
    }

    /**
     * 手动关闭浏览器（如程序退出时）
     */
    static async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
