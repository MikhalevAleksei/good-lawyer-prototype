"""Build the Good Lawyer office from versioned Blender and Tripo assets.

Run with Blender 4.5: blender -b --python art/office/build_office.py
The user's office sketch informs the composition. Optimized Tripo source GLBs
are checked against their provenance records and normalized into authored slots.
The room, folders, fountain pen and live-screen surfaces are native Blender.
ScreenAnchor is deliberately unparented, has unit scale and local XY axes.
"""
from pathlib import Path
import bpy
import math
import random
import json
import struct
import hashlib
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'source' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(2041)
# The back wall with its joinery, the chamfered corner wall and everything that
# hangs on or stands against them sit BACK_SHIFT metres deeper (+Y) than in the
# original sketch layout. The desk, chair, devices, camera and live-screen
# anchors are deliberately not shifted, so the screen contracts stay unchanged.
BACK_SHIFT=1.2
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

def glow(mat, color, strength):
    """Add a constant emission that the glTF exporter writes as emissiveFactor."""
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = strength
    return mat

# Day palette: warm light plaster, deep green panelling, brass mouldings and a
# medium-dark walnut floor and joinery.
plaster = material('Warm day plaster', (.50,.48,.42), .86)
trim = material('Brass panel moulding', (.45,.31,.12), .34, .78)
sage = material('Deep green wall panels', (.09,.15,.11), .56)
sage_light = material('Green panel inset', (.11,.18,.13), .6)
wood = material('Walnut', (.075,.038,.018), .34)
wood_light = material('Walnut heartwood', (.10,.051,.024), .38)
wood_medium = material('Walnut variation', (.086,.044,.021), .36)
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
# Dark navigation map, a design object even by day: teal ground, darker block
# silhouettes, a turquoise river, thin light streets and five brass district
# outlines. The faint emission keeps the printed lines crisp.
map_bg = material('Navigation map ground', (.03,.05,.05), .82)
map_edge = material('Navigation map board edge', (.016,.026,.026), .8)
map_block = material('Navigation map blocks', (.052,.08,.078), .78)
map_street = glow(material('Navigation map streets', (.52,.57,.52), .7), (.62,.68,.6), .2)
map_river = glow(material('Navigation map river', (.02,.25,.29), .32), (.03,.42,.46), .3)
map_brass = glow(material('Navigation map brass districts', (.5,.34,.13), .32, .7), (.55,.36,.12), .16)
phone_screen = glow(material('Phone idle screen', (.03,.07,.052), .3), (.03,.09,.062), .2)
phone_text = glow(material('Phone screen lettering', (.75,.74,.62), .5), (.78,.76,.6), .4)
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
# The floor and left wall grow by BACK_SHIFT so the deeper back wall meets them.
box('Oak floor foundation',(0,.3+BACK_SHIFT/2,-.12),(12,9+BACK_SHIFT,.2),wood,.02)
for i in range(18):
    box('Wide oak floorboard %02d'%i,(-5.7+i*.65,.3+BACK_SHIFT/2,.004),(.63,8.9+BACK_SHIFT,.026),[wood_medium,wood_light,wood][i%3],.006)
BACK_Y=4.65+BACK_SHIFT
# The window opens in the back wall between the archive and the portrait,
# over the laptop. From the game camera the laptop lid hides the wall below
# z~3.76 and the frame's top edge meets the wall at z~5.2, so the window is wide
# rather than tall: its sill sits on the chair rail, its head casing stays just
# inside the frame, and its sides keep clear of the archive and the portrait.
WIN_W,WIN_H=4.2,2.35
WIN_CX,WIN_Z0=-1.6,2.6
WIN_X0,WIN_X1,WIN_Z1=WIN_CX-WIN_W/2,WIN_CX+WIN_W/2,WIN_Z0+WIN_H
WALL_X0,WALL_X1,WALL_H,WALL_T=-6.0,3.7,6.2,.17
# Four plaster pieces leave an exact opening; unbevelled, so no seam grooves.
for x0,x1,z0,z1 in [(WALL_X0,WIN_X0,0,WALL_H),(WIN_X1,WALL_X1,0,WALL_H),
                    (WIN_X0,WIN_X1,0,WIN_Z0),(WIN_X0,WIN_X1,WIN_Z1,WALL_H)]:
    box('Back plaster wall',((x0+x1)/2,BACK_Y,(z0+z1)/2),(x1-x0,WALL_T,z1-z0),plaster,0)
box('Left plaster wall',(-6,.5+BACK_SHIFT/2,3.1),(.17,8.5+BACK_SHIFT,6.2),plaster,.01)
corner=empty('Chamfered right wall',(4.8,3.72+BACK_SHIFT,0),(0,0,math.radians(-38)))
box('Right wall plaster',(0,0,3.1),(3.65,.17,6.2),plaster,.01,corner)
for i in range(8):
    x=-5.42+i*1.2
    box('Back sage panel %02d'%i,(x,BACK_Y-.12,1.26),(1.15,.055,2.44),sage,.012)
    box('Back inset %02d'%i,(x,BACK_Y-.166,1.27),(.91,.04,1.95),sage_light,.012)
    for sx in [-.47,.47]:box('Panel vertical trim',(x+sx,BACK_Y-.2,1.27),(.025,.022,2.02),trim,.004)
    for sz in [.24,2.3]:box('Panel horizontal trim',(x,BACK_Y-.2,sz),(.96,.022,.025),trim,.004)
