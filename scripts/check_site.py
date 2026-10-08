"""Check the deployed layout, relative asset paths and JavaScript syntax."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1] / 'site'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('src', 'href', 'poster') and value:
                self.references.append(value)

for page in root.glob('*.html'):
    text = page.read_text(encoding='utf-8')
    assert '__PORTRAIT__' not in text and '__VIDEO__' not in text
    parser = Links()
    parser.feed(text)
    for link in parser.references:
        url = urlsplit(link)
        if url.scheme or link.startswith('#'):
            continue
        target = (page.parent / unquote(url.path)).resolve()
        assert target.is_relative_to(root.resolve()), f'Asset escapes published directory: {link}'
        assert target.is_file(), f'Missing {link} in {page.name}'
    for code in re.findall(r'<script>(.*?)</script>', text, flags=re.S):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', encoding='utf-8') as tmp:
            tmp.write(code)
            tmp.flush()
            subprocess.run(['node', '--check', tmp.name], check=True)

game = (root / 'index.html').read_text(encoding='utf-8')
for script in (root / 'assets').glob('*.js'):
    subprocess.run(['node', '--check', str(script)], check=True)
    assert '/Users/' not in script.read_text(encoding='utf-8')
for asset in ('assets/court.mp4', 'assets/lawyer-portrait.jpg'):
    assert asset in game and (root / asset).is_file()
assert (root / 'assets/court.mp4').stat().st_size > 1_000_000
assert 'file:///' not in game and '/Users/' not in game
print('Static pages, all relative links, game assets and JavaScript syntax: PASS')
