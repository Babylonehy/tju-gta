#!/usr/bin/env python3
"""Project OSM building names onto the roof geometry of the supplied campus model."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path('assets/osm-campus')
EARTH = 6371000
LAT = math.radians(38.9969)
LON = math.radians(117.3058)
SCALE = EARTH * math.cos(LAT)

# Names confirmed by the campus guide, the campus teaching-building atlas, or
# the Chinese names on the supplied map. Other entries use the OSM feature name.
# Keep the 55 教 pin over the main bar when its roof is split at the wing junctions.
LABEL_ANCHORS = {'w528933946': (172.60, -254.42)}

ALIASES = {
    '528908365': '第四十四教学楼',
    '528927157': '第三十二教学楼（主楼）',
    '528911747': '静算楼（第四十七教学楼）',
    '528911746': '第四十八实验楼',
    '528911745': '第四十九教学楼',
    '528929257': '综合体育馆',
    '528910355': '第三学生食堂',
    '528910364': '第二学生食堂',
    '528934968': '第一学生食堂',
    '528910351': '第五学生食堂',
    '528929232': '东门北侧治安岗亭',
    '528929233': '东门南侧治安岗亭',
    '529121309': '水利馆（第四十二教学楼）',
}

def tags(element):
    return {row.attrib['k']: row.attrib['v'] for row in element.findall('tag')}

def local(node):
    lat, lon = (math.radians(float(node.attrib[key])) for key in ('lat', 'lon'))
    return ((lon - LON) * SCALE, (math.asinh(math.tan(LAT)) - math.asinh(math.tan(lat))) * SCALE)

def building_name(osm_id, properties):
    name = ALIASES.get(osm_id) or properties.get('name:zh') or properties.get('name')
    if not name:
        return None
    if match := re.fullmatch(r'No\.(\d+) Teaching Building', name):
        return f'第 {match[1]} 教学楼'
    if match := re.fullmatch(r'Students? Apartment No\.(\d+) \((\w+)\)', name):
        gardens = {'Zhengyuan': '正园', 'Chengyuan': '诚园', 'Zhiyuan': '智园', 'Geyuan': '格园', 'Qiyuan': '齐园', 'Pingyuan': '平园'}
        if match[2] in gardens:
            return f'{gardens[match[2]]}{match[1]}斋'
    return name

def rings(paths):
    unused = list(paths)
    while unused:
        ring = unused.pop()
        while ring[0] != ring[-1]:
            for i, candidate in enumerate(unused):
                if candidate[0] == ring[-1] or candidate[-1] == ring[-1]:
                    path = unused.pop(i)
                    ring += (path if path[0] == ring[-1] else path[::-1])[1:]
                    break
            else:
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            yield ring

def covers(point, ring):
    x, z = point
    return sum((az > z) != (bz > z) and x < ax + (bx-ax)*(z-az)/(bz-az)
               for (ax,az),(bx,bz) in zip(ring, ring[1:])) % 2 == 1

def read_osm(path):
    root = ET.parse(path).getroot()
    nodes = {e.get('id'): local(e) for e in root.findall('node')}
    ways = {e.get('id'): (tags(e), [nd.get('ref') for nd in e.findall('nd')])
            for e in root.findall('way')}
    used = set()
    for e in root.findall('relation'):
        t = tags(e)
        if 'building' not in t:
            continue
        outer, inner = [], []
        for m in e.findall('member'):
            ref, role = m.get('ref'), m.get('role')
            if m.get('type') == 'way' and ref in ways and role in ('outer','inner',''):
                (inner if role == 'inner' else outer).append(ways[ref][1])
                used.add(ref)
        for part,ring in enumerate(rings(outer),1):
            if all(key in nodes for key in ring):
                holes = [[nodes[key] for key in hole] for hole in rings(inner) if all(key in nodes for key in hole)]
                yield f"r{e.get('id')}-{part}", building_name(e.get('id'), t), [nodes[key] for key in ring], holes
    for key,(t,path) in ways.items():
        if key not in used and 'building' in t and len(path) >= 4 and path[0] == path[-1] and all(n in nodes for n in path):
            yield 'w' + key, building_name(key, t), [nodes[n] for n in path], []

def centroid(triangle):
    return tuple(sum(v)/3 for v in zip(*triangle))

def buildings(osm, layout):
    roofs = [tuple(zip(t[0::3], t[1::3], t[2::3])) for t in layout['buildings'] + layout['breakable']]
    centers = [centroid(roof) for roof in roofs]
    used = set()
    result = []
    for key,name,ring,holes in read_osm(osm):
        x0,z0 = map(min, zip(*ring))
        x1,z1 = map(max, zip(*ring))
        matches = [i for i,(x,_,z) in enumerate(centers) if x0 <= x <= x1 and z0 <= z <= z1
                   and covers((x,z), ring) and not any(covers((x,z), h) for h in holes)]
        if not matches:
            continue
        used.update(matches)
        cx,cz = (x0+x1)/2,(z0+z1)/2
        x,y,z = min((centers[i] for i in matches), key=lambda p: math.hypot(p[0]-cx,p[2]-cz))
        if key in LABEL_ANCHORS:
            anchor = LABEL_ANCHORS[key]
            heights = [centers[i][1] for i in matches
                       if covers(anchor, [(a,c) for a,_,c in (*roofs[i],roofs[i][0])])]
            if heights:
                x, z = anchor
                y = max(heights)
        result.append((key,name,x,y,z))
    # Keep roof groups missing from the OSM snapshot discoverable as well.
    neighbors = defaultdict(set)
    for i,triangle in enumerate(roofs):
        for x,_,z in triangle:
            neighbors[(x,z)].add(i)
    pending = set(range(len(roofs)))
    unmatched = []
    while pending:
        component = [min(pending)]
        pending.remove(component[0])
        for i in component:
            for x,_,z in roofs[i]:
                for n in neighbors[(x,z)] & pending:
                    pending.remove(n)
                    component.append(n)
        if not used.intersection(component):
            unmatched.append(max((centers[i] for i in component), key=lambda p: p[1]))
    for i,(x,y,z) in enumerate(sorted(unmatched),1):
        result.append((f'm{i:03}',None,x,y,z))
    return [{'id':key,'name':name,'x':round(x,2),'z':round(z,2),'y':round(y,2)}
            for key,name,x,y,z in sorted(result, key=lambda row: (row[1] is None,row[1] or '',row[0]))]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('osm', type=Path)
    args = parser.parse_args()
    records = buildings(args.osm, json.loads((ROOT/'layout.json').read_text()))
    (ROOT/'buildings.json').write_text(json.dumps(records, ensure_ascii=False, separators=(',',':')) + '\n')
    print(f'{len(records)} roof labels, {sum(bool(r["name"]) for r in records)} sourced names')

if __name__ == '__main__':
    main()
