import sys
import json
import requests
from bs4 import BeautifulSoup, Comment
import random
import re
from urllib.parse import urljoin

# 常见的 User-Agent 列表
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
]

def clean_html_content(element):
    """
    智能清理 HTML 内容：
    1. 移除 style, class 等视觉相关的属性
    2. 保留 a 标签的 href
    3. 保留换行和回车结构
    4. 保留附件相关的标识（如文档链接）
    """
    if not element:
        return ""

    # 克隆一份以防修改原始 soup
    # (在 BS4 中直接处理即可)
    
    # 移除注释
    for comment in element.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # 允许的标签和属性
    # 这里我们采用“剥离样式”策略，而不是白名单过滤
    for tag in element.find_all(True):
        # 移除 style 属性（颜色、文字大小等）
        if tag.has_attr('style'):
            del tag['style']
        
        # 移除一些常见的视觉 class (可选，因为 class 通常也在 CSS 中定义)
        # if tag.has_attr('class'):
        #     del tag['class']

        # 如果是 a 标签，保留 href
        if tag.name == 'a':
            # 记录跳转地址
            href = tag.get('href', '')
            if href:
                # 可以在文本中显式标注，或者保持 HTML 结构
                pass
        
        # 处理换行：将块级元素或明确的 br 转换为 \n
        if tag.name in ['p', 'div', 'br', 'li', 'tr']:
            # 在 BS4 的 get_text 中通过 separator 参数处理通常更稳
            pass

    # 使用 separator='\n' 来保留块级元素的换行感
    # 但为了保留 a 标签链接，我们可能需要更精细的处理
    
    # 获取带结构的文本
    # 如果用户需要 HTML 明细（带 a 标签），则直接返回部分清理后的 HTML
    # 如果用户需要纯文本带换行和链接，则进行转换
    
    return str(element)

def extract_date_from_text(text):
    """
    从文本中通过正则提取日期格式 (支持多种分隔符及可选的前后缀)
    """
    if not text:
        return ""
    # 匹配常见日期模式 (优先匹配完整年份)
    patterns = [
        r'\d{4}[-/.]\d{1,2}[-/.]\d{1,2}',        # YYYY-MM-DD
        r'\d{4}年\d{1,2}月\d{1,2}日',            # YYYY年MM月DD日
        r'\[\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\]',  # [YYYY-MM-DD]
        r'\d{1,2}[-/.]\d{1,2}[-/.]\d{4}',        # DD-MM-YYYY
        r'\d{1,2}月\d{1,2}日',                  # MM月DD日
        # 新增：相对日期表达
        r'\d{1,2}天前',                          # X天前
        r'昨天|今天|前天',                       # 相对日期
        r'\d{1,2}小时前',                        # X小时前
        # 新增：英文月份
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}',
        # 新增：纯数字紧凑格式
        r'\d{8}',                                # YYYYMMDD
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            # 清理匹配结果中的空白或括号
            return match.group(0).strip('[] ')
    return ""