box('Continuous walnut chair rail',(-1.1,BACK_Y-.23,2.55),(9.7,.11,.09),wood,.018)
box('Walnut skirting',(-1.1,BACK_Y-.23,.13),(9.7,.12,.23),wood,.015)
for i in range(3):
    x=-1.2+i*1.2
    box('Corner sage panel',(x,-.115,1.26),(1.15,.05,2.44),sage,.015,corner)
    box('Corner panel inset',(x,-.15,1.26),(.94,.025,1.97),sage_light,.01,corner)
box('Corner chair rail',(0,-.17,2.55),(3.6,.12,.09),wood,.015,corner)
box('Corner skirting',(0,-.17,.13),(3.6,.12,.23),wood,.015,corner)

# The back-wall window looks out on a sunlit city street. Behind the opening an
# emissive picture plane, larger than the opening, closes the view without gaps;
# walnut linings, casing, mullions and sill frame it, with clear, light glass.
# Root origin: centre of the opening on the wall's room face; local -Y faces the room.
window=empty('Window',(WIN_CX,BACK_Y-WALL_T/2,WIN_Z0+WIN_H/2))
hw,hh=WIN_W/2,WIN_H/2
for side in (-1,1):
    box('Window jamb lining',(side*(hw-.02),WALL_T/2,0),(.04,WALL_T+.004,WIN_H),wood,0,window)
    # Side casings stop under the head casing, so the two never overlap.
    box('Window casing',(side*(hw+.06),-.035,-.03),(.16,.07,WIN_H+.1),wood,.012,window)
for z in (-hh+.02,hh-.02):
    box('Window head and sill lining',(0,WALL_T/2,z),(WIN_W,WALL_T+.004,.04),wood,0,window)
box('Window casing head',(0,-.035,hh+.1),(WIN_W+.44,.07,.16),wood,.012,window)
box('Window sill',(0,-.11,-hh-.04),(WIN_W+.5,.3,.08),wood,.02,window)
WINDOW_VIEW_PATH=ROOT/'art/office/window-day.jpg'
WINDOW_VIEW_STRENGTH=1.2
WINDOW_VIEW_CENTER_U=.5
VIEW_W,VIEW_H,VIEW_Y=WIN_W+.6,WIN_H+.6,WALL_T+.02
window_view=material('Window day city view',(0,0,0),.9)
window_view_info={'image':None,'emissionStrength':WINDOW_VIEW_STRENGTH}
pane=plane('Window city view',(0,VIEW_Y,0),(VIEW_W,VIEW_H),window_view,window)
if WINDOW_VIEW_PATH.exists():
    view_image=bpy.data.images.load(str(WINDOW_VIEW_PATH))
    view_image.pack()
    nt=window_view.node_tree
    view_tex=nt.nodes.new('ShaderNodeTexImage');view_tex.image=view_image
    view_tex.extension='EXTEND'
    shader=nt.nodes.get('Principled BSDF')
    nt.links.new(view_tex.outputs['Color'],shader.inputs['Emission Color'])
    shader.inputs['Emission Strength'].default_value=WINDOW_VIEW_STRENGTH
    # Crop the picture to the view plane without stretching it: a wider image
    # keeps its full height and a slice around WINDOW_VIEW_CENTER_U; a narrower
    # image keeps its full width and a centred band of its height.
    pane_aspect=VIEW_W/VIEW_H
    image_aspect=view_image.size[0]/max(view_image.size[1],1)
    view_width,view_height=(pane_aspect/image_aspect,1) if image_aspect>=pane_aspect else (1,image_aspect/pane_aspect)
    view_left=min(max(WINDOW_VIEW_CENTER_U-view_width/2,0),1-view_width)
    view_bottom=(1-view_height)/2
    for uv in pane.data.uv_layers.active.data:
        uv.uv=(view_left+uv.uv[0]*view_width,view_bottom+uv.uv[1]*view_height)
    window_view_info={'image':'art/office/'+WINDOW_VIEW_PATH.name,'size':list(view_image.size),
        'uvCrop':[round(view_left,4),round(view_bottom,4),round(view_left+view_width,4),round(view_bottom+view_height,4)],
        'emissionStrength':WINDOW_VIEW_STRENGTH}
