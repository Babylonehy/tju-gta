#!/usr/bin/env python3
"""Process the supplied OSM2World campus GLB and derive the full campus collision data.

Usage: python3 scripts/build-osm-campus.py INPUT.glb [OUTPUT_DIRECTORY] --materials DIRECTORY
The seven category nodes and WGS84 origin are the attachment's source contract.
"""
import argparse
import copy
import hashlib
import json
import math
import struct
import zlib
from pathlib import Path

import teaching55

CROP = (-1281, -1025, 1281, 1025)
PLAY = (-1260, -1000, 1260, 1000)
TEACH_44 = (93, 165, 229, 230)  # Isolates the entire 44 teaching building.
SOURCE_FORMATS = {5121: ('B', 255), 5123: ('H', 65535), 5125: ('I', 4294967295), 5126: ('f', 1)}
COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
KEEP_ATTRIBUTES = ('POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'COLOR_0')
BRICK_SOURCE = 'https://polyhaven.com/a/red_bricks_04'
BREAKABLE = (1084.4, 132.3, 1097.0, 145.8)
STYLES = {
    'brick-44': ('red_bricks_04', [1,1,1,1], .65, .94),
    'brick-campus': ('red_bricks_04', [.94,.77,.69,1], .73, .91),
    'road-asphalt': ('asphalt_track', [1.15,1.17,1.18,1], .62, .96),
    'campus-grass': ('leafy_grass', [.60,.90,.61,1], .80, .98),
    'parking-asphalt': ('asphalt_track', [.89,.91,.92,1], .65, .97),
    'running-rubber': ('asphalt_track', [3.6,.63,.40,1], .56, .97),
    'turf-light': ('leafy_grass', [.73,1.28,.66,1], .38, .97),
    'turf-dark': ('leafy_grass', [.59,1.05,.54,1], .38, .97),
    'court-painted': ('asphalt_track', [.50,1.36,1.49,1], .41, .94),
    'court-line': ('asphalt_track', [6.2,6.0,5.5,1], .15, .97),
}
SURFACE_ATTRS = [('POSITION','VEC3'), ('NORMAL','VEC3'), ('TANGENT','VEC4'), ('TEXCOORD_0','VEC2'), ('COLOR_0','VEC4')]


def inside(p, outline):
    x, z = p
    return sum((a[1] > z) != (b[1] > z) and x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]
               for a,b in zip(outline, outline[1:]+outline[:1])) % 2 == 1


def triangulate(outline):
    def cross(a,b,c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    ring = list(dict.fromkeys(tuple(p) for p in outline))
    if sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(ring,ring[1:]+ring[:1])) > 0:
        ring.reverse()  # Positive Y in glTF.
    while len(ring)>3:
        for i,b in enumerate(ring):
            a,c=ring[i-1],ring[(i+1)%len(ring)]
            if cross(a,b,c) >= -1e-7: continue
            if any(max(cross(a,b,p),cross(b,c,p),cross(c,a,p)) < -1e-7 for p in ring if p not in (a,b,c)): continue
            yield a,b,c
            ring.pop(i)
            break
        else:
            raise ValueError(f'Invalid survey polygon {ring!r}')
    if len(ring)==3: yield tuple(ring)


def grain_png(rgb):
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    pixels=bytearray()
    for y in range(96):
        pixels.append(0)
        for x in range(96):
            value=((x*73471 ^ y*52813) * 2654435761 >> 24) % 17 - 8
            pixels.extend(max(0,min(255,c+value)) for c in rgb)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',96,96,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')



def read_glb(path):
    raw = path.read_bytes()
    magic, version, length, size, kind = struct.unpack_from('<5I', raw)
    if (magic, version, length, kind) != (0x46546C67, 2, len(raw), 0x4E4F534A):
        raise ValueError('Expected a GLB 2.0 file')
    binary_size, binary_type = struct.unpack_from('<II', raw, 20 + size)
    if binary_type != 0x004E4942 or 28 + size + binary_size != len(raw):
        raise ValueError('Expected a single embedded GLB buffer')
    return json.loads(raw[20:20 + size]), memoryview(raw)[28 + size:], hashlib.sha256(raw).hexdigest()


