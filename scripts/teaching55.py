"""Rebuild the 55 teaching building on its OSM2World outline, using the south facade photo."""
from collections import defaultdict
import math

# Corners from the facade vertices of OSM way 528933946 in the supplied campus GLB.
OUTLINE = (
    (91.568, -262.652), (90.988, -192.852), (118.318, -192.630), (118.708, -239.719),
    (207.827, -238.984), (207.455, -193.242), (232.233, -193.041), (232.795, -261.494),
)
MAIN_HEIGHT = 20.8
WING_HEIGHT = 12.5
BRICK = '55-brick'
DARK_BRICK = '55-brick-shade'
STONE = '55-pavers'
METAL = '55-mullion'
GLASS = ('55-glass-blue', '55-glass-green', '55-glass-light')

# The four physical materials already exist in the campus GLB. Per-vertex tint
# and UV subregions distinguish trim, tinted panes and the shaded brick reveals.
MATERIALS = {
    BRICK: ('brick-44', (1,1,.97)),
    DARK_BRICK: ('brick-44', (.68,.61,.56)),
    STONE: ('Plaster002', (1,.96,.88)),
    METAL: ('STEEL', (.18,.21,.21)),
    GLASS[0]: ('Windows', (.81,.93,1)),
    GLASS[1]: ('Windows', (.94,1,.80)),
    GLASS[2]: ('Windows', (1,1,.94)),
}

OX, OZ = tuple((a+b)*.5 for a, b in zip(OUTLINE[3], OUTLINE[4]))
ANGLE = math.atan2(OUTLINE[4][1]-OUTLINE[3][1], OUTLINE[4][0]-OUTLINE[3][0])
COS, SIN = math.cos(ANGLE), math.sin(ANGLE)


def world(u, v):
    return OX+u*COS-v*SIN, OZ+u*SIN+v*COS


def local(p):
    x, z = p[0]-OX, p[1]-OZ
    return x*COS+z*SIN, z*COS-x*SIN


def is_55(triangle):
    return all(90.7 < x < 233 and -263 < z < -192.4 for x, _, z, *_ in triangle)


def roof_sections(triangle, clip):
    """Partition the original roof along the courtyard edge without moving the footprint."""
    vertices = []
    for x, y, z, *tail in triangle:
        u, v = local((x, z))
        vertices.append((u, y, v, *tail))
    for v0, v1, height in [(-100, 0, MAIN_HEIGHT), (0, 100, WING_HEIGHT)]:
        for clipped in clip(vertices, (-100, v0, 100, v1)):
            yield tuple((x, height, z, *tail) for u, _, v, *tail in clipped for x,z in [world(u,v)])


def split_at_court(a, b):
    v0, v1 = local(a)[1], local(b)[1]
    k = -v0/(v1-v0)
    return tuple(x+(y-x)*k for x, y in zip(a, b))


