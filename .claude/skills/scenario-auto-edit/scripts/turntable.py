"""Headless Blender turntable of a GLB on a transparent background (optional B-roll step).

usage: blender -b --factory-startup -P turntable.py -- <glb> <outdir> <tex|clay> <frames> <width> <height> [--test] [--force]

Writes <outdir>/0000.png ... one PNG per frame, one full turn. tex keeps the model's materials;
clay replaces them with a neutral grey. --test renders the first frame only. An outdir that
already holds PNGs is only written to with --force. Encode the frames with ffmpeg afterwards.
"""
import argparse, glob, sys, math, os

ap = argparse.ArgumentParser(prog='turntable.py', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('glb'); ap.add_argument('outdir'); ap.add_argument('mode', choices=['tex', 'clay'])
ap.add_argument('frames', type=int); ap.add_argument('width', type=int); ap.add_argument('height', type=int)
ap.add_argument('--test', action='store_true', help='render the first frame only')
ap.add_argument('--force', action='store_true', help='write into an outdir that already holds PNGs')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
glb, outdir, mode, nframes, W, H, test = args.glb, args.outdir, args.mode, args.frames, args.width, args.height, args.test
if not os.path.isfile(glb): sys.exit(f'{glb} not found.')
if glob.glob(os.path.join(outdir, '*.png')) and not args.force:
    sys.exit(f'{outdir} already holds PNG frames. Use another folder or pass --force to overwrite them.')
try:
    import bpy
    from mathutils import Vector
except ImportError:
    sys.exit('Run this inside Blender: blender -b --factory-startup -P turntable.py -- <glb> <outdir> <tex|clay> <frames> <width> <height>')
os.makedirs(outdir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=glb)
objs = [o for o in sc.objects if o.type == 'MESH']

# normalise: centre on the ground, 2 units tall, under one pivot that we spin
pivot = bpy.data.objects.new('pivot', None); sc.collection.objects.link(pivot)
mins = Vector((1e9, 1e9, 1e9)); maxs = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for v in o.bound_box:
        w = o.matrix_world @ Vector(v)
        mins = Vector(map(min, mins, w)); maxs = Vector(map(max, maxs, w))
size = maxs - mins; k = 2.0 / size.z
centre = (mins + maxs) / 2
for o in objs:
    o.parent = pivot
    o.matrix_parent_inverse = pivot.matrix_world.inverted()
pivot.location = (0, 0, 0)
for o in objs:
    o.location = (o.location - Vector((centre.x, centre.y, mins.z)))
pivot.scale = (k, k, k)

if mode == 'clay':
    mat = bpy.data.materials.new('clay'); mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.42, 0.41, 0.40, 1)
    bsdf.inputs['Roughness'].default_value = 0.62
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(mat)

# camera: 50 mm, slightly above, framing the 2-unit figure at ~58 % of a vertical frame
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
dist = 5.9
cam.location = (0, -dist, 1.55)
d = Vector((0, 0, 1.0)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def area(name, loc, energy, size, color):
    L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.size = size; L.color = color
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.location = loc
    dd = Vector((0, 0, 1.0)) - Vector(loc); o.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
LS = 0.5 if mode == 'clay' else 1.0
area('key', (-3.5, -3.8, 4.2), 900 * LS, 3.0, (1.0, 0.95, 0.88))
area('fill', (4.0, -3.0, 1.6), 260 * LS, 4.0, (0.86, 0.92, 1.0))
area('rim', (1.5, 4.0, 3.6), 700 * LS, 2.0, (1.0, 0.97, 0.92))
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[1].default_value = 0.35

sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
try:
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48; sc.cycles.use_denoising = True
    sc.cycles.device = 'CPU'
except TypeError as e:
    print('engine fallback', e)
try: sc.view_settings.view_transform = 'Standard'
except Exception as e:
    # Some Blender builds name the transforms differently; their default still renders.
    print('view transform left at default:', e)

frames = [0] if test else range(nframes)
for f in frames:
    pivot.rotation_euler = (0, 0, 2 * math.pi * f / nframes)
    sc.render.filepath = os.path.join(outdir, f'{f:04d}.png')
    bpy.ops.render.render(write_still=True)
print('done')