def view_bytes(view, blob):
    start = view.get('byteOffset', 0)
    return blob[start:start + view['byteLength']]


def read_accessor(doc, blob, index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    code, denominator = SOURCE_FORMATS[a['componentType']]
    reader = struct.Struct('<' + code * COMPONENTS[a['type']])
    data = view_bytes(view, blob)
    start = a.get('byteOffset', 0)
    stride = view.get('byteStride', reader.size)
    for i in range(a['count']):
        value = reader.unpack_from(data, start + i * stride)
        yield tuple(v / denominator for v in value) if a.get('normalized') else value


def clip(polygon, bounds):
    for axis, boundary, sign in ((0, bounds[0], 1), (2, bounds[1], 1), (0, bounds[2], -1), (2, bounds[3], -1)):
        if not polygon:
            break
        kept = []
        prev = polygon[-1]
        for vertex in polygon:
            was_inside = (prev[axis] - boundary) * sign >= 0
            inside = (vertex[axis] - boundary) * sign >= 0
            if was_inside != inside:
                fraction = (boundary - prev[axis]) / (vertex[axis] - prev[axis])
                kept.append(tuple(a + (b - a) * fraction for a, b in zip(prev, vertex)))
            if inside:
                kept.append(vertex)
            prev = vertex
        polygon = kept
    return [(polygon[0], polygon[i], polygon[i + 1]) for i in range(1, len(polygon) - 1)]


def carve_passage(triangle, passage):
    # Keep everything outside the authored underpass volume. The surveyed roof
    # and building collision records are emitted from the original triangles.
    bounds = ((0, passage['x0'], 1), (0, passage['x1'], -1),
              (2, passage['z0'], 1), (2, passage['z1'], -1),
              (1, passage['ceiling'], -1))
    def side(points, axis, edge, sign):
        if not points:
            return []
        output = []
        prior = points[-1]
        for current in points:
            a, b = (prior[axis]-edge)*sign, (current[axis]-edge)*sign
            if (a>=0) != (b>=0):
                t = a/(a-b)
                output.append(tuple(u+(v-u)*t for u,v in zip(prior,current)))
            if b>=0:
                output.append(current)
            prior = current
        return output
    points = triangle
    for axis, edge, sign in bounds:
        outside = side(points,axis,edge,-sign)
        yield from ((outside[0],outside[i],outside[i+1]) for i in range(1,len(outside)-1))
        points = side(points,axis,edge,sign)
        if not points:
            break


def projected_area(triangle):
    a, b, c = triangle
    return (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])


def on_44(triangle):
    return all(TEACH_44[0] <= v[0] <= TEACH_44[2] and TEACH_44[1] <= v[2] <= TEACH_44[3] for v in triangle)


def normalize(x, y, z):
    length = math.hypot(x, y, z)
    return (x / length, y / length, z / length) if length else (x, y, z)


def brick_vertex(vertex, attributes, face_normal, tile=2.5):
    x, y, z = vertex[:3]
    nx, _, nz = face_normal
    tx, _, tz = normalize(nz, 0, -nx)
    values = {
        'POSITION': (x, y, z), 'NORMAL': face_normal, 'TANGENT': (tx, 0, tz, 1),
        'TEXCOORD_0': ((x * tx + z * tz) / tile, y / tile), 'COLOR_0': (1, 1, 1, 1),
    }
    return tuple(v for name, _ in attributes for v in values[name])