else:
    # Procedural fallback: a clear daytime sky over pale house silhouettes.
    window_view_info={'image':None,'procedural':True,'emissionStrength':1.1}
    glow(window_view,(.22,.42,.78),1.1)
    city_rng=random.Random(77)
    facade=glow(material('Window procedural facade',(0,0,0),.9),(.5,.4,.29),1.0)
    facade_far=glow(material('Window procedural far facade',(0,0,0),.9),(.36,.42,.52),1.0)
    x=-VIEW_W/2
    while x<VIEW_W/2:
        width=city_rng.uniform(.35,.8);height=city_rng.uniform(.6,1.9)
        far=city_rng.random()<.4
        box('Window procedural house',(x+width/2,VIEW_Y-(.003 if far else .006),-VIEW_H/2+height/2),
            (width-.02,.002,height),facade_far if far else facade,0,window)
        x+=width
glass=material('Window clear glass',(.78,.82,.84),.03)
glass_shader=glass.node_tree.nodes.get('Principled BSDF')
glass_shader.inputs['Alpha'].default_value=.08
glass.surface_render_method='BLENDED'
plane('Window glass',(0,.125,0),(WIN_W-.08,WIN_H-.08),glass,window)
for x in (-WIN_W/6,WIN_W/6):box('Window vertical mullion',(x,.075,0),(.065,.07,WIN_H-.06),wood,.008,window)

# Archive: individual books, actual shelves, closed lower doors and brass handles.
shelf=empty('Bookshelf',(-4.98,3.9+BACK_SHIFT,0))
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
desk=empty('Desk')
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
desk_accessories=empty('DeskAccessories')
box('Leather desk pad',(1.92,-.9,1.443),(3.18,2.31,.035),leather,.08,desk_accessories)
for x in [.37,3.47]:line('Deskpad stitched side',[(x,-2.01,1.465),(x,.2,1.465)],.006,leather_light,desk_accessories)
for y in [-2.01,.2]:line('Deskpad stitched end',[(.37,y,1.465),(3.47,y,1.465)],.006,leather_light,desk_accessories)

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
lamp=empty('BankersLamp',(-4.6,.33,1.45))
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
box('Phone sage screen',(0,-.083,.86),(.72,.012,1.49),phone_screen,.052,phone)
box('Phone speaker',(0,-.094,1.525),(.16,.009,.025),black,.01,phone)
text('Phone line title','LINE',(0,-.101,1.34),.073,phone_text,phone)
text('Phone connection status','ONLINE',(0,-.101,1.08),.12,phone_text,phone)
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
            'model':tripo_metadata.get('model',tripo_metadata.get('actualModel','H3.1 Best Quality')),
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

profile=empty('Lawyer',(1.99,4.26+BACK_SHIFT,3.47))
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

# Framed dark navigation map on the chamfered wall. Everything on the map is
# flat and stays within 3 cm of the parchment, which remains one separate, flat,
# unmerged rectangle ('City map parchment', 2.38 x 1.67, facing the room) so the
# game can lay a live HTML map over its exact bounds.
MAP_W,MAP_H=2.38,1.67
MAP_FACE=-.097
def flat_mesh(name, verts, faces, mat, parent, loc=(0,0,0)):
    # Faces are wound to face local -Y, the room side of every wall group.
    oriented=[]
    for face in faces:
        a,b,c=(Vector(verts[i]) for i in face[:3])
        oriented.append(tuple(reversed(face)) if (b-a).cross(c-a).y>0 else tuple(face))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],oriented);mesh.materials.append(mat)
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.parent=parent;obj.location=loc
    return obj
def flat_path(name, points, width, depth, mat, parent, closed=False):
    """A flat ribbon through (x, z) points in the parent's wall plane."""
    pts=[Vector(p) for p in points];n=len(pts);verts=[]
    for i,p in enumerate(pts):
        prev=pts[i-1] if closed or i else None
        nxt=pts[(i+1)%n] if closed or i<n-1 else None
        d_in=(p-prev).normalized() if prev is not None else None
        d_out=(nxt-p).normalized() if nxt is not None else None
        d_in=d_in if d_in is not None else d_out
        d_out=d_out if d_out is not None else d_in
        tangent=(d_in+d_out);tangent=tangent.normalized() if tangent.length>1e-6 else d_out
        normal=Vector((-tangent.y,tangent.x))
        miter=1/max(.4,normal.dot(Vector((-d_out.y,d_out.x))))
        for side in (1,-1):
            q=p+normal*side*width/2*miter
            verts.append((q.x,depth,q.y))
    faces=[(2*i,2*((i+1)%n),2*((i+1)%n)+1,2*i+1) for i in range(n if closed else n-1)]
    return flat_mesh(name,verts,faces,mat,parent)
def flat_rects(name, rects, depth, mat, parent):
    verts=[];faces=[]
    for cx,cz,w,h in rects:
        base=len(verts)
        verts+=[(cx-w/2,depth,cz-h/2),(cx+w/2,depth,cz-h/2),(cx+w/2,depth,cz+h/2),(cx-w/2,depth,cz+h/2)]
        faces.append((base,base+1,base+2,base+3))
    return flat_mesh(name,verts,faces,mat,parent)
