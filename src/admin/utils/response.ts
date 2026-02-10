/**
 * 统一 API 响应辅助函数
 */

import type { ApiResponse } from '../types';

/** 成功响应 */
export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
export function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}
