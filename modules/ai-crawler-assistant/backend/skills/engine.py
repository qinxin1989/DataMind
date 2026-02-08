import sys
import json
import requests
from bs4 import BeautifulSoup, Comment
import random
import re
import os
from urllib.parse import urljoin
from datetime import datetime

# 常见的 User-Agent 列表
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
]

def normalize_date(date_str):
    """
    将各种日期格式统一转换为 YYYY-MM-DD 格式
    """
    if not date_str:
        return ""
    
    date_str = date_str.strip()
    
    # 尝试各种日期格式
    patterns = [
        (r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', '%Y-%m-%d'),  # 2025-01-09, 2025.01.09, 2025/01/09
        (r'(\d{4})年(\d{1,2})月(\d{1,2})日', '%Y-%m-%d'),      # 2025年01月09日
        (r'(\d{4})\.(\d{1,2})\.(\d{1,2})', '%Y-%m-%d'),       # 2025.01.09
        (r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', '%d-%m-%Y'), # 09-01-2025
    ]
    
    for pattern, fmt in patterns:
        match = re.search(pattern, date_str)
        if match:
            try:
                if fmt == '%Y-%m-%d':
                    year, month, day = match.groups()
                    return f"{year}-{int(month):02d}-{int(day):02d}"
                elif fmt == '%d-%m-%Y':
                    day, month, year = match.groups()
                    return f"{year}-{int(month):02d}-{int(day):02d}"
            except:
                pass
    
    # 如果无法解析，返回原始字符串
    return date_str

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
        if field_name and any(k in field_name.lower() for k in ['标题', '链接', 'title', 'link', 'url', 'name']):
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
        
        # 2. 日期兜底（增强版：优先搜索 span 等独立标签）
        elif field_name and any(k in field_name.lower() for k in ['日期', '时间', 'date', 'time', 'publish']):
            # 第一优先级：如果找到了 element，尝试从中提取日期
            if element:
                val = element.get_text(strip=True)
                extracted_date = extract_date_from_text(val)
                if extracted_date:
                    return extracted_date

            # 第二优先级：优先搜索 span 标签（日期通常在独立的 span 中）
            spans = container.find_all('span')
            for span in spans:
                span_text = span.get_text(strip=True)
                # 只关注简短文本（可能是日期）
                if len(span_text) < 30:
                    extracted_date = extract_date_from_text(span_text)
                    if extracted_date:
                        return extracted_date

            # 第三优先级：搜索其他可能包含日期的标签
            date_tags = container.find_all(['div', 'time', 'p', 'font', 'b'])
            for tag in date_tags:
                tag_text = tag.get_text(strip=True)
                if len(tag_text) < 30:
                    extracted_date = extract_date_from_text(tag_text)
                    if extracted_date:
                        return extracted_date

            # 第四优先级：容器的完整文本
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
        elif field_name and any(k in field_name.lower() for k in ['类型', '分类', 'type', 'category']):
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
    if field_name and any(k in field_name.lower() for k in ['日期', '时间', 'date', 'time', 'publish']):
        if not val or len(val) > 20:
            extracted_date = extract_date_from_text(val if val else element.get_text())
            if extracted_date:
                return extracted_date
            if container and container.parent:
                extracted_date = extract_date_from_text(container.parent.get_text(separator=' ', strip=True))
                if extracted_date:
                    return extracted_date
                
    return val

def detect_pagination_next(soup, url):
    """
    智能检测下一页按钮的选择器
    返回: (选择器字符串, 下一页URL)
    """
    # 常见的下一页按钮文本和选择器模式
    next_patterns = [
        # 文本模式
        ('a:contains("下一页")', 'text'),
        ('a:contains("下页")', 'text'),
        ('a:contains("下一页>")', 'text'),
        ('a:contains("»")', 'text'),
        ('a:contains("Next")', 'text'),
        ('li.next a', 'class'),
        ('a.next', 'class'),
        ('a[aria-label="next"]', 'attr'),
        ('a[aria-label="Next"]', 'attr'),
        ('.pagination .next a', 'class'),
        ('.pager .next a', 'class'),
    ]

    for pattern, mode in next_patterns:
        if mode == 'text':
            # 查找包含特定文本的链接
            for keyword in ['下一页', '下页', 'Next', 'next', '»', '>']:
                links = soup.find_all('a', string=lambda text: text and keyword in text)
                if links:
                    return 'a', urljoin(url, links[0].get('href', ''))
        elif mode == 'class':
            elements = soup.select(pattern)
            if elements:
                return pattern, urljoin(url, elements[0].get('href', ''))
        elif mode == 'attr':
            elements = soup.select(pattern)
            if elements:
                return pattern, urljoin(url, elements[0].get('href', ''))

    # 尝试查找分页容器中的最后一个链接
    pagination_containers = soup.select('.pagination, .pager, .page, .pagenav')
    for container in pagination_containers:
        links = container.find_all('a', href=True)
        if links:
            # 返回最后一个链接
            return f'.{container.get("class", [""])[0]} a:last-child', urljoin(url, links[-1]['href'])

    return None, None


def crawl(source, selectors, base_url=None, pagination_config=None):
    """
    根据选择器抓取网页数据（支持多页抓取）
    :param source: URL 或 本地文件路径
    :param selectors: 选择器配置
    :param base_url: 用于解析相对链接的基础 URL (如果 source 是文件)
    :param pagination_config: 分页配置 {"enabled": bool, "next_selector": str, "max_pages": int}
    """
    import sys
    try:
        html_content = ""
        actual_url = base_url if base_url else source
        all_results = []
        current_url = source
        page_count = 0
        max_pages = pagination_config.get('max_pages', 1) if pagination_config else 1
        pagination_enabled = pagination_config.get('enabled', False) if pagination_config else False

        while True:
            page_count += 1

            # 获取当前页的 HTML
            if os.path.exists(current_url) and os.path.isfile(current_url):
                # 从本地文件读取
                with open(current_url, 'r', encoding='utf-8') as f:
                    html_content = f.read()
            else:
                # 直接请求 URL
                headers = {
                    'User-Agent': random.choice(USER_AGENTS),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Cache-Control': 'max-age=0',
                    'Referer': actual_url
                }

                response = requests.get(current_url, headers=headers, timeout=20)
                response.raise_for_status()

                if response.encoding == 'ISO-8859-1':
                    response.encoding = response.apparent_encoding or 'utf-8'
                html_content = response.text

            soup = BeautifulSoup(html_content, 'html.parser')

            container_selector = selectors.get('container')
            fields = selectors.get('fields', {})

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

                # 处理 BS4 不支持的伪类
                if ':first-of-type' in sel:
                    sel = sel.replace(':first-of-type', '')

                return sel, attr

            # 提取当前页数据
            if container_selector:
                print(f'[Engine] Searching for container: {container_selector}', file=sys.stderr)
                containers = soup.select(container_selector)
                print(f'[Engine] Found {len(containers)} items', file=sys.stderr)
                
                if len(containers) == 0:
                     print(f'[Engine] HTML Start: {html_content[:500]}', file=sys.stderr)

                for item in containers:
                    data = {}
                    for field_name, selector in fields.items():
                        sel, attr = parse_selector(selector)
                        try:
                            element = item.select_one(sel) if sel else item
                            data[field_name] = get_field_data(element, attr, actual_url, field_name, item)
                        except:
                            data[field_name] = ""
                    all_results.append(data)

            # 检查是否需要继续抓取下一页
            if not pagination_enabled or page_count >= max_pages:
                break

            # 检测下一页链接
            next_selector, next_url = None, None

            if pagination_config and pagination_config.get('next_selector'):
                # 使用配置的选择器
                next_selector = pagination_config['next_selector']
                next_elem = soup.select_one(next_selector)
                if next_elem and next_elem.get('href'):
                    next_url = urljoin(actual_url, next_elem['href'])
            else:
                # 自动检测
                next_selector, next_url = detect_pagination_next(soup, actual_url)

            # 如果没有下一页或URL重复，则停止
            if not next_url or next_url == current_url:
                break

            print(f'[Pagination] Crawling page {page_count + 1}: {next_url}', file=sys.stderr)
            current_url = next_url

        # 过滤无效行
        # 只要任意字段有值即可保留
        all_results = [r for r in all_results if any(v for v in r.values() if v and str(v).strip())]

        # 格式化日期字段为 YYYY-MM-DD
        for item in all_results:
            for key, value in item.items():
                if ('日期' in key or '时间' in key) and value:
                    item[key] = normalize_date(str(value))

        return {
            "success": True,
            "data": all_results,
            "count": len(all_results),
            "pages_crawled": page_count
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

    source_arg = sys.argv[1]
    selectors_arg = json.loads(sys.argv[2])
    base_url_arg = sys.argv[3] if len(sys.argv) > 3 else None
    pagination_arg = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None

    result = crawl(source_arg, selectors_arg, base_url_arg, pagination_arg)
    # 使用默认 ensure_ascii=True 以输出 \uXXXX 转义序列，避免终端编码导致的乱码
    print(json.dumps(result, ensure_ascii=True))