def distance_to_path(point, path):
    best=9
    for a,b in zip(path,path[1:]):
        a,b,p=Vector(a),Vector(b),Vector(point)
        t=max(0,min(1,(p-a).dot(b-a)/max((b-a).length_squared,1e-9)))
        best=min(best,(a+(b-a)*t-p).length)
    return best

citymap=empty('CityMap',(4.45,3.8+BACK_SHIFT,3.68),(0,0,math.radians(-38)))
box('City map walnut frame',(0,0,0),(2.62,.11,1.9),wood,.035,citymap)
box('City map brass reveal',(0,-.067,0),(2.48,.026,1.77),brass,.018,citymap)
box('City map board edge',(0,-.087,0),(MAP_W,.014,MAP_H),map_edge,.004,citymap)
parchment=flat_mesh('City map parchment',
    [(-MAP_W/2,0,-MAP_H/2),(MAP_W/2,0,-MAP_H/2),(MAP_W/2,0,MAP_H/2),(-MAP_W/2,0,MAP_H/2)],
    [(0,1,2,3)],map_bg,citymap,(0,MAP_FACE,0))
parchment_uv=parchment.data.uv_layers.new(name='UVMap')
for loop,uv in zip(parchment.data.loops,parchment_uv.data):
    co=parchment.data.vertices[loop.vertex_index].co
    uv.uv=(co.x/MAP_W+.5,co.z/MAP_H+.5)
# The river ends on the brass neatline so its ribbon never overhangs the parchment.
map_river_path=[(-.4,-.8),(-.25,-.6),(.02,-.42),(-.02,-.18),(.12,.02),(.4,.12),(.75,.1),(1.15,.2)]
map_streets_ew=[-.6,-.3,.0,.3,.58]
map_streets_ns=[-.86,-.56,-.26,.06,.38,.68,.96]
map_rng=random.Random(2077)
blocks=[]
xs=[-1.13]+map_streets_ns+[1.13];zs=[-.78]+map_streets_ew+[.66]
for x0,x1 in zip(xs,xs[1:]):
    for z0,z1 in zip(zs,zs[1:]):
        cx,cz,w,h=(x0+x1)/2,(z0+z1)/2,x1-x0-.06,z1-z0-.06
        if w<.05 or h<.05 or distance_to_path((cx,cz),map_river_path)<.16:continue
        if map_rng.random()<.45:
            left,right=cx-w/2,cx+w/2;cut=left+w*map_rng.uniform(.38,.62)
            blocks.append(((left+cut-.018)/2,cz,cut-.018-left,h))
            blocks.append(((cut+.018+right)/2,cz,right-cut-.018,h))
        else:blocks.append((cx,cz,w,h))
flat_rects('Map dark city blocks',blocks,MAP_FACE-.002,map_block,citymap)
flat_path('Map river',map_river_path,.095,MAP_FACE-.004,map_river,citymap)
for z in map_streets_ew:flat_path('Map east west street',[(-1.13,z),(1.13,z+.02)],.011,MAP_FACE-.006,map_street,citymap)
for x in map_streets_ns:flat_path('Map north south street',[(x,-.78),(x+.03,.66)],.01,MAP_FACE-.006,map_street,citymap)
flat_path('Map diagonal avenue',[(-1.13,-.74),(-.2,.05),(.38,.62)],.013,MAP_FACE-.006,map_street,citymap)
flat_path('Map brass neatline',[(-1.15,-.8),(1.15,-.8),(1.15,.8),(-1.15,.8)],.007,MAP_FACE-.008,map_brass,citymap,closed=True)
# Five districts: Hill, Suburb, River district, Business quarter, Old port.
map_districts=[
    [(-1.1,.63),(-.38,.63),(-.32,.36),(-.66,.27),(-1.1,.34)],
    [(-1.1,-.76),(-.56,-.76),(-.4,-.4),(-.74,-.2),(-1.1,-.26)],
    [(-.3,-.5),(.16,-.55),(.3,-.1),(.15,.3),(-.25,.24)],
    [(.27,.63),(1.1,.63),(1.1,.38),(.7,.3),(.32,.34)],
    [(.46,-.06),(1.1,-.02),(1.1,-.74),(.56,-.74),(.36,-.36)]]
for points in map_districts:
    flat_path('Map brass district outline',points,.012,MAP_FACE-.01,map_brass,citymap,closed=True)
    x=sum(p[0] for p in points)/len(points);z=sum(p[1] for p in points)/len(points)
    cylinder('Map district pin',(x,MAP_FACE-.008,z),.026,.012,brass,citymap,16,(math.pi/2,0,0))
    sphere('Map pin cap',(x,MAP_FACE-.017,z),(.016,.006,.016),burgundy,citymap,12,6)
text('Map city title','NOVORECHENSK',(0,MAP_FACE-.002,.735),.06,map_brass,citymap)

# Plant and personal desk objects add scale and lived-in character.
plant=empty('Cactus',(3.68,.63,1.43))
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

