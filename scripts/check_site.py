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
for script in (root / 'assets').rglob('*'):
    if script.suffix not in ('.js', '.mjs'):
        continue
    source = script.read_text(encoding='utf-8')
    subprocess.run(['node', '--input-type=module', '--check'], input=source, text=True, check=True)
    assert '/Users/' not in source
    assert '__OFFICE_MODEL__' not in source and '__OFFICE_MANIFEST__' not in source
for asset in ('assets/court.mp4', 'assets/lawyer-portrait.jpg'):
    assert asset in game and (root / asset).is_file()
assert (root / 'assets/court.mp4').stat().st_size > 1_000_000
assert 'file:///' not in game and '/Users/' not in game
print('Static pages, all relative links, game assets and JavaScript syntax: PASS')

# Real glTF geometry, not just a room illustration.
import json, struct
model = (root / 'assets/models/office.glb').read_bytes()
assert model[:4] == b'glTF' and struct.unpack_from('<I', model, 4)[0] == 2
assert struct.unpack_from('<I', model, 8)[0] == len(model)
chunk_length = struct.unpack_from('<I', model, 12)[0]
gltf = json.loads(model[20:20+chunk_length])
objects = {node.get('name') for node in gltf['nodes']}
for name in ('Laptop','ScreenAnchor','Phone','FolderCurrent','FolderArchive','FountainPen','Bookshelf','Mirror','CityMap','Lawyer','Desk','BankersLamp','Cactus','TripoChair'):
    assert name in objects, f'Missing interactive model: {name}'
assert gltf.get('cameras') and len(model) < 10_000_000
assert (root / 'assets/vendor/three/LICENSE').is_file()
print('Real 3D scene, screen anchor, office props and local runtime: PASS')

# This release includes the generated Tripo chair after Blender optimization.
import hashlib
office = json.loads((root / 'assets/models/office-manifest.json').read_text())
assert office.get('tripoUsed') is True, 'The release must include the actual Tripo model'
chair = root.parent / 'art/office/tripo-chair.glb'
provenance = json.loads(chair.with_suffix('.json').read_text())
assert provenance['optimizedSHA256'] == hashlib.sha256(chair.read_bytes()).hexdigest()
assert chair.stat().st_size < 8_000_000
print('Tripo source provenance and optimized chair integrity: PASS')

# All six requested replacements must be genuine, versioned Tripo source assets.
expected = {'Desk','Laptop','BankersLamp','Bookshelf','Phone','Cactus'}
assets = office.get('tripoAssets', [])
assert {asset['objectName'] for asset in assets} == expected, 'Incomplete Tripo office replacement'
assert len(assets) == len(expected), 'Duplicate office source entry'
for asset in assets:
    relative = Path(asset['referenceSource'])
    assert not relative.is_absolute() and '..' not in relative.parts
    source = root.parent / relative
    assert source.is_file() and source.suffix == '.glb'
    payload = source.read_bytes()
    assert asset['sourceSha256'] == hashlib.sha256(payload).hexdigest()
    assert asset['sourceBytes'] == len(payload)
    assert len(payload) < 3_000_000, f'Object exceeds browser source budget: {source.name}'
    provenance = json.loads(source.with_suffix('.json').read_text())
    assert provenance['optimizedSHA256'] == asset['sourceSha256']
    assert provenance['originalSHA256'] == asset['originalDownloadSha256']
    assert provenance['generationId'] == asset['generationId'] and asset['generationId']
    assert 'Tripo' in provenance['service']
    length = struct.unpack_from('<I', payload, 12)[0]
    obj = json.loads(payload[20:20+length])
    assert obj.get('meshes') and obj.get('materials') and obj.get('images')
    assert all('uri' not in item for item in obj.get('buffers', []) + obj.get('images', [])), 'A source GLB must embed its resources'
    assert asset['objectName'] in office['labelAnchors']
actual_triangles = sum(
    gltf['accessors'][primitive['indices']]['count'] // 3
    for node in gltf['nodes'] if 'mesh' in node
    for primitive in gltf['meshes'][node['mesh']]['primitives']
)
assert office['triangles'] == actual_triangles, 'Manifest geometry count differs from exported GLB'
assert actual_triangles <= 200_000, 'Office geometry exceeds mobile budget'
assert all('uri' not in item for item in gltf.get('buffers', []) + gltf.get('images', []))
assert office['glbBytes'] == len(model)
assert office['screen']['anchor'] == 'ScreenAnchor'
assert office['phoneScreen']['parent'] == 'Phone'
for surface in ('screen','phoneScreen'):
    assert office[surface]['width'] > 0 and office[surface]['height'] > 0
    assert office[surface]['domWidth'] > 0 and office[surface]['domHeight'] > 0
print('Six Tripo objects, embedded resources, provenance, screen contracts and mobile asset budget: PASS')