class Campus:
    def __init__(self, source, blob, material_dir, passage):
        self.source = source
        self.passage = passage
        self.blob = blob
        self.material_dir = material_dir
        self.buffer = bytearray()
        self.out = {'asset': copy.deepcopy(source['asset']), 'scene': 0, 'scenes': [], 'nodes': [], 'meshes': [],
                    'bufferViews': [], 'accessors': [], 'images': [], 'textures': [], 'materials': [],
                    'samplers': copy.deepcopy(source['samplers'])}
        for i, sampler in enumerate(self.out['samplers']):
            sampler['name'] = ('repeat' if i == 0 else 'clamp') + f'-{i}'
        self.image_ids = {}
        self.texture_ids = {}
        self.material_ids = {}
        self.surface_maps = {}
        self.lots = []
        self.overlays = {}
        self.collision = {'buildings': [], 'water': [], 'roads': [], 'terrain': [], 'breakable': [], 'paving': []}
        self.teaching_positions = []
        self.wall_panels = {}
        self.original_windows = []
        self.campus_brick = []
        self.teaching_55_roofs = []

    def add_view(self, data):
        self.buffer.extend(bytes(-len(self.buffer) % 4))
        start = len(self.buffer)
        self.buffer.extend(data)
        self.out['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(data)})
        return len(self.out['bufferViews']) - 1

    def add_accessor(self, rows, kind, code):
        write = struct.Struct('<' + code * COMPONENTS[kind])
        a = {'bufferView': self.add_view(b''.join(write.pack(*row) for row in rows)),
             'type': kind, 'componentType': 5126 if code == 'f' else 5125, 'count': len(rows)}
        if kind == 'VEC3':
            a.update(min=list(map(min, zip(*rows))), max=list(map(max, zip(*rows))))
        self.out['accessors'].append(a)
        return len(self.out['accessors']) - 1

    def texture(self, index):
        if index not in self.texture_ids:
            t = copy.deepcopy(self.source['textures'][index])
            image = t['source']
            if image not in self.image_ids:
                i = copy.deepcopy(self.source['images'][image])
                i['bufferView'] = self.add_view(view_bytes(self.source['bufferViews'][i['bufferView']], self.blob))
                self.image_ids[image] = len(self.out['images'])
                self.out['images'].append(i)
            t['source'] = self.image_ids[image]
            t['name'] = f"{self.source['images'][image]['name']}-texture-{index}"
            self.texture_ids[index] = len(self.out['textures'])
            self.out['textures'].append(t)
        return self.texture_ids[index]

    def surface_texture(self, asset, channel):
        name = f'{asset}_{channel}_1k'
        folder = 'red-bricks-04' if asset == 'red_bricks_04' else asset
        data = (self.material_dir / folder / (name + '.jpg')).read_bytes()
        if not data.startswith(b'\xff\xd8\xff'):
            raise ValueError(f'Expected the original Poly Haven JPEG for {channel}')
        image_index = len(self.out['images'])
        self.out['images'].append({'name': name, 'mimeType': 'image/jpeg', 'bufferView': self.add_view(data)})
        self.out['textures'].append({'name': name, 'source': image_index, 'sampler': 0})
        return {'index': len(self.out['textures']) - 1}

    def paint_texture(self, name, rgb):
        image_index=len(self.out['images'])
        self.out['images'].append({'name':name,'mimeType':'image/png','bufferView':self.add_view(grain_png(rgb))})
        self.out['textures'].append({'name':name,'source':image_index,'sampler':0})
        return {'index':len(self.out['textures'])-1}

    def material(self, index):
        if index not in self.material_ids:
            if isinstance(index, str):
                asset, color, normal, rough = STYLES[index]
                if asset not in self.surface_maps:
                    self.surface_maps[asset] = {k:self.surface_texture(asset,k) for k in ('diff','nor_gl','arm')}
                maps = self.surface_maps[asset]
                paint = {'running-rubber': (154,53,44), 'court-painted': (60,116,112), 'court-line': (223,224,212)}.get(index)
                albedo = self.paint_texture(index+'-albedo',paint) if paint else maps['diff']
                m = {'name': index, 'normalTexture': {**maps['nor_gl'], 'scale': normal}, 'occlusionTexture': maps['arm'],
                     'pbrMetallicRoughness': {'baseColorTexture': albedo, 'baseColorFactor': [1,1,1,1] if paint else [min(1,n) for n in color],
                                              'metallicRoughnessTexture': maps['arm'], 'metallicFactor': 0, 'roughnessFactor': rough}}
            else:
                m = copy.deepcopy(self.source['materials'][index])
                pbr = m.setdefault('pbrMetallicRoughness', {})
                if m['name'] in ('ASPHALT', 'Concrete034', 'SETT', 'TERRAIN_DEFAULT', 'GRASS', 'EARTH', 'Plaster002', 'RoofingTiles010', 'Material_8', 'WATER'):
                    pbr['metallicFactor'] = 0
                if m['name'] == 'Windows':
                    pbr.update(baseColorFactor=[.81, .89, .96, 1], metallicFactor=.05)
                # These two source surfaces are plain colors. Use the actual
                # ground and concrete tiles from the map's style set.
                replacement = {'Material_8': 'Concrete034', 'Ground fill - neutral grass': 'GRASS'}.get(m['name'])
                if replacement:
                    donor = next(m for m in self.source['materials'] if m['name'] == replacement)
                    pbr['baseColorTexture'] = copy.deepcopy(donor['pbrMetallicRoughness']['baseColorTexture'])
                if m['name'] == 'Ground fill - neutral grass':
                    pbr['baseColorFactor'] = [.70, .76, .64, 1]
                for values in (m, pbr):
                    for name, tex in values.items():
                        if name.endswith('Texture'):
                            tex['index'] = self.texture(tex['index'])
            self.material_ids[index] = len(self.out['materials'])
            self.out['materials'].append(m)
        return self.material_ids[index]

    def refine_surfaces(self):
        # Add new photo sources after the existing import roster so the sidecar
        # keeps stable IDs for campus scene, meshes and original image slots.
        asphalt = {k: self.surface_texture('asphalt_02', k) for k in ('diff','nor_gl','arm')}
        concrete = {k: self.surface_texture('concrete_wall_009', k) for k in ('diff','nor_gl','arm')}
        for m in self.out['materials']:
            if m['name'] in ('road-asphalt', 'parking-asphalt'):
                maps, tint, normal, rough = asphalt, [.70,.73,.77,1], .88, .96
            elif m['name'] == 'Plaster002':
                maps, tint, normal, rough = concrete, [.76,.79,.80,1], .90, .84
            else:
                continue
            m['normalTexture'] = {**maps['nor_gl'], 'scale': normal}
            m['occlusionTexture'] = maps['arm']
            m['pbrMetallicRoughness'].update(baseColorTexture=maps['diff'], baseColorFactor=tint,
                                             metallicRoughnessTexture=maps['arm'], metallicFactor=0, roughnessFactor=rough)

    def record_wall(self, triangle, normal):
        edge = tuple(sorted(set((round(v[0], 3), round(v[2], 3)) for v in triangle)))
        if len(edge) != 2 or math.dist(*edge) < 8:
            return
        lo, hi = min(v[1] for v in triangle), max(v[1] for v in triangle)
        key = (*edge, round(lo, 3), round(hi, 3))
        self.wall_panels[key] = normal

    def add_facade_details(self):
        windows = []
        for (a,b,lo,hi), (nx,_,nz) in self.wall_panels.items():
            width = math.dist(a,b)
            if hi-lo < 4.2:
                continue
            tx,tz = nz,-nx
            if (b[0]-a[0])*tx+(b[1]-a[1])*tz < 0:
                a,b = b,a
            def native_window(p):
                dx,dz=p[0]-a[0],p[2]-a[1]
                return (abs(dx*nx+dz*nz)<.65 and 0<=dx*tx+dz*tz<=width and lo<p[1]<hi)
            if any(native_window(p) for p in self.original_windows):
                continue
            middle = ((a[0]+b[0])/2, (a[1]+b[1])/2)
            in_circular_hall = 730<middle[0]<910 and -55<middle[1]<152
            bay_width = 2.34 if in_circular_hall else 4.1
            half_window, window_height = (.62,2.19) if in_circular_hall else (1.05,1.32)
            bays = max(1, round(width/bay_width))
            floors = max(1, round((hi-lo)/3.35))
            for f in range(floors):
                base=lo+((f+.5)*(hi-lo)/floors)-window_height*.5
                for i in range(bays):
                    center=(i+.5)*width/bays
                    quad=tuple((a[0]+tx*(center+u)+nx*.021,base+v,a[1]+tz*(center+u)+nz*.021,
                                nx,0,nz,tx,0,tz,-1,(u+half_window)/(half_window*2),1-v/window_height,1,1,1,1)
                               for u,v in [(-half_window,0),(half_window,0),(half_window,window_height),(-half_window,window_height)])
                    windows.extend(((quad[0],quad[1],quad[2]),(quad[0],quad[2],quad[3])))
        facade=[]
        if self.campus_brick:
            facade.append(self.add_primitive(self.campus_brick,SURFACE_ATTRS,'brick-campus'))
        if windows:
            material = next(i for i,m in enumerate(self.source['materials']) if m['name']=='Windows')
            facade.append(self.add_primitive(windows,SURFACE_ATTRS,material))
        if facade:
            self.mesh_node('Campus-brick-and-window-facades',facade)

    def add_primitive(self, triangles, attributes, mat):
        unique = {}
        rows = []
        indices = []
        for triangle in triangles:
            for v in triangle:
                if v not in unique:
                    unique[v] = len(rows)
                    rows.append(v)
                indices.append((unique[v],))
        output = {'attributes': {}, 'material': self.material(mat), 'indices': self.add_accessor(indices, 'SCALAR', 'I')}
        start = 0
        for name, kind in attributes:
            end = start + COMPONENTS[kind]
            values = [v[start:end] for v in rows]
            if name == 'NORMAL':
                values = [normalize(*v) for v in values]
            elif name == 'TANGENT':
                values = [(*normalize(*v[:3]), -1 if v[3] < 0 else 1) for v in values]
            output['attributes'][name] = self.add_accessor(values, kind, 'f')
            start = end
        return output

    def add_collision(self, category, triangle):
        # Project only surfaces with area in the horizontal plane. Heights
        # come from the very same triangles used by the road and terrain GLB.
        if not category or abs(projected_area(triangle)) < 1e-4:
            return
        bounds = (PLAY[0] - 8, PLAY[1] - 8, PLAY[2] + 8, PLAY[3] + 8)
        for t in clip([v[:3] for v in triangle], bounds):
            self.collision[category].append([round(n, 3) for v in t for n in v])

    def add_node(self, node):
        key = node['name']
        if any(k in node for k in ('rotation', 'scale', 'matrix', 'children')):
            raise ValueError(f'Unexpected source transform for {key}')
        translation = node.get('translation', (0, 0, 0))
        primitives = []
        booth = []
        for primitive in self.source['meshes'][node['mesh']]['primitives']:
            names = [key for key in KEEP_ATTRIBUTES if key in primitive['attributes']]
            accessors = [primitive['attributes'][key] for key in names]
            attributes = [(name, self.source['accessors'][a]['type']) for name, a in zip(names, accessors)]
            vertices = [tuple(v for attr in values for v in attr) for values in zip(*(read_accessor(self.source, self.blob, a) for a in accessors))]
            vertices = [tuple(a + b for a, b in zip(v[:3], translation)) + v[3:] for v in vertices]
            indices = [n for n, in read_accessor(self.source, self.blob, primitive['indices'])]
            material_index = primitive['material']
            name = self.source['materials'][material_index]['name']
            replacement = {'ASPHALT':'road-asphalt','GRASS':'campus-grass','TERRAIN_DEFAULT':'campus-grass',
                           'Ground fill - neutral grass':'campus-grass'}.get(name)
            if replacement or name == 'Material_8':
                uv = sum(COMPONENTS[kind] for key, kind in attributes[:names.index('TEXCOORD_0')])
                tile = 1.65 if replacement == 'campus-grass' else 3
                tangent = sum(COMPONENTS[kind] for key, kind in attributes[:names.index('TANGENT')])
                def ground_vertex(v):
                    n = v[3:6]
                    tx = normalize(1 - n[0]*n[0], -n[0]*n[1], -n[0]*n[2])
                    t = v[:tangent] + (*tx, -1) + v[tangent+4:] if abs(n[1]) > .9 else v
                    return t[:uv] + (v[0] / tile, (v[2] + v[1]) / tile) + t[uv+2:]
                vertices = [ground_vertex(v) for v in vertices]
            normal_offset = 3 if attributes[1][0] == 'NORMAL' else None
            remaining, brick, local_booth = [], [], []
            for at in range(0, len(indices), 3):
                tri = [vertices[i] for i in indices[at:at + 3]]
                if key.startswith('04_'):
                    x, z = (sum(v[j] for v in tri)/3 for j in (0,2))
                    # This generated tree is rooted on the surveyed east pedestrian apron.
                    if math.hypot(x-1054.59,z-126.30)<1.05:
                        continue
                if key.startswith('01_') and teaching55.is_55(tri):
                    if name == 'RoofingTiles010':
                        for roof in teaching55.roof_sections(tri,clip):
                            self.add_collision('buildings',roof)
                            self.teaching_55_roofs.append(roof)
                    continue
                is_teaching = key.startswith('01_') and on_44(tri)
                is_booth = key.startswith('01_') and all(BREAKABLE[0] <= v[0] <= BREAKABLE[2] and BREAKABLE[1] <= v[2] <= BREAKABLE[3] for v in tri)
                if is_teaching:
                    self.teaching_positions.extend(v[:3] for v in tri)
                for t in clip(tri, CROP):
                    area = projected_area(t)
                    if key.startswith('01_') and name == 'RoofingTiles010':
                        self.add_collision('breakable' if is_booth else 'buildings', t)
                    elif key.startswith('02_') and name not in ('road_marking_dash',) and area > 1e-4 and min(v[1] for v in t) > -.12:
                        self.add_collision('roads', t)
                    elif key.startswith('03_') and name == 'WATER':
                        self.add_collision('water', t)
                    elif key.startswith('05_') and area > 1e-4:
                        self.add_collision('terrain', t)
                    opening=self.passage
                    cuts=key.startswith('01_') and name!='RoofingTiles010' and (
                        min(v[0] for v in t)<opening['x1'] and max(v[0] for v in t)>opening['x0'] and
                        min(v[2] for v in t)<opening['z1'] and max(v[2] for v in t)>opening['z0'] and
                        min(v[1] for v in t)<opening['ceiling'])
                    for t in carve_passage(t,opening) if cuts else (t,):
                        if key.startswith('01_') and name == 'Windows':
                            self.original_windows.append(tuple(sum(v[j] for v in t)/3 for j in range(3)))
                        if name == 'Plaster002' and normal_offset is not None and abs(t[0][4]) < .2:
                            n = normalize(t[0][3], 0, t[0][5])
                            textured = tuple(brick_vertex(v, attributes, n, 2.5 if is_teaching else 1.8) for v in t)
                            if is_booth:
                                local_booth.append(textured)
                            elif is_teaching:
                                brick.append(textured)
                            elif key.startswith('01_') and attributes == SURFACE_ATTRS:
                                x,z = (sum(v[j] for v in t)/3 for j in (0,2))
                                # The athletics-facing wall stays in concrete, as does
                                # the metro edge. Other campus walls use the brick kit.
                                concrete = (683<x<757 and -627<z<-492 and n[0]>.65) or z>540 and x<-155
                                if concrete:
                                    remaining.append(textured)
                                else:
                                    self.campus_brick.append(textured)
                                    if not (680<x<755 and -650<z<-488):
                                        self.record_wall(t,n)
                            else:
                                remaining.append(textured)
                        elif is_booth:
                            local_booth.append(t)
                        else:
                            remaining.append(t)
            if remaining:
                primitives.append(self.add_primitive(remaining, attributes, replacement or material_index))
            if brick:
                primitives.append(self.add_primitive(brick, attributes, 'brick-44'))
            if local_booth:
                booth.append(self.add_primitive(local_booth,attributes,material_index))
        if primitives:
            self.mesh_node(key,primitives)
        if booth:
            self.mesh_node('OSM-East-Kiosk-528929232',booth)

    def mesh_node(self,name,primitives):
        self.out['nodes'].append({'name':name,'mesh':len(self.out['meshes'])})
        self.out['meshes'].append({'name':name,'primitives':primitives})

    def plane(self, outline, material, y):
        triangles=self.overlays.setdefault(material,[])
        for tri in triangulate(outline):
            points=tuple((x,y,z) for x,z in tri)
            triangles.append(tuple((x,h,z,0,1,0,1,0,0,-1,x/2,z/2,1,1,1,1) for x,h,z in points))

    def line(self,a,b,width,y=.209):
        x,z=a; dx,dz=b[0]-x,b[1]-z
        length=math.hypot(dx,dz)
        if length < .01:return
        nx,nz=-dz*width/2/length,dx*width/2/length
        self.plane([(x+nx,z+nz),(b[0]+nx,b[1]+nz),(b[0]-nx,b[1]-nz),(x-nx,z-nz)],'court-line',y)

    def loop(self,points,width,y=.209):
        for a,b in zip(points,points[1:]+points[:1]):self.line(a,b,width,y)

    def parking(self,feature):
        points=feature['points'][:-1]
        self.plane(points,'parking-asphalt',.14)
        self.loop(points,.12,.155)
        longest=max(zip(points,points[1:]+points[:1]),key=lambda p:math.dist(*p))
        a,b=longest; length=math.dist(a,b)
        ux,uz=(b[0]-a[0])/length,(b[1]-a[1])/length
        vx,vz=-uz,ux
        center=tuple(sum(q[i] for q in points)/len(points) for i in (0,1))
        if (center[0]-a[0])*vx+(center[1]-a[1])*vz<0: vx,vz=-vx,-vz
        lot_count=0
        for row in (1.7,13,25.5):
            for stall in range(max(0,int((length-4)/2.65))):
                u=2.5+stall*2.65
                project=lambda t,v:(a[0]+ux*t+vx*v,a[1]+uz*t+vz*v)
                corners=[project(u+du,row+dv) for du,dv in ((0,0),(2.64,0),(2.64,5),(0,5))]
                if not all(inside(p,points) for p in corners):continue
                self.line(corners[0],corners[3],.085,.155)
                self.line(corners[0],corners[1],.085,.155)
                if stall%7==3 and lot_count<4 and feature['id'] in {'528929230','528929236','528985516','918137140','528988921','528929241'}:
                    x,z=project(u+1.33,row+2.65)
                    self.lots.append({'id':f"p-{feature['id']}-{lot_count}",'x':round(x,2),'z':round(z,2),'yaw':round(math.atan2(vx,vz),5)})
                    lot_count+=1

    def pitch(self,p):
        a,b,c,d=p[:4]
        def at(u,v):
            return tuple((a[i]*(1-v)+b[i]*v)*(1-u)+(d[i]*(1-v)+c[i]*v)*u for i in (0,1))
        for k in range(12):
            self.plane([at(0,k/12),at(1,k/12),at(1,(k+1)/12),at(0,(k+1)/12)],'turf-dark' if k%2 else 'turf-light',.20)
        self.loop([at(.015,.015),at(.985,.015),at(.985,.985),at(.015,.985)],.14)
        self.line(at(.015,.5),at(.985,.5),.14)
        center=at(.5,.5)
        self.loop([(center[0]+9.15*math.cos(i*math.tau/52),center[1]+9.15*math.sin(i*math.tau/52)) for i in range(52)],.14)
        for end in (0,1):
            inner=.15 if end==0 else .85
            self.loop([at(.20,end+.015*(1-2*end)),at(.80,end+.015*(1-2*end)),at(.80,inner),at(.20,inner)],.14)

    def add_grounds(self,survey):
        for f in survey:
            kind,p=f['kind'],f['points'][:-1]
            if len(p)<3:continue
            if kind=='parking':self.parking(f)
            elif kind=='running':
                self.plane(p,'running-rubber',.18)
                center=tuple(sum(v[i] for v in p)/len(p) for i in (0,1))
                for lane in range(9):
                    inset=.42+lane*1.22
                    points=[tuple(v[i]+(center[i]-v[i])*inset/math.dist(v,center) for i in (0,1)) for v in p]
                    self.loop(points,.075,.192)
            elif kind=='soccer':self.pitch(p)
            elif kind in ('basketball','volleyball','tennis','badminton'):
                self.plane(p,'court-painted',.20)
                center=tuple(sum(v[i] for v in p)/len(p) for i in (0,1))
                border=[tuple(v[i]+(center[i]-v[i])*.04 for i in (0,1)) for v in p]
                self.loop(border,.075)
                if len(p)==4:
                    m=lambda a,b:tuple((u+v)/2 for u,v in zip(a,b))
                    self.line(m(border[0],border[1]),m(border[2],border[3]),.075)
        self.mesh_node('OSM-Parking-and-Sports-Details',[self.add_primitive(t,SURFACE_ATTRS,m) for m,t in self.overlays.items()])

    def add_teaching_55(self):
        if not self.teaching_55_roofs:
            raise ValueError('55 teaching building was not found in the supplied coordinates')
        source_materials = {m['name']: i for i,m in enumerate(self.source['materials'])}
        paving, tint = teaching55.MATERIALS[teaching55.STONE]
        facades = teaching55.Model().build()
        for outline in teaching55.courtyard_paving():
            for tri in triangulate(outline):
                vertices = [(x,.065,z) for x,z in tri]
                self.add_collision('paving',vertices)
                facades[paving].append(tuple((x,y,z,0,1,0,1,0,0,-1,x/1.8,z/1.8,*tint,1)
                                                       for x,y,z in vertices))
        primitives = [self.add_primitive(self.teaching_55_roofs,SURFACE_ATTRS,source_materials['RoofingTiles010'])]
        primitives.extend(self.add_primitive(tris,SURFACE_ATTRS,source_materials.get(material,material))
                          for material,tris in facades.items())
        self.mesh_node('OSM-Teaching-55-528933946',primitives)

    def save(self, directory, metadata):
        self.buffer.extend(bytes(-len(self.buffer) % 4))
        self.out['extras'] = metadata
        self.out['scenes'] = [{'name': 'Beiyang-OSM-Campus', 'nodes': list(range(len(self.out['nodes'])))}]
        self.out['buffers'] = [{'byteLength': len(self.buffer)}]
        data = json.dumps(self.out, separators=(',', ':')).encode('utf-8')
        data += b' ' * (-len(data) % 4)
        header = struct.pack('<5I', 0x46546C67, 2, 28 + len(data) + len(self.buffer), len(data), 0x4E4F534A)
        (directory / 'beiyang-campus.glb').write_bytes(header + data + struct.pack('<II', len(self.buffer), 0x004E4942) + self.buffer)
        # The model and layout are sibling build inputs derived from one source.
        with (directory / 'layout.json').open('w', encoding='utf-8') as f:
            json.dump({**metadata, **self.collision}, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('glb', type=Path)
    cli.add_argument('output', type=Path, nargs='?', default=Path('assets/osm-campus'))
    cli.add_argument('--materials', dest='material_dir', type=Path, default=Path('.assetlib/downloads/osm-campus'))
    args = cli.parse_args()
    source, blob, source_hash = read_glb(args.glb)
    extras = source['extras']
    if extras.get('units') != 'meters' or extras.get('axes') != 'X east, Y up, -Z north':
        raise ValueError('Input must use the attachment’s local metre coordinates')
    passage = json.loads((args.output/'passages.json').read_text())['mainWest']
    pilot = Campus(source, blob, args.material_dir, passage)
    for node in source['nodes']:
        pilot.add_node(node)
    if not pilot.teaching_positions or 'brick-44' not in pilot.material_ids:
        raise ValueError('44 teaching building was not found in the supplied coordinates')
    coords = list(zip(*pilot.teaching_positions))
    extent = [round(max(axis) - min(axis), 2) for axis in coords]
    metadata = {'placeId': 'tju-beiyang-teaching-44', 'sourceSha256': source_hash, 'sourceDate': extras['sourceDate'],
                'wgs84Origin': [extras['originWgs84Longitude'], extras['originWgs84Latitude']],
                'bounds': PLAY, 'extent': extent, 'axes': extras['axes'], 'units': 'meters', 'brickSource': BRICK_SOURCE}
    pilot.add_grounds(json.loads((args.output / 'survey.json').read_text()))
    pilot.refine_surfaces()
    pilot.add_facade_details()
    pilot.add_teaching_55()

    metadata['parkingCars'] = pilot.lots
    args.output.mkdir(parents=True, exist_ok=True)
    pilot.save(args.output, metadata)
    print(metadata)
    print({key: len(triangles) for key, triangles in pilot.collision.items()})


if __name__ == '__main__':
    main()
