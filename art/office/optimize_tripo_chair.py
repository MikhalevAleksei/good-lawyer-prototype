"""Optimize a downloaded Tripo chair into the versioned browser source asset.

blender -b --python art/office/optimize_tripo_chair.py -- \
  --input /path/to/download.glb --output art/office/tripo-chair.glb \
  --metadata art/office/tripo-chair.json

The raw input is never modified. Output and metadata are written only after a
successful import, decimation and self-contained GLB export.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import struct
import sys
import tempfile
import bpy

parser=argparse.ArgumentParser()
parser.add_argument('--input',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--metadata',required=True,type=Path)
parser.add_argument('--triangles',type=int,default=22000)
parser.add_argument('--texture-size',type=int,default=1024)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if not args.input.is_file():raise FileNotFoundError(args.input)
if args.input.resolve()==args.output.resolve():raise ValueError('Keep the raw input separate from the optimized output')
if args.triangles<1000 or args.texture_size<128:raise ValueError('Invalid geometry or texture limit')
source_sha=hashlib.sha256(args.input.read_bytes()).hexdigest()
metadata=json.loads(args.metadata.read_text(encoding='utf-8')) if args.metadata.exists() else {}
expected=metadata.get('originalSHA256')
if expected and expected!=source_sha:raise ValueError('Raw input SHA256 does not match the recorded Tripo download')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
if not meshes:raise RuntimeError('No mesh found in source GLB')
for obj in meshes:obj.data.calc_loop_triangles()
source_tris=sum(len(obj.data.loop_triangles) for obj in meshes)
print('SOURCE_TRIANGLES',source_tris,flush=True)
ratio=min(1,args.triangles/source_tris)
for obj in meshes:
    if ratio<1:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        dec=obj.modifiers.new('Browser source optimization','DECIMATE')
        dec.ratio=ratio
        dec.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=dec.name)
    obj.data.calc_loop_triangles()
    for poly in obj.data.polygons:poly.use_smooth=True
optimized_tris=sum(len(obj.data.loop_triangles) for obj in meshes)
print('OPTIMIZED_TRIANGLES',optimized_tris,flush=True)

# Identify image roles through actual shader connections, including Normal Map
# and Separate Color intermediary nodes, instead of guessing from filenames.
def images_upstream(socket,seen=None):
    seen=set() if seen is None else seen
    found=set()
    for link in socket.links:
        node=link.from_node
        if node in seen:continue
        seen.add(node)
        if node.type=='TEX_IMAGE' and node.image:found.add(node.image)
        for input_socket in node.inputs:found.update(images_upstream(input_socket,seen))
    return found

roles={}
for obj in meshes:
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                for socket_name,role in [('Base Color','basecolor'),('Normal','normal'),('Roughness','orm'),('Metallic','orm')]:
                    for img in images_upstream(node.inputs[socket_name]):roles.setdefault(img,set()).add(role)

image_report=[]
args.output.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='good-lawyer-chair-') as temporary:
    temporary=Path(temporary)
    for number,(img,image_roles) in enumerate(list(roles.items())):
        role='basecolor' if 'basecolor' in image_roles else 'normal' if 'normal' in image_roles else 'orm'
        limit=min(args.texture_size,512) if role=='orm' else args.texture_size
        width,height=img.size
        original=[width,height]
        if max(width,height)>limit:
            factor=limit/max(width,height)
            img.scale(max(1,round(width*factor)),max(1,round(height*factor)))
        img.name='Tripo chair '+role
        img.file_format='JPEG' if role=='basecolor' else 'PNG'
        img.filepath_raw=str(temporary/(str(number)+'-chair-'+role+('.jpg' if role=='basecolor' else '.png')))
        img.save()
        # Imported GLBs keep their original packed bytes, which the exporter can
        # reuse even after an image has been scaled in memory. A freshly loaded
        # reduced image makes the serialized texture dimensions unambiguous.
        replacement=bpy.data.images.load(img.filepath_raw,check_existing=False)
        replacement.name='Optimized Tripo chair '+role
        replacement.colorspace_settings.name=img.colorspace_settings.name
        replacement.pack()
        if max(replacement.size)>limit:raise RuntimeError('Texture resize did not persist to the encoded image')
        for mat in bpy.data.materials:
            if mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image==img:node.image=replacement
        image_report.append({'role':role,'originalSize':original,'size':[replacement.size[0],replacement.size[1]],'encoding':replacement.file_format})
        print('OPTIMIZED_TEXTURE',image_report[-1],flush=True)
    for obj in list(bpy.context.scene.objects):
        if obj.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(obj,do_unlink=True)
    temp_output=temporary/'optimized-chair.glb'
    bpy.ops.export_scene.gltf(filepath=str(temp_output),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_materials='EXPORT',export_normals=True,export_texcoords=True)
    result=temp_output.read_bytes()
    print('OPTIMIZED_GLB_BYTES',len(result),flush=True)
    magic,version,length=struct.unpack_from('<4sII',result,0)
    if magic!=b'glTF' or version!=2 or length!=len(result):raise RuntimeError('Invalid optimized GLB')
    if len(result)>8*1024*1024:raise RuntimeError('Optimized chair exceeds the browser asset size budget')
    args.output.write_bytes(result)

metadata['originalSHA256']=source_sha
metadata['optimizedSHA256']=hashlib.sha256(result).hexdigest()
metadata['optimizationStatus']='Complete; optimized GLB is the versioned source asset'
metadata['originalRetainedInTemporaryStorage']=True
metadata['sourceAsset']='art/office/tripo-chair.glb'
metadata['optimization']={
    'tool':'Blender '+bpy.app.version_string,
    'completedAt':datetime.now(timezone.utc).isoformat(),
    'algorithm':'Collapse decimation with triangulation; embedded PBR textures resized by material role',
    'inputBytes':args.input.stat().st_size,
    'inputTriangles':source_tris,
    'targetTriangles':args.triangles,
    'outputTriangles':optimized_tris,
    'outputBytes':len(result),
    'textures':image_report,
    'selfContained':True,
    'rebuildInput':'Only the optimized GLB is required by build_office.py; the original download is not part of the release'
}
args.metadata.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('CHAIR_OPTIMIZATION_COMPLETE',json.dumps(metadata['optimization']),flush=True)
