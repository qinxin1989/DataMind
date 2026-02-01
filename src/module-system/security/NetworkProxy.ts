/**
 * 网络代理
 * 提供网络访问控制和域名白名单
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { permissionManager, PermissionType } from './PermissionManager';

/**
 * HTTP 请求选项
 */
export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
}

/**
 * HTTP 响应
 */
export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
}

/**
 * 网络代理类
 */
export class NetworkProxy {
  private requestLog: Map<string, number> = new Map();
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly DEFAULT_TIMEOUT = 30000; // 30秒

  /**
   * 检查请求频率
   */
  private checkRateLimit(moduleName: string): void {
    const now = Date.now();
    const key = `${moduleName}:${Math.floor(now / 60000)}`;
    
    const count = this.requestLog.get(key) || 0;
    if (count >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error(`Rate limit exceeded: ${moduleName} has made too many requests`);
    }
    
    this.requestLog.set(key, count + 1);
    
    // 清理旧记录
    for (const [k] of this.requestLog) {
      if (!k.startsWith(moduleName)) continue;
      const timestamp = parseInt(k.split(':')[1]);
      if (now - timestamp * 60000 > 120000) { // 2分钟前的记录
        this.requestLog.delete(k);
      }
    }
  }

  /**
   * 验证域名访问权限
   */
  private validateDomain(moduleName: string, url: string): void {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    
    // 检查协议权限
    const protocol = parsedUrl.protocol.replace(':', '');
    const permissionType = protocol === 'https' 
      ? PermissionType.NETWORK_HTTPS 
      : PermissionType.NETWORK_HTTP;
    
    if (!permissionManager.hasPermission(moduleName, permissionType)) {
      throw new Error(
        `Permission denied: ${moduleName} does not have ${permissionType} permission`
      );
    }
    
    // 检查域名白名单
    if (!permissionManager.canAccessDomain(moduleName, domain)) {
      throw new Error(
        `Access denied: ${moduleName} cannot access domain ${domain}`
      );
    }
  }

  /**
   * 发送 HTTP 请求 (代理)
   */
  async request(
    moduleName: string,
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse> {
    // 检查频率限制
    this.checkRateLimit(moduleName);
    
    // 验证域名
    this.validateDomain(moduleName, url);
    
    // 解析 URL
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // 构建请求选项
    const requestOptions: http.RequestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || this.DEFAULT_TIMEOUT
    };
    
    return new Promise((resolve, reject) => {
      const req = client.request(url, requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers as Record<string, string | string[]>,
            body
          });
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Network request failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Network request timeout: ${url}`));
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * GET 请求
   */
  async get(
    moduleName: string,
    url: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return this.request(moduleName, url, { method: 'GET', headers });
  }

  /**
   * POST 请求
   */
  async post(
    moduleName: string,
    url: string,
    body: string | Buffer,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return this.request(moduleName, url, { method: 'POST', body, headers });
  }

  /**
   * PUT 请求
   */
  async put(
    moduleName: string,
    url: string,
    body: string | Buffer,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return this.request(moduleName, url, { method: 'PUT', body, headers });
  }

  /**
   * DELETE 请求
   */
  async delete(
    moduleName: string,
    url: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return this.request(moduleName, url, { method: 'DELETE', headers });
  }

  /**
   * 获取请求日志
   */
  getRequestLog(moduleName: string): number {
    const now = Date.now();
    const key = `${moduleName}:${Math.floor(now / 60000)}`;
    return this.requestLog.get(key) || 0;
  }

  /**
   * 清空请求日志
   */
  clearRequestLog(moduleName?: string): void {
    if (moduleName) {
      for (const [key] of this.requestLog) {
        if (key.startsWith(moduleName)) {
          this.requestLog.delete(key);
        }
      }
    } else {
      this.requestLog.clear();
    }
  }
}

// 导出单例实例
export const networkProxy = new NetworkProxy();
