"""Build a reproducible static game, with local 3D models and vendored runtime."""
from pathlib import Path
import hashlib
import shutil

root = Path(__file__).resolve().parents[1]
assets = root / 'site/assets'
assets.mkdir(exist_ok=True, parents=True)
fragment = (root / 'source/interface.html').read_text(encoding='utf-8')
fragment = fragment.replace('__PORTRAIT__', 'assets/lawyer-portrait.jpg').replace('__VIDEO__', 'assets/court.mp4')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]

for folder in ('models', 'vendor'):
    target = assets / folder
    target.mkdir(exist_ok=True, parents=True)
    for source in sorted((root / 'source' / folder).rglob('*')):
        if not source.is_file() or source.suffix.startswith('.blend'):
            continue
        output = target / source.relative_to(root / 'source' / folder)
        output.parent.mkdir(exist_ok=True, parents=True)
        shutil.copyfile(source, output)

replacements = {
    '__OFFICE_MODEL__': 'models/office.glb?v=' + digest(root / 'source/models/office.glb'),
    '__OFFICE_MANIFEST__': 'models/office-manifest.json?v=' + digest(root / 'source/models/office-manifest.json'),
}
for name in ('game.css', 'office.css', 'office.mjs', 'game-webmcp.js', 'cases.js', 'engine.js', 'game.js'):
    text = (root / 'source' / name).read_text(encoding='utf-8')
    for key, value in replacements.items():
        text = text.replace(key, value)
    output = assets / name
    output.write_text(text, encoding='utf-8')
    fragment = fragment.replace(f'assets/{name}"', f'assets/{name}?v={digest(output)}"')
fragment = fragment.replace('assets/models/office-preview.png"', 'assets/models/office-preview.png?v='+digest(root/'source/models/office-preview.png')+'"')
header = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#183c2d"><meta name="description" content="Хороший адвокат: стратегический триллер. Трёхмерный кабинет, десять глав и ваша линия защиты."><title>Хороший адвокат — Северный берег</title></head><body>
'''
(root / 'site/index.html').write_text(header + fragment + '\n</body></html>', encoding='utf-8')
shutil.copyfile(root / 'source/scenario.html', root / 'site/scenario.html')
(root / 'site/.nojekyll').touch()
print('Built game, 3D office, models and local rendering runtime')
