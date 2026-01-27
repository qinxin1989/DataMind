"""
PaddleOCR 服务 - 支持 PaddleOCR 3.x
"""

import os
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from flask import Flask, request, jsonify
from flask_cors import CORS
from paddleocr import PaddleOCR
import base64
import io
from PIL import Image
import numpy as np
import tempfile

app = Flask(__name__)
CORS(app)

# 初始化 PaddleOCR 3.x
ocr = PaddleOCR(lang='ch', use_gpu=False)
print("PaddleOCR 初始化完成")


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/ocr', methods=['POST'])
def ocr_recognize():
    try:
        if request.is_json:
            data = request.get_json()
            image_base64 = data.get('image')
            if image_base64:
                if ',' in image_base64:
                    image_base64 = image_base64.split(',')[1]
                image_data = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_data))
                
                if image.mode == 'RGBA':
                    image = image.convert('RGB')
                
                img_array = np.array(image)
                print(f"图片尺寸: {img_array.shape}")
                
                result = ocr.ocr(img_array)
                print(f"OCR结果类型: {type(result)}")
                
                text_lines = extract_text(result)
                
                return jsonify({
                    'success': True,
                    'text': '\n'.join(text_lines),
                    'lines': text_lines,
                    'count': len(text_lines)
                })
        
        elif 'file' in request.files:
            file = request.files['file']
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            
            try:
                result = ocr.ocr(tmp_path)
                text_lines = extract_text(result)
                return jsonify({
                    'success': True,
                    'text': '\n'.join(text_lines),
                    'lines': text_lines,
                    'count': len(text_lines)
                })
            finally:
                os.unlink(tmp_path)
        
        return jsonify({'success': False, 'error': '请提供图片数据'}), 400
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/ocr/batch', methods=['POST'])
def ocr_batch():
    try:
        if not request.is_json:
            return jsonify({'success': False, 'error': '请提供 JSON 数据'}), 400
        
        data = request.get_json()
        images = data.get('images', [])
        
        if not images:
            return jsonify({'success': False, 'error': '请提供图片列表'}), 400
        
        results = []
        for i, image_base64 in enumerate(images):
            try:
                if ',' in image_base64:
                    image_base64 = image_base64.split(',')[1]
                image_data = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_data))
                if image.mode == 'RGBA':
                    image = image.convert('RGB')
                img_array = np.array(image)
                result = ocr.ocr(img_array)
                text_lines = extract_text(result)
                results.append({
                    'page': i + 1,
                    'text': '\n'.join(text_lines),
                    'lines': text_lines
                })
            except Exception as e:
                results.append({'page': i + 1, 'text': '', 'error': str(e)})
        
        all_text = '\n\n'.join([r['text'] for r in results if r.get('text')])
        return jsonify({
            'success': True,
            'text': all_text,
            'pages': results,
            'total_pages': len(results)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def extract_text(result):
    """从 PaddleOCR 3.x 结果中提取文本"""
    text_lines = []
    
    if not result:
        return text_lines
    
    # PaddleOCR 3.x 返回格式可能是:
    # 1. [{'rec_texts': [...], 'rec_scores': [...], ...}]
    # 2. [[box, (text, score)], ...]
    
    for item in result:
        if item is None:
            continue
        
        # 格式1: 字典格式 (PaddleOCR 3.x 新格式)
        if isinstance(item, dict):
            if 'rec_texts' in item:
                texts = item.get('rec_texts', [])
                for t in texts:
                    if t and str(t).strip():
                        text_lines.append(str(t).strip())
            continue
        
        # 格式2: 列表格式
        if isinstance(item, list):
            for sub_item in item:
                if sub_item is None:
                    continue
                
                # 子项是字典
                if isinstance(sub_item, dict):
                    if 'rec_texts' in sub_item:
                        texts = sub_item.get('rec_texts', [])
                        for t in texts:
                            if t and str(t).strip():
                                text_lines.append(str(t).strip())
                
                # 子项是 [box, (text, score)] 格式
                elif isinstance(sub_item, (list, tuple)) and len(sub_item) >= 2:
                    text_part = sub_item[1]
                    if isinstance(text_part, (list, tuple)) and len(text_part) >= 1:
                        text = str(text_part[0]).strip()
                        if text:
                            text_lines.append(text)
                    elif isinstance(text_part, str) and text_part.strip():
                        text_lines.append(text_part.strip())
    
    print(f"提取到 {len(text_lines)} 行: {text_lines[:3]}...")
    return text_lines


if __name__ == '__main__':
    port = int(os.environ.get('OCR_PORT', 5100))
    print(f"PaddleOCR 服务启动在 http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
