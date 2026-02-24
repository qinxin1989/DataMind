---
name: web
description: 网络访问能力（抓取网页、HTTP 请求、获取时间）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: fetchUrl
    description: 获取网页内容（GET 请求）
  - name: httpRequest
    description: 发送自定义 HTTP 请求
  - name: getCurrentTime
    description: 获取服务器当前时间
---

对 URL 自动补全 https://。超时默认 15 秒。
