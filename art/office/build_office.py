"""Build the Good Lawyer office from native Blender geometry.

Run with Blender 4.5: blender -b --python art/office/build_office.py
The user's office sketch informs the composition. An optional optimized Tripo
chair is identified by its source metadata; all other geometry is native Blender.
ScreenAnchor is deliberately unparented, has unit scale and local XY axes.
"""
from pathlib import Path
import bpy
import math
import random
import json
import struct
import hashlib
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'source' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(2041)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for block in list(datablocks):
        if not block.users:
            datablocks.remove(block)

def material(name, color, rough=.5, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    return mat

ivory = material('Warm ivory plaster', (.72,.71,.62), .85)
trim = material('Ivory joinery', (.56,.59,.48), .6)
sage = material('Sage wall panels', (.26,.34,.26), .7)
sage_light = material('Panel inset', (.33,.40,.30), .72)
wood = material('Dark walnut', (.048,.021,.009), .33)
wood_light = material('Walnut heartwood', (.085,.039,.015), .38)
wood_medium = material('Walnut variation', (.065,.029,.011), .36)
brass = material('Aged brushed brass', (.55,.37,.14), .3, .76)
gold = material('Pen polished gold', (.76,.52,.20), .2, .82)
black = material('Black lacquer', (.018,.024,.021), .22)
screen = material('Laptop dark green glass', (.027,.064,.048), .31)
aluminium = material('Champagne anodised alloy', (.36,.35,.29), .28, .72)
keys = material('Keycaps graphite', (.055,.064,.056), .47)
leather = material('Deep olive leather', (.028,.064,.039), .54)
leather_light = material('Leather piping', (.19,.235,.13), .55)
paper = material('Cotton paper', (.87,.85,.73), .88)
paper_shadow = material('Paper edge', (.65,.64,.53), .9)
burgundy = material('Burgundy case leather', (.085,.008,.018), .52)
green_folder = material('Forest case leather', (.025,.095,.047), .51)
blue_book = material('Blue-grey bookcloth', (.11,.19,.19), .8)
terracotta = material('Ceramic pot', (.38,.23,.14), .55)
soil = material('Potting soil', (.042,.035,.023), 1)
leaf = material('Leaf dark', (.09,.22,.105), .72)
leaf_light = material('Leaf light', (.19,.34,.14), .66)
map_bg = material('Map parchment', (.72,.73,.60), .85)
map_street = material('Map street', (.47,.51,.38), .85)
map_park = material('Map park', (.27,.40,.27), .85)
map_river = material('Map river', (.22,.36,.37), .7)
mirror_glass = material('Mirror silver', (.39,.48,.42), .13, .92)
lamp_glass = material('Banker emerald glass', (.075,.26,.12), .24)
lamp_glow = material('Warm lamp interior', (1,.75,.37), .4)
shader = lamp_glow.node_tree.nodes.get('Principled BSDF')
shader.inputs['Emission Color'].default_value = (1,.68,.3,1)
shader.inputs['Emission Strength'].default_value = .8

def empty(name, loc=(0,0,0), rotation=(0,0,0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .15
    return obj

def finish(obj, name, mat=None, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def bevel(obj, amount=.03, segments=2):
    if not amount:
        return
    mod = obj.modifiers.new('Soft crafted edges', 'BEVEL')
    mod.width = amount
    mod.segments = 1 if amount < .018 else (4 if amount > .08 else segments)
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:
        face.use_smooth = False

def box(name, loc, size, mat, radius=.02, parent=None, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj=bpy.context.object
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj,name,mat,parent)
    bevel(obj,radius)
    return obj

def sphere(name, loc, scale, mat, parent=None, seg=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    obj=bpy.context.object
    obj.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj,name,mat,parent)
    for face in obj.data.polygons: face.use_smooth=True
    return obj

def cylinder(name, loc, radius, depth, mat, parent=None, vertices=20, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj=bpy.context.object
    finish(obj,name,mat,parent)
    bevel(obj,min(radius*.22,.018),2)
    return obj

def beam(name, a, b, radius, mat, parent=None, vertices=12):
    av,bv=Vector(a),Vector(b)
    obj=cylinder(name,(av+bv)/2,radius,(bv-av).length,mat,parent,vertices)
    obj.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler()
    return obj

def plane(name, loc, size, mat, parent=None, rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    obj=bpy.context.object
    obj.scale=(size[0],size[1],1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj,name,mat,parent)

def line(name, points, radius, mat, parent=None):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'
    curve.resolution_u=1
    curve.bevel_depth=radius
    curve.bevel_resolution=1
    spline=curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point,co in zip(spline.points,points): point.co=(*co,1)
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    if parent:obj.parent=parent
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj

def text(name, body, loc, size, mat, parent=None, rot=(math.pi/2,0,0), align='CENTER'):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=body
    curve.size=size
    curve.align_x=align
    curve.align_y='CENTER'
    curve.extrude=.0005
    curve.resolution_u=2
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=rot
    if parent:obj.parent=parent
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj

# Open-front room with a chamfered right wall, preserving the sketch's sightlines.
box('Oak floor foundation',(0,.3,-.12),(12,9,.2),wood,.02)
for i in range(18):
    box('Wide oak floorboard %02d'%i,(-5.7+i*.65,.3,.004),(.63,8.9,.026),[wood_medium,wood_light,wood][i%3],.006)
box('Back plaster wall',(-1.15,4.65,3.1),(9.7,.17,6.2),ivory,.01)
box('Left plaster wall',(-6,.5,3.1),(.17,8.5,6.2),ivory,.01)
corner=empty('Chamfered right wall',(4.8,3.72,0),(0,0,math.radians(-38)))
box('Right wall plaster',(0,0,3.1),(3.65,.17,6.2),ivory,.01,corner)
for i in range(8):
    x=-5.42+i*1.2
    box('Back sage panel %02d'%i,(x,4.53,1.26),(1.15,.055,2.44),sage,.012)
    box('Back inset %02d'%i,(x,4.484,1.27),(.91,.04,1.95),sage_light,.012)
    for sx in [-.47,.47]:box('Panel vertical trim',(x+sx,4.45,1.27),(.025,.022,2.02),trim,.004)
    for sz in [.24,2.3]:box('Panel horizontal trim',(x,4.45,sz),(.96,.022,.025),trim,.004)
box('Continuous walnut chair rail',(-1.1,4.42,2.55),(9.7,.11,.09),wood,.018)
box('Walnut skirting',(-1.1,4.42,.13),(9.7,.12,.23),wood,.015)
for i in range(3):
    x=-1.2+i*1.2
    box('Corner sage panel',(x,-.115,1.26),(1.15,.05,2.44),sage,.015,corner)
    box('Corner panel inset',(x,-.15,1.26),(.94,.025,1.97),sage_light,.01,corner)
box('Corner chair rail',(0,-.17,2.55),(3.6,.12,.09),wood,.015,corner)
box('Corner skirting',(0,-.17,.13),(3.6,.12,.23),wood,.015,corner)

# A left-side window provides a credible origin for the broad, soft light.
window=empty('Window',(-5.86,-.7,3.6),(0,0,math.pi/2))
box('Window dark reveal',(0,0,0),(2.75,.1,3.4),wood,.04,window)
box('Window bright pane',(0,-.06,0),(2.55,.025,3.2),paper,.02,window)
for x in [-1.31,0,1.31]:box('Window vertical mullion',(x,-.1,0),(.055,.06,3.28),trim,.008,window)
for z in [-1.64,0,1.64]:box('Window horizontal mullion',(0,-.1,z),(2.68,.06,.055),trim,.008,window)
box('Window sill',(0,-.2,-1.71),(2.98,.46,.11),paper,.025,window)

# Archive: individual books, actual shelves, closed lower doors and brass handles.
shelf=empty('Bookshelf',(-4.98,3.9,0))
box('Archive back',(0,.24,2.35),(1.86,.13,4.5),wood,.035,shelf)
for x in [-.94,.94]:box('Archive upright',(x,0,2.35),(.12,.64,4.62),wood_light,.025,shelf)
for z in [.15,1.1,2.12,3.15,4.58]:box('Archive shelf',(0,-.03,z),(2.0,.72,.12),wood_light,.025,shelf)
for x in [-.45,.45]:
    box('Archive lower door',(x,-.34,.62),(.84,.06,.8),wood_medium,.02,shelf)
    box('Archive door inset',(x,-.379,.62),(.66,.018,.61),wood,.015,shelf)
    cylinder('Archive door knob',(x*.3,-.42,.67),.035,.06,brass,shelf,12,(math.pi/2,0,0))
book_mats=[burgundy,green_folder,blue_book,wood,leather]
for row,z in enumerate([1.22,2.24,3.27]):
    x=-.83
    for i in range(10):
        w=random.uniform(.115,.17);h=random.uniform(.56,.78)
        mat=book_mats[(i+row*2)%len(book_mats)]
        box('Archive book %d %d'%(row,i),(x+w/2,-.08,z+h/2),(w,.43,h),mat,.009,shelf)
        for zz in [z+.09,z+h-.1]:box('Book gold spine rule',(x+w/2,-.302,zz),(w*.76,.012,.013),brass,.001,shelf)
        box('Book title panel',(x+w/2,-.307,z+h*.56),(w*.67,.015,.12),paper_shadow,.003,shelf)
        x+=w+.019
box('Archive nameplate',(0,-.413,4.57),(.9,.014,.14),brass,.01,shelf)
text('Archive lettering','A R C H I V E',(0,-.426,4.568),.055,wood,shelf)

# Side mirror has a substantial frame, bevelled glass, corners and a wall hanger.
mirror=empty('Mirror',(-5.84,2.2,3.3),(0,0,math.pi/2))
box('Mirror walnut frame',(0,0,0),(1.4,.12,2.48),wood,.07,mirror)
box('Mirror brass inner frame',(0,-.075,0),(1.25,.055,2.32),brass,.045,mirror)
box('Mirror bevelled glass',(0,-.111,0),(1.16,.025,2.23),mirror_glass,.06,mirror)

# Walnut desk: raised top, rounded front edge, slab legs, panels and drawers.
desk=empty('WritingDesk')
box('Desk slab',(0,-.47,1.31),(10.05,3.78,.19),wood,.065,desk)
for i in range(6):
    box('Desk walnut grain plank',(0,-2.0+i*.61,1.413),(9.92,.6,.018),[wood_medium,wood,wood_light,wood_medium][i%4],.006,desk)
box('Desk front brass reveal',(0,-2.37,1.28),(9.82,.018,.025),brass,.005,desk)
for x in [-4.08,4.08]:
    box('Desk pedestal',(x,-.3,.66),(1.18,2.65,1.12),wood,.05,desk)
    for z in [.34,.7,1.05]:
        box('Drawer front',(x,-1.65,z),(1.08,.07,.3),wood_light,.025,desk)
        box('Drawer brass handle',(x,-1.71,z),( .38,.04,.035),brass,.015,desk)
    for yy in [-1.45,.83]:box('Pedestal foot',(x,yy,.1),(1.03,.18,.2),wood,.02,desk)
box('Desk modesty panel',(0,.96,.68),(7.2,.11,1.05),wood_medium,.025,desk)
box('Leather desk pad',(1.92,-.9,1.443),(3.18,2.31,.035),leather,.08,desk)
for x in [.37,3.47]:line('Deskpad stitched side',[(x,-2.01,1.465),(x,.2,1.465)],.006,leather_light,desk)
for y in [-2.01,.2]:line('Deskpad stitched end',[(.37,y,1.465),(3.47,y,1.465)],.006,leather_light,desk)

# Oversized laptop is intentionally the principal interaction surface.
SW=4.45
SH=SW*560/900
SX=-1.40
SY=-.32
SZ=1.57+SH/2
laptop=empty('Laptop')
box('Laptop lower aluminium body',(SX,-1.14,1.498),(4.83,1.8,.13),aluminium,.065,laptop)
box('Laptop lower black edge',(SX,-1.14,1.425),(4.72,1.7,.025),black,.04,laptop)
box('Laptop keyboard inset',(SX,-.98,1.576),(4.37,.94,.022),black,.035,laptop)
for row in range(4):
    for col in range(15):
        box('Laptop individual key %d %d'%(row,col),(SX-1.98+col*.283,-.64-row*.207,1.599),(.245,.164,.028),keys,.015,laptop)
box('Laptop space key',(SX,-1.44,1.602),(1.65,.145,.028),keys,.014,laptop)
box('Laptop trackpad',(SX,-1.79,1.577),(1.1,.38,.009),aluminium,.025,laptop)
box('Laptop trackpad outline',(SX,-1.79,1.57),(1.13,.41,.009),black,.025,laptop)
box('Laptop screen alloy surround',(SX,SY+.07,SZ),(SW+.31,.16,SH+.3),aluminium,.075,laptop)
box('Laptop screen black bezel',(SX,SY-.026,SZ),(SW+.21,.055,SH+.2),black,.055,laptop)
plane('Laptop screen glass',(SX,SY-.058,SZ),(SW,SH),screen,laptop)
cylinder('Laptop camera lens',(SX,SY-.063,SZ+SH/2+.057),.022,.008,black,laptop,16,(math.pi/2,0,0))
for x in [SX-1.65,SX+1.65]:cylinder('Laptop hinge',(x,SY+.04,1.53),.082,.51,black,laptop,20,(0,math.pi/2,0))
screen_anchor=empty('ScreenAnchor',(SX,SY-.067,SZ),(math.pi/2,0,0))

# Two separate working folders: paper stacks, bound covers, labels and clasps.
def folder(name, loc, angle, mat, label):
    root=empty(name,loc,(0,0,angle))
    box(name+' bottom cover',(0,0,.018),(1.27,.91,.036),mat,.024,root)
    box(name+' paper block',(0,.012,.075),(1.18,.82,.09),paper,.012,root)
    for z in [.053,.073,.094]:box(name+' separate sheet edge',(.017,-.412,z),(1.15,.009,.004),paper_shadow,.001,root)
    box(name+' top cover',(0,0,.137),(1.27,.91,.034),mat,.022,root)
    box(name+' folded spine',(-.602,0,.079),(.08,.92,.15),mat,.024,root)
    box(name+' ivory label',(-.09,.05,.16),(.67,.31,.012),paper,.012,root)
    text(name+' label',label,(-.09,.045,.168),.075,wood,root,rot=(0,0,0))
    box(name+' brass clasp',(.52,0,.166),(.15,.15,.019),brass,.015,root)
    cylinder(name+' clasp rivet',(.52,0,.184),.025,.015,gold,root,16)
    return root
folder('FolderCurrent',(1.75,-1.12,1.47),math.radians(-8),green_folder,'01 / DOSSIER')
folder('FolderArchive',(2.5,-.26,1.47),math.radians(12),burgundy,'ARCHIVE / 02')

# Prominent black lacquer fountain pen with a gold nib and a separate cap.
pen=empty('FountainPen',(1.95,-1.96,1.51),(0,0,math.radians(-5)))
cylinder('Pen lacquer barrel',(0,0,.01),.043,.83,black,pen,20,(0,math.pi/2,0))
for x in [-.34,.31,.35]:cylinder('Pen gold barrel ring',(x,0,.01),.046,.025,gold,pen,20,(0,math.pi/2,0))
cylinder('Pen grip',(.5,0,.01),.034,.24,black,pen,16,(0,math.pi/2,0))
verts=[(.62,-.036,0),(.62,.036,0),(.89,0,.008),(.69,0,.035),(.62,-.036,.012),(.62,.036,.012)]
faces=[(0,1,2),(0,2,3),(1,3,2),(0,4,5,1),(4,3,5),(4,0,3),(5,3,1)]
mesh=bpy.data.meshes.new('Gold nib mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(gold)
obj=bpy.data.objects.new('Gold fountain nib',mesh);bpy.context.collection.objects.link(obj);obj.parent=pen
line('Nib slit',[(.69,0,.036),(.865,0,.013)],.002,black,pen)
sphere('Nib breather hole',(.695,0,.036),(.009,.009,.003),black,pen,12,6)
cylinder('Pen separate cap',(-.12,-.18,.018),.052,.53,black,pen,20,(0,math.pi/2,0))
cylinder('Pen cap gold band',(.127,-.18,.018),.055,.047,gold,pen,20,(0,math.pi/2,0))
box('Pen cap gold clip',(-.16,-.18,.071),(.34,.017,.012),gold,.008,pen)

# Banker's lamp and cards sit behind the screen, without obstructing the UI.
lamp=empty('BankersLamp',(-4.32,.33,1.45))
cylinder('Lamp heavy brass foot',(0,0,.035),.33,.07,brass,lamp,32)
cylinder('Lamp upright',(0,.05,.53),.036,.94,brass,lamp,16)
beam('Lamp curved shoulder',(-.18,.05,.98),(.18,.05,.98),.033,brass,lamp)
shade=sphere('Lamp emerald shade',(0,-.05,1.05),(.55,.24,.19),lamp_glass,lamp,24,12)
box('Lamp luminous underside',(0,-.05,.978),(.86,.31,.025),lamp_glow,.07,lamp)
for x in [-.48,.48]:cylinder('Lamp brass shade pin',(x,-.05,1.04),.042,.048,brass,lamp,16,(0,math.pi/2,0))
line('Lamp pull chain',[(.3,-.18,1),(.32,-.18,.76)],.007,brass,lamp)
sphere('Lamp pull bead',(.32,-.18,.73),(.021,.021,.035),brass,lamp)

# The phone is a dimensional, tilted object, facing up towards the player.
phone=empty('Phone',(3.75,-1.69,1.46),(math.radians(-23),math.radians(-6),math.radians(-12)))
box('Phone metal chassis',(0,0,.86),(.87,.115,1.72),aluminium,.085,phone)
box('Phone black front',(0,-.065,.86),(.83,.026,1.67),black,.075,phone)
box('Phone sage screen',(0,-.083,.86),(.72,.012,1.49),sage_light,.052,phone)
box('Phone speaker',(0,-.094,1.525),(.16,.009,.025),black,.01,phone)
text('Phone line title','LINE',(0,-.101,1.34),.073,paper,phone)
text('Phone connection status','ONLINE',(0,-.101,1.08),.12,paper,phone)
box('Phone bank card',(0,-.101,.78),(.57,.012,.26),green_folder,.025,phone)
for i in range(3):
    box('Phone transaction line',(-.04,-.104,.49-i*.12),(.42,.009,.016),paper_shadow,.003,phone)
    cylinder('Phone transaction dot',(-.275,-.107,.49-i*.12),.021,.009,brass,phone,12,(math.pi/2,0,0))
box('Phone home pill',(0,-.1,.17),(.22,.01,.014),paper,.006,phone)
for z in [1.14,1.32]:box('Phone volume key',(-.446,0,z),(.013,.04,.11),brass,.004,phone)

# Luxurious empty leather chair, with a framed portrait as the profile anchor.
chair=empty('LawyerChair',(1.93,1.68,0),(0,0,math.radians(-5)))
cylinder('Chair central stem',(0,0,.52),.07,.66,brass,chair,20)
for i in range(5):
    a=i*math.tau/5
    beam('Chair star leg',(0,0,.27),(.69*math.cos(a),.69*math.sin(a),.12),.036,wood,chair)
    sphere('Chair caster',(.7*math.cos(a),.7*math.sin(a),.087),(.075,.075,.075),black,chair,12,6)
box('Chair seat',(0,0,1.03),(1.65,1.42,.28),leather,.16,chair)
box('Chair seat piping',(0,-.011,1.12),(1.68,1.43,.075),leather_light,.15,chair)
box('Chair back shell',(0,.57,2.05),(1.72,.26,2.01),wood,.17,chair,rot=(math.radians(7),0,0))
box('Chair back leather',(0,.39,2.05),(1.58,.29,1.85),leather,.17,chair,rot=(math.radians(7),0,0))
for x in [-.42,0,.42]:
    for z in [1.65,2.2,2.65]:sphere('Chair leather button',(x,.205-(z-2)*.12,z),(.038,.015,.038),leather_light,chair,12,6)
for x in [-.94,.94]:
    for y in [-.42,.36]:beam('Chair arm support',(x,y,1.05),(x,y,1.55),.045,brass,chair)
    box('Chair leather armrest',(x,-.02,1.59),(.2,1.39,.16),leather,.08,chair)

# An optional genuine Tripo source replaces only the native chair. Keep the
# portrait/profile independent, and preserve a native fallback for clean builds
# before a generated asset is available. Import provenance is recorded only when
# the file has actually been loaded, optimized and placed successfully.
tripo_path=ROOT/'art/office/tripo-chair.glb'
tripo_info={'used':False,'fallback':'Native Blender leather chair'}
if tripo_path.exists():
    before=set(bpy.data.objects)
    try:
        tripo_metadata_path=ROOT/'art/office/tripo-chair.json'
        tripo_metadata=json.loads(tripo_metadata_path.read_text(encoding='utf-8')) if tripo_metadata_path.exists() else {}
        expected_source_sha=tripo_metadata.get('optimizedSHA256')
        actual_source_sha=hashlib.sha256(tripo_path.read_bytes()).hexdigest()
        if expected_source_sha and actual_source_sha!=expected_source_sha:raise RuntimeError('Optimized Tripo source SHA256 does not match its provenance record')
        bpy.ops.import_scene.gltf(filepath=str(tripo_path))
        imported=set(bpy.data.objects)-before
        imported_meshes=[obj for obj in imported if obj.type=='MESH' and len(obj.data.vertices)]
        if not imported_meshes:raise RuntimeError('The Tripo file contains no chair mesh')
        for obj in list(imported):
            if obj.type in {'CAMERA','LIGHT'}:
                bpy.data.objects.remove(obj,do_unlink=True)
                imported.remove(obj)
        for obj in imported_meshes:obj.data.calc_loop_triangles()
        source_tris=sum(len(obj.data.loop_triangles) for obj in imported_meshes)
        target_tris=22000
        if source_tris>target_tris:
            ratio=target_tris/source_tris
            for obj in imported_meshes:
                bpy.ops.object.select_all(action='DESELECT')
                obj.select_set(True)
                bpy.context.view_layer.objects.active=obj
                dec=obj.modifiers.new('Browser chair optimization','DECIMATE')
                dec.ratio=ratio
                dec.use_collapse_triangulate=True
                bpy.ops.object.modifier_apply(modifier=dec.name)
                obj.data.calc_loop_triangles()
        # Reduce only images referenced by the imported chair's materials.
        chair_images=set()
        for obj in imported_meshes:
            for mat in obj.data.materials:
                if mat and mat.use_nodes:
                    # The generated leather arrived with metallic highlights and
                    # an overly strong normal map. Keep its authored colour and
                    # tufting while matching the office's restrained finish.
                    for shader_node in mat.node_tree.nodes:
                        if shader_node.type=='BSDF_PRINCIPLED':
                            for socket_name,value in [('Metallic',.04),('Roughness',.68)]:
                                socket=shader_node.inputs[socket_name]
                                for link in list(socket.links):mat.node_tree.links.remove(link)
                                socket.default_value=value
                        elif shader_node.type=='NORMAL_MAP':shader_node.inputs['Strength'].default_value=.28
                    for node in mat.node_tree.nodes:
                        if node.type=='TEX_IMAGE' and node.image:chair_images.add(node.image)
        image_report=[]
        for img in chair_images:
            width,height=img.size
            limit=512 if any(s in img.name.lower() for s in ['rough','metal','orm']) and 'normal' not in img.name.lower() else 1024
            if max(width,height)>limit:
                factor=limit/max(width,height)
                img.scale(max(1,round(width*factor)),max(1,round(height*factor)))
            img.pack()
            image_report.append({'name':img.name,'width':img.size[0],'height':img.size[1]})
        bpy.context.view_layer.update()
        bounds=[obj.matrix_world@Vector(corner) for obj in imported_meshes for corner in obj.bound_box]
        minimum=Vector(tuple(min(v[i] for v in bounds) for i in range(3)))
        maximum=Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
        extent=maximum-minimum
        if min(extent)<.00001:raise RuntimeError('The Tripo chair has invalid bounds')
        size=Vector((2.08/extent.x,1.9/extent.y,3.02/extent.z))
        center=(minimum+maximum)/2
        # glTF import converts Y-up to Blender Z-up. Tripo's front is -Y here.
        # A separate placement root lets orientation be adjusted without changing
        # normalization or the common bounding box of individual chair meshes.
        replacement=empty('TripoChair')
        normalized=empty('TripoChairBasis')
        normalized.parent=replacement
        for obj in imported:
            if obj.parent not in imported:
                world=obj.matrix_world.copy()
                obj.parent=normalized
                obj.matrix_world=world
        normalized.scale=size
        normalized.location=(-center.x*size.x,-center.y*size.y,-minimum.z*size.z)
        replacement.location=(1.93,1.68,.025)
        replacement.rotation_euler=(0,0,math.radians(-5))
        bpy.context.view_layer.update()
        optimized_tris=sum(len(obj.data.loop_triangles) for obj in imported_meshes)
        tripo_info={
            'used':True,
            'source':'Tripo Studio generation through the native UI',
            'model':tripo_metadata.get('model','H3.1 Best Quality'),
            'generationId':tripo_metadata.get('generationId'),
            'referenceSource':'art/office/tripo-chair.glb',
            'sourceSha256':actual_source_sha,
            'originalDownloadSha256':tripo_metadata.get('originalSHA256'),
            'sourceAssetIsOptimized':bool(expected_source_sha),
            'sourceBytes':tripo_path.stat().st_size,
            'sourceTriangles':source_tris,
            'optimizedTriangles':optimized_tris,
            'textures':image_report,
            'materialAdjustment':'Preserved colour texture and tufting; dielectric leather/wood at metallic 0.04, roughness 0.68, normal scale 0.28',
            'placement':'High-backed chair, normalized into the original chair bounds, front toward the camera',
            'targetBounds':[2.08,1.9,3.02]
        }
        for obj in list(chair.children_recursive)+[chair]:bpy.data.objects.remove(obj,do_unlink=True)
        print('TRIPO_CHAIR_IMPORTED',json.dumps(tripo_info))
    except Exception as exc:
        # Failed imports do not silently produce a missing chair or false credit.
        for obj in list(set(bpy.data.objects)-before):bpy.data.objects.remove(obj,do_unlink=True)
        tripo_info['importError']=str(exc)
        print('TRIPO_CHAIR_FALLBACK',str(exc))

profile=empty('Lawyer',(1.99,4.26,3.47))
box('Lawyer portrait walnut frame',(0,0,0),(1.38,.12,1.79),wood,.035,profile)
box('Lawyer portrait brass inner frame',(0,-.078,0),(1.23,.025,1.64),brass,.016,profile)
box('Lawyer portrait cream mat',(0,-.097,0),(1.17,.018,1.58),paper,.005,profile)
photo_path=ROOT/'site/assets/lawyer-portrait.jpg'
photo_mat=material('Existing lawyer portrait',(.5,.5,.5),.85)
if photo_path.exists():
    image=bpy.data.images.load(str(photo_path))
    image.pack()
    nt=photo_mat.node_tree
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image
    nt.links.new(tex.outputs['Color'],nt.nodes.get('Principled BSDF').inputs['Base Color'])
plane('Lawyer portrait photograph',(0,-.112,.035),(.94,1.28),photo_mat,profile)
box('Profile name plaque',(0,-.115,-.71),(.91,.018,.14),brass,.01,profile)
text('Profile plaque letters','PRIVATE PRACTICE',(0,-.129,-.71),.052,wood,profile)

# Framed city map on the right wall: relief blocks, river, roads and district pins.
citymap=empty('CityMap',(4.45,3.8,3.68),(0,0,math.radians(-38)))
box('City map walnut frame',(0,0,0),(2.62,.11,1.9),wood,.035,citymap)
box('City map brass reveal',(0,-.067,0),(2.48,.026,1.77),brass,.018,citymap)
box('City map parchment',(0,-.088,0),(2.38,.018,1.67),map_bg,.012,citymap)
for row in range(5):
    for col in range(7):
        xx=-1.02+col*.33;zz=-.59+row*.25
        if abs(xx-(.18*math.sin(zz*4)))<.23:continue
        box('Map city block',(xx,-.105,zz),(.22,.016,.15),map_park if (row+col)%4==0 else sage_light,.015,citymap)
riverpts=[(-.28,-.125,-.78),(-.13,-.125,-.6),(.09,-.125,-.37),(.02,-.125,-.14),(.14,-.125,.11),(.08,-.125,.34),(.28,-.125,.6),(.24,-.125,.77)]
line('Map river',riverpts,.068,map_river,citymap)
for z in [-.45,.05,.55]:line('Map east west road',[(-1.12,-.13,z),(1.12,-.13,z+.04)],.013,paper,citymap)
for x in [-.83,-.5,.51,.84]:line('Map north south road',[(x,-.132,-.72),(x+.06,-.132,.71)],.011,paper,citymap)
for x,z in [(-.74,-.31),(-.52,.4),(.5,-.39),(.83,.4),(.47,.18)]:
    cylinder('Map district pin',(x,-.155,z),.038,.03,brass,citymap,16,(math.pi/2,0,0))
    sphere('Map pin cap',(x,-.18,z),(.026,.014,.026),burgundy,citymap,12,6)
text('Map city title','NOVORECHENSK',(0,-.14,.748),.075,wood,citymap)

# Plant and personal desk objects add scale and lived-in character.
plant=empty('OfficePlant',(3.68,.63,1.43))
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.25,radius2=.34,depth=.48,location=(0,0,.24))
finish(bpy.context.object,'Plant glazed ceramic pot',terracotta,plant);bevel(bpy.context.object,.025)
cylinder('Plant soil',(0,0,.472),.3,.026,soil,plant,24)
for i in range(11):
    angle=i*2.399
    h=random.uniform(.57,1.08);dist=random.uniform(.25,.54)
    end=(math.cos(angle)*dist,math.sin(angle)*dist,.47+h)
    beam('Plant stem',(0,0,.46),end,.012,leaf,plant,8)
    ob=sphere('Plant broad leaf',end,(.125,.045,.34),leaf if i%2 else leaf_light,plant,12,6)
    ob.rotation_euler=(math.radians(25)*math.cos(angle),math.radians(36)*math.sin(angle),-angle)
cards=empty('BusinessCards',(2.8,.92,1.45),(0,0,math.radians(-8)))
box('Business card holder',(0,0,.08),(.8,.47,.16),brass,.035,cards)
box('Business card stack',(0,-.02,.16),(.71,.39,.04),paper,.009,cards)
text('Business card monogram','A / A',(0,-.02,.185),.095,wood,cards,rot=(0,0,0))
for i in range(2):
    box('Desk reference volume',(-3.93,.92,1.5+i*.15),(.93,.7,.14),[burgundy,blue_book][i],.018)
    box('Desk reference pages',(-3.93,.56,1.5+i*.15),(.82,.018,.1),paper_shadow,.004)

# Camera: modest perspective, screen nearly half the frame width at 1440 x 850.
CAM_POS=(1.18,-11.85,6.03)
CAM_TARGET=(-.08,.45,2.48)
bpy.ops.object.camera_add(location=CAM_POS)
camera=bpy.context.object;camera.name='Camera'
camera.rotation_euler=(Vector(CAM_TARGET)-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='PERSP';camera.data.lens=44.5;camera.data.sensor_width=36
camera.data.clip_start=.05;camera.data.clip_end=100
bpy.context.scene.camera=camera

def area(name,loc,target,power,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.color=color;obj.data.shape='DISK';obj.data.size=size
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Window softbox',(-4.9,-2.5,6.2),(-.5,1,1.8),1150,(1,.88,.68),5)
area('Ceiling bounce',(1,-.2,6.8),(0,1,0),650,(1,.96,.84),5)
area('Camera soft fill',(1,-8,4.7),(0,2,2),300,(.76,.86,1),6)
area('Warm rear rim',(3,3.5,5.9),(1,0,1.5),350,(1,.78,.48),3)
# Exportable, deliberately low-intensity lights support viewers without a custom rig.
bpy.ops.object.light_add(type='SUN',location=(-5,-4,7))
sun=bpy.context.object;sun.name='Office daylight';sun.data.energy=.55;sun.data.angle=math.radians(18)
sun.rotation_euler=(math.radians(28),math.radians(-25),math.radians(-25))
scene=bpy.context.scene
scene.world.color=(.32,.36,.28)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.56,.46,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.cycles.device='CPU'
scene.render.resolution_x=1440;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.1
scene.render.filepath=str(OUT/'office-preview.png')

# Merge by interactive ancestor and material: preserve named hit targets while
# reducing hundreds of tiny book, key and joinery objects to a compact draw list.
interactive=['Laptop','ScreenAnchor','Phone','FolderCurrent','FolderArchive','FountainPen','Bookshelf','Mirror','CityMap','Lawyer']
protected_roots=interactive+['TripoChair']
bpy.context.view_layer.update()
batches={}
for obj in list(scene.objects):
    if obj.type!='MESH':continue
    ancestor=obj.parent
    while ancestor and ancestor.name not in protected_roots:ancestor=ancestor.parent
    mat=obj.data.materials[0] if obj.data.materials else None
    batches.setdefault((ancestor.name if ancestor else 'Room',mat.name if mat else 'None'),[]).append(obj)
for (root_name,mat_name),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    obj=objects[0]
    bpy.context.view_layer.objects.active=obj
    if len(objects)>1:bpy.ops.object.join()
    obj=bpy.context.object
    world=obj.matrix_world.copy()
    obj.parent=bpy.data.objects.get(root_name) if root_name!='Room' else None
    obj.matrix_world=world
    obj.name=root_name+' / '+mat_name

# Resolve primitives, count actual triangles and serialize authored provenance.
bpy.ops.object.select_all(action='DESELECT')
for obj in list(scene.objects):
    if obj.type=='MESH':
        obj.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH')
to_gltf=lambda xyz:[xyz[0],xyz[2],-xyz[1]]
manifest={
    'generator':'Blender 4.5.14',
    'source':'Native procedural Blender office geometry; user office sketch reference; existing project portrait texture.'+(' Chair generated in Tripo Studio and optimized in Blender.' if tripo_info['used'] else ''),
    'tripoUsed':tripo_info['used'],
    'tripo':tripo_info,
    'coordinateSystem':'glTF Y-up; positions converted from Blender Z-up (x, y, z) to (x, z, -y)',
    'screen':{'width':SW,'height':SH,'anchor':'ScreenAnchor','localPlane':'XY','domWidth':900,'domHeight':560,'scale':[1,1,1],'unparented':True,'blenderRotation':[math.pi/2,0,0],'glTFBasisCorrection':'The empty uses the CSS local XY basis, facing +Z in glTF. Its Blender XY basis faces -Y. The export step removes Blender exporter empty-basis compensation.'},
    'camera':{'name':'Camera','position':to_gltf(CAM_POS),'target':to_gltf(CAM_TARGET),'fov':math.degrees(2*math.atan(math.tan(camera.data.angle_x/2)/(1440/850))),'fovAxis':'vertical','aspect':1440/850,'blenderPosition':list(CAM_POS),'blenderTarget':list(CAM_TARGET)},
    'objects':interactive,
    'triangles':triangles,
    'meshObjects':sum(1 for o in scene.objects if o.type=='MESH'),
    'materials':len(bpy.data.materials),
    'labelAnchors':{
        'Laptop':to_gltf((SX,SY,4.48)), 'Phone':to_gltf((3.78,-1.5,3.28)),
        'FolderCurrent':to_gltf((1.75,-1.1,1.9)), 'FolderArchive':to_gltf((2.5,-.26,1.9)),
        'FountainPen':to_gltf((1.95,-1.96,1.75)), 'Bookshelf':to_gltf((-4.98,3.5,4.9)),
        'Mirror':to_gltf((-5.7,2.2,4.7)), 'CityMap':to_gltf((4.4,3.5,4.9)), 'Lawyer':to_gltf((1.99,3.9,4.56))
    }
}
(OUT/'office-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'office.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'office.glb'),export_format='GLB',export_cameras=True,export_lights=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_texcoords=True,export_normals=True,export_animations=False,export_extras=True)
# Blender converts mesh local coordinates to Y-up; an empty has no geometry to
# convert. CSS3D's own local XY plane therefore needs the corresponding basis
# correction. Keep the authored Blender empty at X=90 degrees, while the exported
# glTF empty directly describes the visible plane for CSS3DRenderer consumers.
glb_path=OUT/'office.glb'
glb=glb_path.read_bytes()
json_length,json_type=struct.unpack_from('<II',glb,12)
gltf=json.loads(glb[20:20+json_length])
for node in gltf['nodes']:
    if node.get('name')=='ScreenAnchor':
        node.pop('rotation',None)
        node['extras']={'localPlane':'XY','css3DReady':True,'width':SW,'height':SH}
gltf_json=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
gltf_json+=b' '*((-len(gltf_json))%4)
body=struct.pack('<II',len(gltf_json),json_type)+gltf_json+glb[20+json_length:]
glb_path.write_bytes(struct.pack('<4sII',b'glTF',2,12+len(body))+body)
try:
    bpy.ops.render.render(write_still=True)
except RuntimeError:
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    bpy.ops.render.render(write_still=True)
manifest['glbBytes']=(OUT/'office.glb').stat().st_size
(OUT/'office-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('OFFICE_COMPLETE',json.dumps({'triangles':triangles,'glbBytes':manifest['glbBytes'],'screen':manifest['screen']}))
