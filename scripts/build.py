"""Build the static prototype reproducibly, with content-versioned assets."""
from pathlib import Path
import hashlib
import shutil

root = Path(__file__).resolve().parents[1]
fragment = (root / 'source/interface.html').read_text(encoding='utf-8')
fragment = fragment.replace('__PORTRAIT__', 'assets/lawyer-portrait.jpg')
fragment = fragment.replace('__VIDEO__', 'assets/court.mp4')
for name in ('game.css', 'cases.js', 'engine.js', 'game.js'):
    source = root / 'source' / name
    shutil.copyfile(source, root / 'site/assets' / name)
    version = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
    fragment = fragment.replace(f'assets/{name}"', f'assets/{name}?v={version}"')
header = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#183c2d"><meta name="description" content="Хороший адвокат: стратегический триллер. Десять глав, два устройства, ваша линия защиты."><title>Хороший адвокат — Северный берег</title></head><body>
'''
(root / 'site/index.html').write_text(header + fragment + '\n</body></html>', encoding='utf-8')
shutil.copyfile(root / 'source/scenario.html', root / 'site/scenario.html')
(root / 'site/.nojekyll').touch()
print('Built site/index.html')