# Generated furniture is stored as small, self-contained, versioned GLBs. The
# source object's transforms are baked into vertices before slot normalization,
# so the established UI roots retain their exact transforms and unit scale.
tripo_assets=[]
def tint_base_color(mat, tint):
    """Multiply a material's base colour by a constant RGB tone.

    A textured base colour gets a Mix (Multiply, factor 1) node in front of the
    Principled BSDF; Blender's glTF exporter writes that constant as the
    material's baseColorFactor, so the tone survives export without a new image.
    """
    nt=mat.node_tree
    for shader_node in [n for n in nt.nodes if n.type=='BSDF_PRINCIPLED']:
        socket=shader_node.inputs['Base Color']
        if not socket.links:
            socket.default_value=(*(c*t for c,t in zip(socket.default_value[:3],tint)),socket.default_value[3])
            continue
        source=socket.links[0].from_socket
        mix=nt.nodes.new('ShaderNodeMix');mix.name=mix.label='Walnut tone'
        mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.clamp_result=False
        mix.inputs['Factor'].default_value=1
        color_a,color_b=[s for s in mix.inputs if s.type=='RGBA']
        color_b.default_value=(*tint,1)
        nt.links.new(source,color_a)
        nt.links.new([s for s in mix.outputs if s.type=='RGBA'][0],socket)

def replace_with_tripo(key, root, target_min, target_max, keep_names=(),
                       metallic=.04, roughness=.58, normal=.28, rotation_z=0, tint=None):
    path=ROOT/'art'/'office'/('tripo-'+key+'.glb')
    if not path.exists():
        print('TRIPO_ASSET_NATIVE_FALLBACK',key,flush=True)
        return
    metadata_path=path.with_suffix('.json')
    if not metadata_path.exists():raise RuntimeError('Missing Tripo provenance: '+str(metadata_path))
    metadata=json.loads(metadata_path.read_text(encoding='utf-8'))
    actual_sha=hashlib.sha256(path.read_bytes()).hexdigest()
    if not metadata.get('optimizedSHA256') or metadata['optimizedSHA256']!=actual_sha:
        raise RuntimeError('Optimized Tripo '+key+' SHA256 does not match its provenance record')
    native_children=list(root.children_recursive)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported=set(bpy.data.objects)-before
    meshes=[obj for obj in imported if obj.type=='MESH' and obj.data.vertices]
    if not meshes:raise RuntimeError('No mesh in Tripo '+key)
    bpy.context.view_layer.update()
    orientation=Matrix.Rotation(math.radians(rotation_z),4,'Z')
    source_points={obj:[orientation@obj.matrix_world@v.co for v in obj.data.vertices] for obj in meshes}
    all_points=[co for points in source_points.values() for co in points]
    minimum=Vector(tuple(min(co[i] for co in all_points) for i in range(3)))
    maximum=Vector(tuple(max(co[i] for co in all_points) for i in range(3)))
    extent=maximum-minimum
    if min(extent)<.00001:raise RuntimeError('Degenerate Tripo bounds: '+key)
    lower,upper=Vector(target_min),Vector(target_max)
    dimensions=upper-lower
    images=set()
    for index,obj in enumerate(meshes):
        obj.data=obj.data.copy()
        for vertex,co in zip(obj.data.vertices,source_points[obj]):
            unit=Vector(tuple((co[i]-minimum[i])/extent[i] for i in range(3)))
            mapped=Vector(tuple(lower[i]+unit[i]*dimensions[i] for i in range(3)))
            if key=='laptop':
                # Fit the base and upright lid continuously through the hinge.
                # The generated casing stays behind the precise CSS3D plane.
                seam=.115
                mapped.z=(lower.z+unit.z/seam*(1.57-lower.z) if unit.z<=seam
                          else 1.57+(unit.z-seam)/(1-seam)*(upper.z-1.57))
                hinge_blend=max(0,min(1,(unit.z-seam)/.035))
                mapped.y=mapped.y*(1-hinge_blend)+(-.32+unit.y*.16)*hinge_blend
            vertex.co=mapped
        # Imported split normals describe the original shape. Recompute them
        # after axis fitting and the laptop's non-linear hinge correction.
        if obj.data.has_custom_normals:
            obj.data.normals_split_custom_set([(0.0,0.0,0.0)]*len(obj.data.loops))
        obj.data.update()
        obj.parent=root
        obj.matrix_parent_inverse=Matrix.Identity(4)
        obj.matrix_basis=Matrix.Identity(4)
        obj.name='Tripo '+key+' geometry '+str(index+1)
        obj['sourceAsset']='art/office/'+path.name
        for mat in obj.data.materials:
            if not mat:continue
            if not mat.name.startswith('Tripo '+key+' / '):mat.name='Tripo '+key+' / '+mat.name
            if not mat.use_nodes:continue
            if tint and not mat.get('walnutTone'):
                tint_base_color(mat,tint);mat['walnutTone']=list(tint)
            for shader_node in mat.node_tree.nodes:
                if shader_node.type=='BSDF_PRINCIPLED':
                    for socket_name,value in [('Metallic',metallic),('Roughness',roughness)]:
                        socket=shader_node.inputs[socket_name]
                        for link in list(socket.links):mat.node_tree.links.remove(link)
                        socket.default_value=value
                elif shader_node.type=='NORMAL_MAP':shader_node.inputs['Strength'].default_value=normal
                elif shader_node.type=='TEX_IMAGE' and shader_node.image:images.add(shader_node.image)
        if key=='lamp':
            # Refinish the genuine Tripo lamp mesh: its source texture had a
            # purple stem and blue patches on the shade. Use restrained enamel
            # and brass without changing the generated silhouette or fittings.
            lamp_brass=brass.copy();lamp_brass.name='Tripo lamp / Restored brass fittings'
            lamp_enamel=material('Tripo lamp / Dark green enamel',(.024,.095,.047),.23,.08)
            obj.data.materials.append(lamp_brass)
            brass_index=len(obj.data.materials)-1
            obj.data.materials.append(lamp_enamel)
            enamel_index=len(obj.data.materials)-1
            for face in obj.data.polygons:
                face.material_index=brass_index if face.center.z<.9 else enamel_index
        obj.data.calc_loop_triangles()
    for img in images:img.pack()
    for obj in list(imported):
        if obj not in meshes:bpy.data.objects.remove(obj,do_unlink=True)
    for obj in native_children:
        if obj.name not in keep_names:bpy.data.objects.remove(obj,do_unlink=True)
    root['sourceAsset']='art/office/'+path.name
    root['generator']='Tripo Studio / '+metadata.get('model',metadata.get('actualModel','H3.1 Best Quality'))
    report={
        'id':key,'objectName':root.name,'used':True,
        'referenceSource':'art/office/'+path.name,
        'sourceSha256':actual_sha,
        'originalDownloadSha256':metadata.get('originalSHA256'),
        'generationId':metadata.get('generationId'),
        'model':metadata.get('model',metadata.get('actualModel','H3.1 Best Quality')),
        'sourceBytes':path.stat().st_size,
        'sourceTriangles':sum(len(obj.data.loop_triangles) for obj in meshes),
        'bytes':path.stat().st_size,
        'triangles':sum(len(obj.data.loop_triangles) for obj in meshes),
        'textures':[{'name':img.name,'width':img.size[0],'height':img.size[1]} for img in sorted(images,key=lambda item:item.name)],
        'placementBounds':{'min':list(target_min),'max':list(target_max),'space':'Blender parent-local Z-up'},
        'nativeScreenFinishing':key in {'laptop','phone'},
        'normalsRecomputedAfterFitting':True,
        'materialAdjustment':{'metallic':metallic,'roughness':roughness,'normalStrength':normal,
                              'baseColorTint':list(tint) if tint else None}
    }
    tripo_assets.append(report)
    print('TRIPO_ASSET_IMPORTED',json.dumps(report),flush=True)

