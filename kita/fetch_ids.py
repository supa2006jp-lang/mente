import urllib.request
import json
import re

url = "https://unsplash.com/napi/search/photos?query=nature+landscape+sunny+daytime&per_page=30&page=1"
urls = []

# Fetch 4 pages (120 images)
for page in range(1, 5):
    page_url = f"https://unsplash.com/napi/search/photos?query=bright+nature+landscape&per_page=30&page={page}"
    try:
        req = urllib.request.Request(page_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            for res in data.get('results', []):
                # Ensure they are horizontal/landscape
                if res['width'] > res['height']:
                    img_id = res['id']
                    urls.append(f"https://images.unsplash.com/photo-{img_id}?w=1920&q=80")
    except Exception as e:
        print(f"Failed to fetch page {page}: {e}")

# Keep exactly 100
urls = urls[:100]

js_code = "const brightImages = [\n"
for u in urls:
    js_code += f"  '{u}',\n"
js_code += "];"

with open("C:/Users/PC_User/.gemini/antigravity/brain/80205a77-87ca-4c37-be1c-0be5eda2535c/images.txt", "w", encoding="utf-8") as f:
    f.write(js_code)
    
print(f"Saved {len(urls)} URLs")
