# PaddleOCR GPU 轻量版 Docker 镜像
FROM paddlepaddle/paddle:2.6.0-gpu-cuda11.7-cudnn8.4-trt8.4

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 预下载模型（轻量版）
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='ch', use_gpu=False)"

# 复制应用代码
COPY app.py .

# 暴露端口
EXPOSE 5100

# 启动服务
CMD ["python", "app.py"]