# The generated desk and archive textures are orange; a constant multiply turns
# them into noble walnut while the source GLBs stay untouched.
DESK_TINT=(.32,.58,1.0)
ARCHIVE_TINT=(.28,.42,.70)
replace_with_tripo('desk',desk,(-5.025,-2.36,0),(5.025,1.42,1.425),roughness=.48,tint=DESK_TINT)
replace_with_tripo('archive',shelf,(-1,-.39,0),(1,.33,4.7),roughness=.56,tint=ARCHIVE_TINT)
replace_with_tripo('lamp',lamp,(-.55,-.29,0),(.55,.29,1.25),metallic=.42,roughness=.32,normal=.20)
for asset in tripo_assets:
    if asset['id']=='lamp':
        asset['blenderFinishing']='Original generated geometry retained; metal fittings refinished in brass and shade in dark green enamel. Mottled source texture removed from the scene.'
        asset['sourceTexturesRetainedInScene']=False
replace_with_tripo('cactus',plant,(-.52,-.52,0),(.52,.52,1.62),metallic=0,roughness=.76,normal=.35)
laptop_finished_names=tuple(obj.name for obj in laptop.children_recursive
    if obj.name.startswith('Laptop individual key') or obj.name in {
        'Laptop screen black bezel','Laptop screen glass','Laptop camera lens',
        'Laptop keyboard inset','Laptop space key','Laptop trackpad','Laptop trackpad outline'})
replace_with_tripo('laptop',laptop,(-3.815,-2.04,1.4125),(1.015,-.16,4.49),
    keep_names=laptop_finished_names,metallic=.32,roughness=.38,normal=.13)
