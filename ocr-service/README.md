# PaddleOCR 服务

提供基于 HTTP 的 OCR 识别服务，支持中英文混合识别。底层使用 PaddleOCR PP-OCRv4 模型。

## 📥 安装指南

本服务支持 **CPU 模式** 和 **GPU 模式**。请根据您的硬件环境选择一种方式安装。

### 方式一：CPU 版本（推荐，兼容性最好）

适用于无独立显卡、显卡架构较旧（如 Maxwell/Pascal 以前）或不想配置 CUDA 环境的场景。PP-OCRv4 模型非常轻量，CPU 模式下识别速度通常也在 1秒/张 左右，完全满足常规使用。

**1. 修改依赖文件**
编辑 `requirements.txt`：
```text
paddlepaddle==2.6.2
paddleocr==2.7.3
flask==3.0.0
flask-cors==4.0.0
pillow==10.2.0
numpy==1.26.4
```
> **注意**：必须使用 `numpy<2.0`（推荐 1.26.4），否则会导致 Paddle 崩溃。

**2. 安装依赖**
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**3. 配置代码**
编辑 `app.py`，确保禁用 GPU：
```python
# app.py 第21行
ocr = PaddleOCR(lang='ch', use_gpu=False)
```

**4. 启动服务**
```bash
python app.py
```
Windows 用户可直接双击 `start.bat`。

---

### 方式二：GPU 版本（高性能）

适用于有 NVIDIA 显卡（Pascal 架构及以上，如 GTX 10系/20系/30系/40系）且需要高并发的场景。

**1. 环境准备（必须）**
- **NVIDIA 驱动**：安装最新驱动。
- **CUDA Toolkit**：推荐安装 11.8 或 12.3（需与 Paddle版本匹配）。
- **cuDNN**：下载对应 CUDA 版本的 cuDNN 库（8.x版本），解压并将 `bin`, `include`, `lib` 目录内容复制到 CUDA 安装目录。
  - Windows 示例路径：`C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.8`
  - Linux：配置 `LD_LIBRARY_PATH`。

**2. 修改依赖文件**
编辑 `requirements.txt`：
```text
paddlepaddle-gpu==2.6.2
paddleocr==2.7.3
flask==3.0.0
flask-cors==4.0.0
pillow==10.2.0
numpy==1.26.4
```

**3. 安装依赖**
```bash
# 卸载可能存在的 CPU 版本
pip uninstall paddlepaddle -y

# 安装 GPU 版本
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**4. 验证 GPU 环境**
```bash
python -c "import paddle; print(paddle.utils.run_check())"
```
如果输出 `PaddlePaddle is installed successfully!` 且未报错，说明 GPU 环境配置正确。

**5. 配置代码**
编辑 `app.py`，启用 GPU：
```python
# app.py 第21行
ocr = PaddleOCR(lang='ch', use_gpu=True)
```

**6. 启动服务**
```bash
python app.py
```

---

## 🛠️ 常见问题

### Q1: 启动报错 `cudnn64_8.dll not found`
- **原因**：GPU 模式下未安装 cuDNN 或 环境变量未配置。
- **解决**：请参考 [GPU 版本安装步骤1] 下载并配置 cuDNN；或者切换到 CPU 模式。

### Q2: 报错 `RuntimeError: module compiled against ABI version ... but this version of numpy is ...`
- **原因**：NumPy 版本过高（2.x）。
- **解决**：降级 NumPy：
  ```bash
  pip install "numpy<2.0" -i https://pypi.tuna.tsinghua.edu.cn/simple
  ```

### Q3: 报错 `The GPU architecture in your current machine is Maxwell...`
- **原因**：显卡架构太旧（如 GTX 750Ti, 960 等），Paddle 官方预编译包不支持。
- **解决**：只能使用 **方式一：CPU 版本**，或者自行从源码编译 PaddlePaddle。

---

## API 接口说明

服务默认端口：5100

### 1. 健康检查
- **GET** `/health`

### 2. 单图识别
- **POST** `/ocr`
- **参数**（JSON）：`{"image": "base64字符串..."}`
- **参数**（Form-Data）：file=图片文件

### 3. 批量识别
- **POST** `/ocr/batch`
- **参数**：`{"images": ["base64_1", "base64_2"]}`
