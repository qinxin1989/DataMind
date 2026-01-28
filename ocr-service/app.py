"""
PaddleOCR 服务 - 支持 PaddleOCR 3.x
"""

import os
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from flask import Flask, request, jsonify
from flask_cors import CORS
from paddleocr import PaddleOCR
from translate import Translator
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


# 离线翻译字典（针对数据库常见字段）
OFFLINE_DICT = {
    "name": "名称",
    "population": "人口",
    "gnp": "国民生产总值",
    "continent": "大洲",
    "region": "地区",
    "country": "国家",
    "city": "城市",
    "language": "语言",
    "percentage": "百分比",
    "lifeexpectancy": "预期寿命",
    "indepyear": "独立年份",
    "surfacearea": "表面积",
    "governmentform": "政体",
    "headofstate": "国家元首",
    "capital": "首都",
    "code": "编码",
    "district": "地区",
    "id": "ID",
    "total": "总计",
    "count": "数量",
    "sum": "总和",
    "avg": "平均值",
    "min": "最小值",
    "max": "最大值",
    "year": "年份",
    "month": "月份",
    "day": "日期",
    "date": "时间",
    "created_at": "创建时间",
    "updated_at": "更新时间",
    "status": "状态",
    "type": "类型",
    "category": "类别",
    "user": "用户",
    "order": "订单",
    "price": "价格",
    "amount": "金额",
    "is_official": "是否官方",
    "序号": "序号",
    "参赛编号": "参赛编号",
    "作品名称": "作品名称",
    "作品组别": "作品组别",
    "作品分类": "作品分类",
    "设计理念": "设计理念",
    "用户名": "用户名",
    "联系人姓名": "联系人姓名",
    "联系人邮箱": "联系人邮箱",
    "联系手机": "联系手机",
    "联系人": "联系人",
    "手机": "手机",
    "邮箱": "邮箱",
    "手机号": "手机号",
    "单位类型": "单位类型",
    "单位名称": "单位名称",
    "主设计师联系手机": "主设计师联系手机",
    "主设计师": "主设计师",
    "参赛国家": "参赛国家",
    "参赛地区": "参赛地区",
    "参赛地市": "参赛地市",
    "联系人通讯住址": "联系人通讯住址",
    "通讯住址": "通讯住址",
    "住址": "住址",
    "团队成员": "团队成员",
    "学历": "学历",
    "专业": "专业",
    "职务": "职务",
    "职称": "职称",
    "备注": "备注",
}

@app.route('/translate', methods=['POST'])
def translate():
    try:
        if not request.is_json:
            return jsonify({'success': False, 'error': '请提供 JSON 数据'}), 400
        
        data = request.get_json()
        texts = data.get('texts', [])
        target = data.get('target', 'zh-CN')
        
        if not texts:
            return jsonify({'success': False, 'error': '请提供需翻译的文本'}), 400
        
        mapping = {}
        unique_texts = list(set(texts))

        # 离线优先：先查本地字典
        remaining_texts = []
        for text in unique_texts:
            lower_text = text.lower().strip()
            # 1. 字典完全匹配
            if lower_text in OFFLINE_DICT:
                mapping[text] = OFFLINE_DICT[lower_text]
            # 2. 数字/特殊字符处理
            elif text.isdigit() or len(text) <= 1:
                mapping[text] = text
            else:
                remaining_texts.append(text)

        # 3. 剩余文本使用 translate 库处理（尝试离线可用模式）
        if remaining_texts:
            # 注意：translate 库某些模式下仍会尝试联网，这里作为最大努力
            try:
                # 尝试初始化一个简单的翻译器
                translator = Translator(to_lang=target)
                for text in remaining_texts:
                    try:
                        # 只有当文本不包含中意文时翻译
                        if any(c.isalpha() for c in text):
                            trans = translator.translate(text)
                            # 如果翻译结果和原词相同，可能是翻译器不可用或未找到
                            mapping[text] = trans if trans != text else text
                        else:
                            mapping[text] = text
                    except:
                        mapping[text] = text
            except Exception as e:
                print(f"离线翻译库执行异常: {str(e)}")
                for text in remaining_texts:
                    mapping[text] = text
        
        return jsonify({
            'success': True,
            'data': mapping
        })
        
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