if any(asset['id']=='laptop' for asset in tripo_assets):
    # Manual hard-surface finishing over the genuine generated casing. The
    # source shell remains the base/back/hinge; these pieces remove generated
    # dents from the work deck and keep individual keys readable at camera focus.
    box('Laptop finished work deck',(SX,-1.14,1.552),(4.70,1.73,.043),aluminium,.035,laptop)
    for side in [-1,1]:
        box('Laptop finished display side trim',(SX+side*2.3825,SY-.034,2.99),
            (.115,.052,3.04),aluminium,.022,laptop)
    box('Laptop finished display top trim',(SX,SY-.034,4.49),(4.88,.052,.105),aluminium,.025,laptop)
    box('Laptop finished display bottom trim',(SX,SY-.034,1.515),(4.88,.052,.1),aluminium,.025,laptop)
    for asset in tripo_assets:
        if asset['id']=='laptop':
            asset['blenderFinishing']='Generated casing retained; continuous hinge fitting, recalculated normals, planar machined work deck, separate keycaps, trackpad and bevelled display trim authored in Blender.'
replace_with_tripo('phone',phone,(-.435,-.0575,0),(.435,.0575,1.72),
    keep_names=tuple(obj.name for obj in phone.children_recursive if obj.name not in {'Phone metal chassis','Phone volume key','Phone volume key.001'}),
    metallic=.24,roughness=.35,normal=.13)