class Model:
    def __init__(self):
        self.parts = defaultdict(list)

    def quad(self, material, corners, tile=1.8):
        a, b, c, _ = corners
        t = tuple(y-x for x, y in zip(a, b))
        v = tuple(y-x for x, y in zip(a, c))
        n = (t[1]*v[2]-t[2]*v[1], t[2]*v[0]-t[0]*v[2], t[0]*v[1]-t[1]*v[0])
        length = math.hypot(*n)
        if length < 1e-6:
            return
        normal = tuple(x/length for x in n)
        tangent = tuple(x/math.hypot(*t) for x in t)
        bitangent = (normal[1]*tangent[2]-normal[2]*tangent[1],
                     normal[2]*tangent[0]-normal[0]*tangent[2],
                     normal[0]*tangent[1]-normal[1]*tangent[0])
        surface, tint = MATERIALS[material]
        if material in GLASS:
            # Opaque blue-green area of the existing window atlas, inset from
            # its masked border and the white central mullion.
            uvs = [(.351,.64),(.463,.64),(.463,.35),(.351,.35)]
        else:
            uvs = [(sum(x*y for x,y in zip(p,tangent))/tile,
                    sum(x*y for x,y in zip(p,bitangent))/tile) for p in corners]
        verts = [(*p, *normal, *tangent, 1, *uv, *tint, 1) for p,uv in zip(corners,uvs)]
        self.parts[surface].extend((tuple(verts[i] for i in (0,1,2)), tuple(verts[i] for i in (0,2,3))))

    def facade(self, a, b):
        length = math.dist(a, b)
        tx, tz = ((q-p)/length for p, q in zip(a, b))

        def point(x, y, d):
            return a[0]+tx*x-tz*d, y, a[1]+tz*x+tx*d

        def panel(material, left, right, low, high, d=0):
            if right-left > .01 and high-low > .01:
                self.quad(material, [point(left,low,d),point(right,low,d),point(right,high,d),point(left,high,d)])
        return point, panel

    def reveal(self, face, left, right, low, high, depth):
        point, _ = face
        a,b,c,d = [point(x,y,0) for x,y in [(left,low),(right,low),(right,high),(left,high)]]
        e,f,g,h = [point(x,y,-depth) for x,y in [(left,low),(right,low),(right,high),(left,high)]]
        for material, corners in [(STONE,[a,b,f,e]), (DARK_BRICK,[b,c,g,f]), (DARK_BRICK,[c,d,h,g]), (DARK_BRICK,[d,a,e,h])]:
            self.quad(material, corners)

    def recess(self, face, left, right, low, high, depth, glazing):
        _, panel = face
        panel(glazing, left, right, low, high, -depth)
        self.reveal(face, left, right, low, high, depth)
        panel(METAL, left, left+.055, low, high, -depth+.013)
        panel(METAL, right-.055, right, low, high, -depth+.013)
        panel(STONE, left, right, low, low+.13, -depth+.018)
        panel(METAL, left, right, low+(high-low)*.61, low+(high-low)*.61+.055, -depth+.018)

    def window_rows(self, face, left, right, bottom, top, count, rows):
        point, panel = face
        previous = bottom
        bay = (right-left)/count
        for i, (low, high) in enumerate(rows):
            panel(BRICK, left, right, previous, low)
            edge = left
            for j in range(count):
                center = left+(j+.5)*bay
                half = bay*(.28 if (i+j)%4 else .25)
                a,b = center-half,center+half
                panel(BRICK, edge, a, low, high)
                self.recess(face, a, b, low, high, .34+(j%3)*.035, GLASS[(j*3+i+j//3)%3])
                # Perpendicular brick blades cast the diagonal shadows visible in the reference.
                if j%4 != 2:
                    self.quad(DARK_BRICK, [point(b,low,0),point(b+.22,low,.24),point(b+.22,high,.24),point(b,high,0)])
                edge=b
            panel(BRICK, edge, right, low, high)
            previous=high
        panel(BRICK, left, right, previous, top)

    def ribs(self, face, left, right, bottom, top):
        point, panel = face
        panel(DARK_BRICK,left,right,bottom,top)
        for i in range(max(0, math.floor((top-bottom)/.48))):
            y=bottom+i*.48+.13
            panel(BRICK,left,right,y,y+.22,.14)
            self.quad(BRICK,[point(left,y+.22,.14),point(right,y+.22,.14),point(right,y+.22,0),point(left,y+.22,0)])

    def curtain(self, face, left, right, top):
        _, panel = face
        cols, rows, base = 24, 9, .065
        self.reveal(face, left, right, base, top, .99)
        for i in range(cols):
            a,b = left+(right-left)*i/cols,left+(right-left)*(i+1)/cols
            for j in range(rows):
                y0,y1 = base+(top-base)*j/rows,base+(top-base)*(j+1)/rows
                color = GLASS[(i//4+j//3+(i*j%7==0))%3]
                panel(color,a,b,y0,y1,-.99)
                panel(METAL,a,a+.063,y0,y1,-.974)
                panel(METAL,a,b,y0,y0+(.15 if j in (2,5,8) else .06),-.974)
        panel(METAL,right-.075,right,base,top,-.974)
        for x in (left+1.3, right-1.6):
            panel(STONE,x,x+.33,base,top,-.91)
        # Double glazed doors and transom in the center of the atrium.
        middle=(left+right)/2
        panel(METAL,middle-5.1,middle+5.1,2.88,3.05,-.90)
        for i in range(7):
            x=middle-4.85+i*1.61
            panel(METAL,x,x+.085,base,2.97,-.90)

    def gallery(self, face, left, right):
        point, panel = face
        depth, high = .67, 3.48
        self.reveal(face,left,right,.065,high,depth)
        span = right-left
        count = max(1,round(span/3.55))
        for i in range(count):
            a,b = left+span*i/count,left+span*(i+1)/count
            panel(GLASS[i%3],a,b,.065,high,-depth)
            panel(METAL,a,a+.055,.065,high,-depth+.013)
            panel(METAL,a,b,1.92,1.99,-depth+.013)
            x = a+.44
            panel(STONE,x,x+.47,.065,high,.025)
            self.quad(STONE,[point(x,.065,-depth),point(x,.065,.025),point(x,high,.025),point(x,high,-depth)])
            self.quad(STONE,[point(x+.47,.065,.025),point(x+.47,.065,-depth),point(x+.47,high,-depth),point(x+.47,high,.025)])

    def build(self):
        nw,sw,iw,back_w,back_e,ie,se,ne = OUTLINE
        west,east = split_at_court(nw,sw),split_at_court(ne,se)
        wing_rows=[(.55,3.15),(4.62,6.65),(7.74,9.80)]
        main_rows=[(.52,3.48),(4.93,7.05),(8.28,10.37),(11.62,13.74),(14.88,17.04)]
        # Six existing faces on the two wings and three on the main bar.
        edges=[(west,sw),(sw,iw),(iw,back_w),(back_e,ie),(ie,se),(se,east)]
        for a,b in edges:
            span=math.dist(a,b)
            face=self.facade(a,b)
            if (a,b) in ((sw,iw),(ie,se)):
                left = 1.15 if a==sw else 2.6
                right = left+5.2
                self.ribs(face,left,right,.26,WING_HEIGHT)
                for lo,hi in [(0,left),(right,span)]:
                    self.window_rows(face,lo,hi,0,WING_HEIGHT,max(1,round((hi-lo)/3.65)),wing_rows)
            else:
                self.window_rows(face,0,span,0,WING_HEIGHT,round(span/3.65),wing_rows)
        for a,b in [(nw,west),(east,ne),(ne,nw)]:
            span=math.dist(a,b)
            self.window_rows(self.facade(a,b),0,span,0,MAIN_HEIGHT,round(span/3.55),main_rows)

        face = self.facade(west,east)
        _,panel = face
        span = math.dist(west,east)
        middle=math.dist(west,back_w)+math.dist(back_w,back_e)*.5
        courtyard_left,courtyard_right=middle-math.dist(back_w,back_e)/2,middle+math.dist(back_w,back_e)/2
        atrium_left,atrium_right=middle-16,middle+16
        for l,r,base in [(0,7.6,WING_HEIGHT),(span-7.6,span,WING_HEIGHT)]:
            self.ribs(face,l,r,base,MAIN_HEIGHT)
        for l,r,base in [(7.6,courtyard_left,WING_HEIGHT),(courtyard_right,span-7.6,WING_HEIGHT),
                         (courtyard_left,atrium_left,0),(atrium_right,courtyard_right,0)]:
            if base == 0:
                self.gallery(face,l,r)
                base = 3.48
            rows=[row for row in main_rows if row[0]>=base]
            self.window_rows(face,l,r,base,17.80,max(1,round((r-l)/3.45)),rows)
        panel(BRICK,atrium_left,atrium_right,14.2,14.6)
        self.curtain(face,atrium_left,atrium_right,14.2)
        self.window_rows(face,atrium_left,atrium_right,14.6,17.8,9,main_rows[-1:])
        # Setback terrace with a continuous red-brick cap and exposed stone uprights.
        panel(DARK_BRICK,7.6,span-7.6,17.80,20.8,-1.45)
        self.reveal(face,7.6,span-7.6,17.94,19.72,1.45)
        panel(BRICK,7.6,span-7.6,19.72,20.8)
        panel(BRICK,7.6,span-7.6,17.80,17.94)
        for i in range(24):
            x=8.15+(span-16.3)*(i+.5)/24
            panel(STONE,x,x+.32,17.94,19.51,-.34)
        return self.parts


def courtyard_paving():
    rectangles = [
        (-42,42,0.15,5.5), (-4,4,5.5,48), (-41,-37,5.5,41), (37,41,5.5,41),
        (-37,-4,21.7,24.7), (4,37,21.7,24.7), (-37,-4,36.5,40.5), (4,37,36.5,40.5),
        (-26,-20,5.5,36.5), (20,26,5.5,36.5), (-37,-26,7,16), (26,37,7,16),
    ]
    for u0,u1,v0,v1 in rectangles:
        yield [world(u0,v0),world(u1,v0),world(u1,v1),world(u0,v1)]
