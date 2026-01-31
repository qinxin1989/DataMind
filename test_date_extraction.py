"""
临时补丁：在 get_field_data 函数的日期兜底部分添加 span 优先搜索
在 elif field_name and ('日期' in field_name or '时间' in field_name): 之后添加以下代码：

# 优先搜索 span 标签中的日期
spans = container.find_all('span')
for span in spans:
    span_text = span.get_text(strip=True)
    # 只关注简短文本（可能是日期）
    if len(span_text) < 30:
        extracted_date = extract_date_from_text(span_text)
        if extracted_date:
            return extracted_date
"""

# 测试新的日期提取逻辑
import re
from bs4 import BeautifulSoup

def extract_date_from_text(text):
    if not text:
        return ""
    patterns = [
        r'\d{4}[-/.]\d{1,2}[-/.]\d{1,2}',
        r'\d{4}年\d{1,2}月\d{1,2}日',
        r'\[\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\]',
        r'\d{1,2}[-/.]\d{1,2}[-/.]\d{4}',
        r'\d{1,2}月\d{1,2}日',
        r'\d{1,2}天前',
        r'昨天|今天|前天',
        r'\d{1,2}小时前',
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}',
        r'\d{8}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).strip('[] ')
    return ""

# 模拟 HTML 结构
html = """
<li>
  <a href="/test.html">工业和信息化部等八部门关于印发《"人工智能+制造"专项行动实施意见》的通知</a>
  <span>2026.01.09</span>
</li>
"""

soup = BeautifulSoup(html, 'html.parser')
container = soup.find('li')

print("=" * 60)
print("测试日期提取优化")
print("=" * 60)

# 新逻辑：优先搜索 span
spans = container.find_all('span')
print(f"\n找到 {len(spans)} 个 span 标签")

for i, span in enumerate(spans, 1):
    span_text = span.get_text(strip=True)
    print(f"Span {i}: {repr(span_text)}")
    if len(span_text) < 30:
        extracted_date = extract_date_from_text(span_text)
        if extracted_date:
            print(f"  ✅ 提取到日期: {repr(extracted_date)}")
        else:
            print(f"  ❌ 未能提取日期")
