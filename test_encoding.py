import requests
import chardet

url = "https://data.tj.gov.cn/zwgk/zcwj/"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

try:
    response = requests.get(url, headers=headers, timeout=15)
    print(f"Status: {response.status_code}")
    print(f"Header Content-Type: {response.headers.get('Content-Type')}")
    print(f"Encoding (requests): {response.encoding}")
    print(f"Apparent Encoding: {response.apparent_encoding}")
    
    # Raw check
    raw_content = response.content[:1000]
    detected = chardet.detect(raw_content)
    print(f"Chardet detection: {detected}")
    
    # Try different decodings
    test_encodings = ['utf-8', 'gbk', 'gb18030']
    for enc in test_encodings:
        try:
            text = response.content[:100].decode(enc)
            print(f"Decoded with {enc} (first 50 chars): {text[:50]}")
        except Exception as e:
            print(f"Failed to decode with {enc}: {e}")

except Exception as e:
    print(f"Error: {e}")
