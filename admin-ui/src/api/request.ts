import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'
import type { ApiResponse } from '@/types'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// AI 请求专用实例，超时时间更长（3分钟）
const aiRequest = axios.create({
  baseURL: '/api',
  timeout: 180000, // 3分钟
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// AI 请求拦截器
aiRequest.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<ApiResponse>) => {
    const { response } = error
    if (response) {
      const { status, data } = response
      switch (status) {
        case 401:
          message.error('登录已过期，请重新登录')
          localStorage.removeItem('token')
          window.location.href = '/login'
          break
        case 403:
          message.error('没有权限访问')
          break
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error(data?.error?.message || '服务器错误')
          break
        default:
          message.error(data?.error?.message || '请求失败')
      }
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请稍后重试')
    } else {
      message.error('网络连接失败')
    }
    return Promise.reject(error)
  }
)

// AI 响应拦截器
aiRequest.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<ApiResponse>) => {
    const { response } = error
    if (response) {
      const { status, data } = response
      switch (status) {
        case 401:
          message.error('登录已过期，请重新登录')
          localStorage.removeItem('token')
          window.location.href = '/login'
          break
        case 403:
          message.error('没有权限访问')
          break
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error(data?.error?.message || '服务器错误')
          break
        default:
          message.error(data?.error?.message || '请求失败')
      }
    } else if (error.code === 'ECONNABORTED') {
      message.error('AI 请求超时，请稍后重试')
    } else {
      message.error('网络连接失败')
    }
    return Promise.reject(error)
  }
)

export const get = <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
  request.get(url, config)

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
  request.post(url, data, config)

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
  request.put(url, data, config)

export const del = <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
  request.delete(url, config)

// AI 专用请求方法（超时时间更长）
export const aiPost = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
  aiRequest.post(url, data, config)

export const aiGet = <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
  aiRequest.get(url, config)

export default request