def get_field_data(element, attr=None, base_url=None, field_name=None, container=None):
    """
    提取字段数据并进行结构化清理。
    如果 element 为空且提供了 container，则在 container 中进行启发式搜索。
    """
    # 启发式兜底逻辑
    if not element and container:
        # 1. 标题与链接兜底
        if field_name and ('标题' in field_name or '链接' in field_name):
            # 优先找含有 href 的链接
            links = container.find_all('a', href=True)
            if not links:
                links = container.find_all('a')
            
            if links:
                if '链接' in field_name:
                    # 找到第一个非 javascript 的链接
                    element = next((l for l in links if l.get('href') and not l.get('href').startswith('javascript:')), links[0])
                    attr = 'href'
                else:
                    # 标题取文本最长的链接
                    element = max(links, key=lambda l: len(l.get_text(strip=True)))
            else:
                # 连 a 标签都没有，强制取非空的文本块（且避开日期）
                # 获取容器内的所有直属文本节点或小标签文本
                texts = [t.strip() for t in container.find_all(string=True) if len(t.strip()) > 5]
                # 过滤掉明显的日期和类型（通过长度和正则）
                potential_titles = [t for t in texts if not extract_date_from_text(t) and len(t) < 100]
                if potential_titles:
                    return max(potential_titles, key=len)
        
        # 2. 日期兜底
        elif field_name and ('日期' in field_name or '时间' in field_name):
            text = container.get_text(separator=' ', strip=True)
            extracted_date = extract_date_from_text(text)
            
            # 向前后兄弟节点扩展搜索（增加搜索范围）
            if not extracted_date:
                # 搜索后向兄弟（扩大到 5 个）
                for sib in list(container.next_siblings)[:5]:
                    if sib.name:
                        extracted_date = extract_date_from_text(sib.get_text())
                        if extracted_date: break
                # 搜索前向兄弟（扩大到 5 个）
                if not extracted_date:
                    for sib in list(container.previous_siblings)[:5]:
                        if sib.name:
                            extracted_date = extract_date_from_text(sib.get_text())
                            if extracted_date: break

            # 最后兜底搜父级（增强：向上搜索 2 层）
            if not extracted_date and container.parent:
                extracted_date = extract_date_from_text(container.parent.get_text(separator=' ', strip=True))

            # 向上再搜索一层
            if not extracted_date and container.parent and container.parent.parent:
                extracted_date = extract_date_from_text(container.parent.parent.get_text(separator=' ', strip=True))

            if extracted_date:
                return extracted_date

        # 3. 类型兜底
        elif field_name and ('类型' in field_name or '分类' in field_name):
            text = container.get_text(separator=' ', strip=True)
            match = re.search(r'^([【\[\(].*?[】\]\)])|^([^|:：]*?)(?=\s*[|:：])', text)
            if match:
                type_val = (match.group(1) or match.group(2)).strip('【】[]() |:：')
                if 2 <= len(type_val) < 15: return type_val
            
            keywords = ['解读', '政策', '文件', '通知', '公告', '公示', '指南', '动态', '要闻']
            for kw in keywords:
                if kw in text: return kw

    if not element:
        return ""
    
    val = ""
    if attr:
        val = element.get(attr, "").strip()
        if val and attr in ['href', 'src'] and base_url:
            return urljoin(base_url, val)
    else:
        val = element.get_text(separator=' ', strip=True)

    # 针对日期的二次清洗
    if field_name and ('日期' in field_name or '时间' in field_name):
        if not val or len(val) > 20:
            extracted_date = extract_date_from_text(val if val else element.get_text())
            if extracted_date:
                return extracted_date
            if container and container.parent:
                extracted_date = extract_date_from_text(container.parent.get_text(separator=' ', strip=True))
                if extracted_date:
                    return extracted_date
                
    return val

def crawl(url, selectors):
    """
    根据选择器抓取网页数据
    """
    try:
        headers = {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': url
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        # 优化编码识别逻辑
        if response.encoding == 'ISO-8859-1':
            response.encoding = response.apparent_encoding or 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        container_selector = selectors.get('container')
        fields = selectors.get('fields', {})
        
        results = []
        
        def parse_selector(sel):
            """解析选择器，支持 ::attr(name) 和 :first-of-type 兼容"""
            attr = None
            if not sel:
                return sel, attr
            
            # 处理 Scrapy 风格的属性提取 a::attr(href)
            if '::attr(' in sel:
                match = re.search(r'(.*?)::attr\((.*?)\)', sel)
                if match:
                    sel = match.group(1).strip()
                    attr = match.group(2).strip()
            
            # 处理 BS4 不支持的伪类（简单移除作为兜底，或者改为 select 逻辑）
            if ':first-of-type' in sel:
                sel = sel.replace(':first-of-type', '')
            
            return sel, attr

        if container_selector:
            # 列表抓取模式
            containers = soup.select(container_selector)
            for item in containers:
                data = {}
                for field_name, selector in fields.items():
                    sel, attr = parse_selector(selector)
                    try:
                        element = item.select_one(sel) if sel else item
                        # 传入 item 作为 container，以便在 element 为空时进行启发式兜底
                        data[field_name] = get_field_data(element, attr, url, field_name, item)
                    except:
                        data[field_name] = ""
                results.append(data)
        else:
            # 单页面抓取模式
            data = {}
            for field_name, selector in fields.items():
                sel, attr = parse_selector(selector)
                try:
                    element = soup.select_one(sel) if sel else None
                    # 单页面模式下，soup 即为最高的 container
                    data[field_name] = get_field_data(element, attr, url, field_name, soup)
                except:
                    data[field_name] = ""
            results.append(data)
            
        return {
            "success": True,
            "data": results,
            "count": len(results)
        }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "trace": traceback.format_exc()
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Arguments missing"}))
        sys.exit(1)
        
    url_arg = sys.argv[1]
    selectors_arg = json.loads(sys.argv[2])
    
    result = crawl(url_arg, selectors_arg)
    # 使用默认 ensure_ascii=True 以输出 \uXXXX 转义序列，避免终端编码导致的乱码
    print(json.dumps(result))
