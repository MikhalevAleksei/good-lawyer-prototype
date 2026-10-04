"""Build the self-contained static prototype for GitHub Pages."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
fragment = (root / 'source/interface.html').read_text(encoding='utf-8')
fragment = fragment.replace('__PORTRAIT__', 'assets/lawyer-portrait.jpg')
fragment = fragment.replace('__VIDEO__', 'assets/court.mp4')
header = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Хороший адвокат — игровой прототип</title><style>html{color-scheme:light dark}body{margin:0;padding:32px;background:light-dark(#f5f3ec,#0e1712)}button{cursor:pointer}@media(max-width:640px){body{padding:14px}}</style></head><body>
'''
(root / 'site/index.html').write_text(header + fragment + '\n</body></html>', encoding='utf-8')
(root / 'site/.nojekyll').touch()
print('Built site/index.html')