# Camera: modest perspective, screen nearly half the frame width at 1440 x 850.
CAM_POS=(1.18,-11.85,6.03)
CAM_TARGET=(-.08,.45,2.48)
bpy.ops.object.camera_add(location=CAM_POS)
camera=bpy.context.object;camera.name='Camera'
camera.rotation_euler=(Vector(CAM_TARGET)-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='PERSP';camera.data.lens=44.5;camera.data.sensor_width=36
camera.data.clip_start=.05;camera.data.clip_end=100
bpy.context.scene.camera=camera

# Day: sun through the back window, soft daylight from the window and the open
# side of the set, a bright warm sky, soft shadows and no black corners. The
# lamp is off. These lights only shape the Cycles fallback preview; they are
# not exported (the game lights the scene itself).
# The idle laptop face glows faintly; the live HTML screen covers it in the game.
glow(screen,(.03,.09,.065),.22)

def light(kind,name,loc,target,power,color,size=.1,spot=None):
    bpy.ops.object.light_add(type=kind,location=loc)
    obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.color=color
    if kind=='AREA':obj.data.shape='RECTANGLE';obj.data.size,obj.data.size_y=size
    elif kind in {'POINT','SPOT'}:obj.data.shadow_soft_size=size
    if kind=='SPOT':obj.data.spot_size=math.radians(spot);obj.data.spot_blend=.65
    obj.visible_camera=False
    if target:obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
WIN_CENTER=Vector((WIN_CX,BACK_Y-WALL_T/2,WIN_Z0+WIN_H/2))
# Direction the sunlight travels: from behind the back wall, high and from the
# left, so it falls through the window across the desk.
SUN_DIRECTION=Vector((.38,-.72,-.58)).normalized()
SUN_COLOR=(1,.93,.82);SUN_STRENGTH=3.2;SUN_ANGLE=math.radians(4)
bpy.ops.object.light_add(type='SUN',location=tuple(WIN_CENTER+Vector((0,6,6))))
sun=bpy.context.object;sun.name='Day sun';sun.data.energy=SUN_STRENGTH;sun.data.color=SUN_COLOR
sun.data.angle=SUN_ANGLE;sun.rotation_euler=SUN_DIRECTION.to_track_quat('-Z','Y').to_euler()
sun.visible_camera=False
DAYLIGHT=(1,.97,.92)
light('AREA','Window daylight',tuple(WIN_CENTER-Vector((0,.3,0))),(WIN_CX,-3,1.6),700,DAYLIGHT,(WIN_W-.2,WIN_H-.2))
light('AREA','Ceiling bounce',(0,1.2,7.2),(0,1.2,0),700,(1,.95,.86),(9,7))
light('AREA','Open side daylight',(1,-8.5,5.6),(0,2,2.4),420,(.95,.97,1),(7,5))
light('AREA','Warm wall bounce',(-5.6,1.5,3.2),(2,1.5,2.4),180,(1,.88,.72),(4,3))
scene=bpy.context.scene
WORLD_COLOR=(.62,.57,.48)
scene.world.color=WORLD_COLOR
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(*WORLD_COLOR,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.cycles.device='CPU'
scene.render.resolution_x=1440;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.35
scene.render.filepath=str(OUT/'office-preview.png')

# Merge by interactive ancestor and material: preserve named hit targets while
# reducing hundreds of tiny book, key and joinery objects to a compact draw list.
interactive=['Laptop','ScreenAnchor','Phone','FolderCurrent','FolderArchive','FountainPen','Bookshelf','Mirror','CityMap','Lawyer','Desk','BankersLamp','Cactus','TripoChair']
protected_roots=interactive
bpy.context.view_layer.update()
# The map parchment stays a separate, named, flat node for the live HTML map.
STANDALONE_MESHES={'City map parchment'}
batches={}
for obj in list(scene.objects):
    if obj.type!='MESH' or obj.name in STANDALONE_MESHES:continue
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
rounded=lambda values:[round(v,4) for v in values]
parchment=bpy.data.objects['City map parchment']
city_map_surface={
    'object':'City map parchment','threeName':'City_map_parchment','parent':'CityMap',
    'position':rounded(to_gltf(parchment.location)),'width':MAP_W,'height':MAP_H,
    'localPlane':'XY','normal':[0,0,1],
    'worldCorners':[rounded(to_gltf(parchment.matrix_world@v.co)) for v in parchment.data.vertices],
    'note':'Flat unmerged quad; map details stay within 0.03 m in front of it.'}
day_lighting={
    'exportedLights':[],
    'note':'The GLB carries no punctual lights; the Cycles preview lights are listed as hints for the runtime rig. sunDirection is the direction the light travels.',
    'sunDirection':rounded(to_gltf(SUN_DIRECTION)),'sunColor':list(SUN_COLOR),'sunStrength':SUN_STRENGTH,
    'windowCenter':rounded(to_gltf(WIN_CENTER)),'windowSize':[WIN_W,WIN_H],'windowNormal':[0,0,1],
    'windowColor':list(DAYLIGHT),'skyColor':list(WORLD_COLOR),'lamp':'off'}
emissive_materials=[]
for mat in sorted({m for o in scene.objects if o.type=='MESH' for m in o.data.materials if m and m.use_nodes},key=lambda m:m.name):
    node=mat.node_tree.nodes.get('Principled BSDF')
    if not node:continue
    strength=node.inputs['Emission Strength'].default_value
    color=node.inputs['Emission Color']
    if strength>0 and (color.links or max(color.default_value[:3])>0):
        emissive_materials.append({'material':mat.name,'strength':round(strength,3),
            'color':'texture' if color.links else rounded(color.default_value[:3])})
manifest={
    'generator':'Blender 4.5.14',
    'source':'Authored Blender room, folders, fountain pen and interaction surfaces; user office sketch reference; existing project portrait texture. Versioned Tripo Studio assets are optimized and fitted in Blender; see tripo and tripoAssets for actual import provenance.',
    'tripoUsed':tripo_info['used'],
    'tripo':tripo_info,
    'tripoAssets':tripo_assets,
    'coordinateSystem':'glTF Y-up; positions converted from Blender Z-up (x, y, z) to (x, z, -y)',
    'screen':{'width':SW,'height':SH,'anchor':'ScreenAnchor','localPlane':'XY','domWidth':900,'domHeight':560,'scale':[1,1,1],'unparented':True,'blenderRotation':[math.pi/2,0,0],'glTFBasisCorrection':'The empty uses the CSS local XY basis, facing +Z in glTF. Its Blender XY basis faces -Y. The export step removes Blender exporter empty-basis compensation.'},
    'phoneScreen':{'parent': 'Phone', 'position': [0, 0.86, 0.115], 'width': 0.72, 'height': 1.49, 'domWidth': 320, 'domHeight': 662.2222222222223},
    'camera':{'name':'Camera','position':to_gltf(CAM_POS),'target':to_gltf(CAM_TARGET),'fov':math.degrees(2*math.atan(math.tan(camera.data.angle_x/2)/(1440/850))),'fovAxis':'vertical','aspect':1440/850,'blenderPosition':list(CAM_POS),'blenderTarget':list(CAM_TARGET)},
    'objects':interactive,
    'triangles':triangles,
    'meshObjects':sum(1 for o in scene.objects if o.type=='MESH'),
    'materials':len(bpy.data.materials),
    'labelAnchors':{
        'Laptop':to_gltf((SX,SY,4.48)), 'Phone':to_gltf((3.78,-1.5,3.28)),
        'FolderCurrent':to_gltf((1.75,-1.1,1.9)), 'FolderArchive':to_gltf((2.5,-.26,1.9)),
        'FountainPen':to_gltf((1.95,-1.96,1.75)), 'Bookshelf':to_gltf((-4.98,3.5+BACK_SHIFT,4.9)),
        'Desk':to_gltf((0,-2.3,1.35)), 'BankersLamp':to_gltf((-4.6,.33,2.75)),
        'Cactus':to_gltf((3.68,.63,3.1)), 'TripoChair':to_gltf((1.93,1.68,3.05)),
        'Mirror':to_gltf((-5.7,2.2,4.7)), 'CityMap':to_gltf((4.4,3.5+BACK_SHIFT,4.9)), 'Lawyer':to_gltf((1.99,3.9+BACK_SHIFT,4.56))
    },
    'backShift':BACK_SHIFT,
    'cityMapSurface':city_map_surface,
    'windowView':window_view_info,
    'dayLighting':day_lighting,
    'emissiveMaterials':emissive_materials
}
(OUT/'office-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'office.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'office.glb'),export_format='GLB',export_cameras=True,export_lights=False,export_yup=True,export_apply=True,export_materials='EXPORT',export_texcoords=True,export_normals=True,export_animations=False,export_extras=True)
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
