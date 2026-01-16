# PaddleOCR 服务 - 轻量 GPU 版本

用于识别 PDF 中的图片文字，支持中英文混合识别。

## 快速启动

### 方式1：直接运行（需要本地 Python + CUDA 环境）

```bash
# 安装依赖
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 启动服务
python app.py
```

Windows 用户可以直接双击 `start.bat`

### 方式2：Docker 运行（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## API 接口

服务默认运行在 `http://localhost:5100`

### 健康检查

```
GET /health
```

### 单图识别

```
POST /ocr
Content-Type: application/json

{
  "image": "base64编码的图片数据"
}
```

或者上传文件：

```
POST /ocr
Content-Type: multipart/form-data

file: 图片文件
```

响应：

```json
{
  "success": true,
  "text": "识别出的完整文本",
  "lines": ["第一行", "第二行", ...],
  "count": 10
}
```

### 批量识别（PDF 多页）

```
POST /ocr/batch
Content-Type: application/json

{
  "images": ["base64图片1", "base64图片2", ...]
}
```

响应：

```json
{
  "success": true,
  "text": "所有页面合并的文本",
  "pages": [
    {"page": 1, "text": "第1页文本", "lines": [...]},
    {"page": 2, "text": "第2页文本", "lines": [...]}
  ],
  "total_pages": 2
}
```

## GPU 要求

- NVIDIA GPU（显存 >= 4GB）
- CUDA 11.7+
- cuDNN 8.4+

如果没有 GPU，会自动回退到 CPU 模式（速度较慢）。

## 模型说明

使用 PaddleOCR 官方轻量模型：
- 检测模型：ch_PP-OCRv4_det（~4.7MB）
- 识别模型：ch_PP-OCRv4_rec（~10MB）
- 方向分类：ch_ppocr_mobile_v2.0_cls（~1.4MB）

首次运行会自动下载模型到 `~/.paddleocr/` 目录。
