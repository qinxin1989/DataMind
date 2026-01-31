"""
诊断爬虫日期提取问题
"""
import requests
from bs4 import BeautifulSoup

url = "https://www.nda.gov.cn/sjj/zwgk/zcfb/list/index_pc_1.html"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

response = requests.get(url, headers=headers, timeout=15)
soup = BeautifulSoup(response.text, 'html.parser')

print("=" * 80)
print("HTML 结构分析")
print("=" * 80)

# 查找列表容器
print("\n1. 查找可能的列表容器:")
print("-" * 80)

# 尝试常见的选择器
selectors_to_try = [
    'ul li',
    '.list-item',
    '.news-list li',
    '[class*="list"] li',
    'li',
]

for selector in selectors_to_try:
    items = soup.select(selector)[:3]  # 只看前3个
    if items:
        print(f"\n选择器 '{selector}' 找到 {len(soup.select(selector))} 个元素")
        for i, item in enumerate(items[:2], 1):
            print(f"\n  第 {i} 个元素:")
            print(f"    HTML: {str(item)[:200]}...")
            print(f"    文本: {item.get_text(strip=True)[:100]}")

# 查找第一个列表项的详细结构
print("\n\n2. 第一个列表项的详细结构:")
print("-" * 80)
first_li = soup.select_one('ul li')
if first_li:
    print(f"标签: {first_li.name}")
    print(f"类名: {first_li.get('class')}")
    print(f"完整HTML:\n{first_li.prettify()[:500]}")

    # 查找子元素
    print(f"\n子元素:")
    for child in first_li.children:
        if hasattr(child, 'name'):
            print(f"  - <{child.name}>: {child.get_text(strip=True)[:50]}")

# 查找日期
print("\n\n3. 查找日期文本:")
print("-" * 80)
import re
date_pattern = r'\d{4}\.\d{1,2}\.\d{1,2}'

for text in soup.stripped_strings:
    if re.search(date_pattern, text):
        # 找到包含日期的文本，查看其父元素
        parent = text.parent
        print(f"\n找到日期: {text}")
        print(f"  父元素: <{parent.name} class='{parent.get('class')}'>")
        print(f"  父元素HTML: {str(parent)[:200]}")
        break
