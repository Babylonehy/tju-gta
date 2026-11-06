import { mat4, quat } from '@forgeax/engine/math';
import { definePack } from '@forgeax/engine/pack/source';
import { ANTIALIAS_FXAA, Camera, DirectionalLight, Instances, PointLight, MeshFilter, MeshRenderer, perspective, SKYBOX_MODE_CUBEMAP, SkyboxBackground, Skylight, TONEMAP_ACES_FILMIC } from '@forgeax/engine/render';
import { ChildOf, Name, Transform } from '@forgeax/engine/scene';
import { ok, type SceneAsset, type SceneEntity } from '@forgeax/engine/types';
import { DOCKS, EAST_GATE, FOOT_GATE, GATE_LANES, GATE_PEDESTALS, GATE_VEHICLES, gateRoadZ, PARCELS, SECRETS, SPAWN } from './atlas.ts';
import { COURTYARD, diggable, MAIN_PASSAGE, PARKED } from '../osm-campus/layout.ts';
import { TARGETS } from './life.ts';
import { cameraPose, cameraTargetY, FOV, groundHeight, START } from './explore.ts';
import { DAYLIGHT, GEOMETRY, SCENE, SCENE_KEY, guid } from './ids.ts';
import { materialPath, type Color, type Shape } from './geometry.pack.ts';
import { TRAFFIC, trafficPose } from './traffic.ts';
import { aroundX, buildCar } from './actors.ts';
import { BIRDS, birdPose, CROWD_PARTS, GRASS_PARTS } from './ambient.ts';
import { CENTURY_STONES, HALL_SIGN, PAVILION, PLAZA } from './landmarks.ts';

type Triple = readonly [number, number, number];
type Rotation = readonly [number, number, number, number];
const yaw = (r: number): Rotation => [0, Math.sin(r / 2), 0, Math.cos(r / 2)];
const roll = (r: number): Rotation => [0, 0, Math.sin(r / 2), Math.cos(r / 2)];
const TORSION = Math.PI * 2;
const MESH = new Map<string, string>();
const MATERIAL = new Map<string, string>();
function meshKey(key: string) { let id = MESH.get(key); if (!id) { id = guid(GEOMETRY, 'mesh/' + key); MESH.set(key, id); } return id; }
function materialKey(key: string) { let id = MATERIAL.get(key); if (!id) { id = guid(GEOMETRY, materialPath(key)); MATERIAL.set(key, id); } return id; }

type PartTransform = { pos: Triple; scale: Triple; quat: Rotation };
type PartBatch = { shape: Shape; color: Color; parent?: string; parts: PartTransform[] };
const PROP_CELL_SIZE = 36;

export function makeCampus(): SceneAsset {
  const entities: Record<string, SceneEntity> = {};
  const partBatches = new Map<string, PartBatch>();
  const addMesh = (key: string, shape: Shape, color: Color, transform: SceneEntity['components']['Transform'], parent?: string, transforms?: number[]) => {
    entities[key] = { components: {
      Transform: transform,
      MeshFilter: { assetHandle: meshKey(shape) },
      MeshRenderer: { materials: [materialKey(color)] },
      ...(parent ? { ChildOf: { parent } } : {}),
      ...(transforms ? { Instances: { transforms } } : {}),
    } };
  };
  const part = (shape: Shape, color: Color, pos: Triple, scale: Triple, rotation: Rotation = [0,0,0,1], key?: string, parent?: string) => {
    const transform = { pos, scale, quat: rotation };
    if (key) {
      addMesh(key, shape, color, transform, parent);
      return;
    }
    // Children retain the original moving parent. Fixed parts use small cells
    // so distant props do not share one campus-wide visibility bound.
    const scope = parent ? 'parent-' + parent : 'cell-' + Math.floor(pos[0] / PROP_CELL_SIZE) + '-' + Math.floor(pos[2] / PROP_CELL_SIZE);
    const batchKey = 'props-' + scope + '-' + shape + '-' + color;
    const batch = partBatches.get(batchKey);
    if (batch) batch.parts.push(transform);
    else partBatches.set(batchKey, { shape, color, parent, parts: [transform] });
  };
  const box = (color: Color, x: number, y: number, z: number, w: number, h: number, d: number, r = 0) => part('box', color, [x,y,z], [w,h,d], yaw(r));
  const cyl = (color: Color, x: number, y: number, z: number, w: number, h: number, d = w) => part('cyl', color, [x,y,z], [w,h,d]);
  const node = (key: string, pos: Triple, parent?: string) => { entities[key] = { components: {
    Name: { value: key }, Transform: { pos }, ...(parent ? { ChildOf: { parent } } : {}),
  } }; };

  function vehicle(parent:string,color:Color,power:boolean) {
    const draw=(shape:Shape,mat:Color,p:Triple,s:Triple,r?:Rotation)=>part(shape,mat,p,s,r,undefined,parent);
    const tube=(a:Triple,b:Triple,w:number,mat:Color)=>{
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz);
      const along=dy/len, half=Math.sqrt(Math.max(0,(1+along)/2));
      const r:Rotation=half<1e-7?[1,0,0,0]:[dz/(2*len*half),0,-dx/(2*len*half),half];
      draw('cyl',mat,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[w,len,w],r);
    };
    const axle=power?.32:.38, stem:Triple=[0,.81,.47], seat:Triple=[0,.76,-.26], crank:Triple=[0,.39,.025];
    const rim=power?.72:.85;
    for (const z of [-.89,.89]) {
      draw('torus','softRubber',[0,axle,z],[rim,rim,power?1.28:.82],yaw(Math.PI/2));
      draw('torus','silver',[0,axle,z],[rim*.84,rim*.84,.39],yaw(Math.PI/2));
      tube([-.088,axle,z],[.088,axle,z],power?.23:.105,'ink');
      for(let j=0;j<10;j++){
        const a=j*TORSION/10,r=power?.269:.334;
        tube([j%2?.035:-.035,axle,z],[0,axle+r*Math.sin(a),z+r*Math.cos(a)],power?.017:.011,'stainless');
      }
      // Narrow fender segments wrap the real tire curve.
      const arc=power?.349:.402;
      for(let j=-3;j<=3;j++){
        const a=j*.29;
        draw('bevel',power?color:'ink',[0,axle+arc*Math.cos(a),z+arc*Math.sin(a)],
          [power?.154:.112,.035,.128],aroundX(-a));
      }
    }
    for(const side of [-1,1]){
      const x=side*(power?.092:.067);
      tube([x,axle,-.89],[x,.755,-.26],power?.074:.045,color);
      tube([x,axle,-.89],[x,.395,.025],power?.073:.051,color);
      tube([x,axle,.89],[x,.785,.49],power?.079:.052,color);
      tube([side*.22,.988,.53],[side*.354,.988,.53],.067,'softRubber');
      draw('bevel','stainless',[side*.267,.954,.569],[.119,.028,.065]);
      draw('bevel','reflective',[side*.063,.54,-.87],[.013,.050,.085]);
    }
    tube(seat,[0,.836,-.27],.059,'chrome');
    draw('bevel','softRubber',[0,.858,-.266],[power?.254:.213,.073,power?.384:.30]);
    tube(stem,[0,.988,.53],.061,'chrome');
    tube([-.30,.988,.53],[.30,.988,.53],.040,'stainless');
    draw('bevel','ink',[0,.991,.574],[.125,.041,.102]);
    draw('bevel','reflective',[0,1.015,.575],[.079,.004,.061]);
    draw('bevel','headlight',[0,.825,.621],[power?.163:.114,.082,.072]);
    draw('bevel','tail',[0,power?.61:.697,-1.073],[.135,.058,.031]);
    if(power){
      // Low step-through chassis, removable battery and integrated foot deck.
      tube([0,.39,-.24],[0,.42,.26],.19,color);
      tube([0,.42,.26],stem,.145,color);
      draw('bevel',color,[0,.583,-.45],[.291,.362,.64],aroundX(-.19));
      draw('bevel','ink',[0,.535,-.197],[.179,.236,.37],aroundX(.31));
      draw('bevel','ink',[0,.418,.158],[.34,.052,.53]);
      for(let j=0;j<5;j++)draw('box','softRubber',[0,.451,-.04+j*.093],[.29,.012,.028]);
      draw('bevel','bikeBlue',[0,.784,.806],[.367,.151,.267]);
      draw('bevel','ink',[0,.861,.807],[.345,.038,.248]);
    }else{
      tube(crank,stem,.101,color);
      tube(crank,seat,.082,color);
      tube(seat,[0,.734,.51],.068,color);
      draw('bevel','ink',[.058,.395,-.35],[.053,.112,1.05]);
      draw('bevel','ink',[0,.779,.848],[.42,.037,.395]);
      for(const sign of [-1,1]){
        draw('bevel','ink',[sign*.218,.869,.84],[.045,.20,.39]);
        for(const z of [.647,1.036])draw('box','ink',[sign*.175,.875,z],[.09,.178,.036]);
      }
      for(let i=-2;i<=2;i++)draw('box','ink',[i*.081,.884,1.035],[.024,.177,.024]);
      draw('bevel',color,[0,.96,1.04],[.414,.037,.052]);
      const key=parent+'-crank';
      node(key,crank,parent);
      part('cyl','chrome',[0,0,0],[.095,.245,.095],roll(Math.PI/2),undefined,key);
      for(const side of [-1,1]){
        part('bevel','chrome',[side*.113,0,side*.079],[.028,.030,.175],undefined,undefined,key);
        part('bevel','softRubber',[side*.149,0,side*.16],[.095,.033,.075],undefined,undefined,key);
      }
    }
  }

  const e=FOOT_GATE;
  box('paving',e.x,.043,e.z,37.9,.144,7.25);
  for(const side of [-1,1]){
    box('concrete',e.x,.13,e.z+side*3.62,37.9,.14,.19);
    box('concrete',e.x,1.97,e.z+side*3.4,1.15,3.70,.38);
  }
  box('concrete',e.x,3.92,e.z,2.58,.34,7.18);
  box('dark',e.x,4.14,e.z,2.75,.12,7.40);
  for(const offset of GATE_PEDESTALS){
    const z=e.z+offset;
    part('bevel','stainless',[e.x,.72,z],[1.8,1.10,.26]);
    part('bevel','softRubber',[e.x,1.28,z],[1.79,.07,.26]);
    for(const side of [-1,1]){
      box('ink',e.x+side*.69,1.43,z,.14,.45,.16);
      part('bevel','autoGlass',[e.x+side*.71,1.66,z],[.13,.25,.19]);
      box('signal',e.x+side*.79,1.70,z,.016,.06,.09);
    }
  }
  for(const lane of GATE_LANES)for(const side of [-1,1]){
    const key='gate-wing-'+lane+'-'+side;
    node(key,[e.x,1.06,e.z+lane+side*.64]);
    part('bevel','gateGlass',[0,0,-side*.302],[.062,.55,.604],undefined,undefined,key);
    part('bevel','stainless',[0,-.252,-side*.302],[.079,.041,.612],undefined,undefined,key);
  }
  node('guard',[e.x+2.65,.115,e.z-2.83]);

  // Follow the two surveyed, one-way drives. Barriers stand on the edge of the carriageway.
  for(const lane of GATE_VEHICLES){
    const x=EAST_GATE.x,z=gateRoadZ(x,lane.way);
    const side=lane.id==='entry'?-1:1;
    const nx=Math.cos(lane.yaw)*side,nz=-Math.sin(lane.yaw)*side;
    const bx=x+nx*2.58,bz=z+nz*2.58;
    part('bevel','concrete',[bx,.15,bz],[.84,.30,2.02],yaw(lane.yaw));
    part('bevel','gold',[bx,.55,bz],[.44,.90,.53],yaw(lane.yaw));
    box('white',bx,1.83,bz,.095,2.28,.11);
    for(const h of [1.1,1.74,2.38])box('coral',bx,h,bz,.105,.26,.115);
    for(const dx of [-6.5,6.5]){
      const ax=x+dx,az=gateRoadZ(ax,lane.way);
      const py=groundHeight({x:ax,z:az})+.035;
      box('white',ax,py,az,.24,.024,2.3,lane.yaw);
      for(const sign of [-1,1]){
        const qx=ax+Math.sin(lane.yaw)*.86+Math.cos(lane.yaw)*.22*sign;
        const qz=az+Math.cos(lane.yaw)*.86-Math.sin(lane.yaw)*.22*sign;
        box('white',qx,py,qz,.17,.025,.78,lane.yaw-sign*.55);
      }
    }
  }
  const gateAxis=-.36;
  box('paving',1092,.09,154,26,.18,8.3,gateAxis);
  for(const {x,z,height:h} of CENTURY_STONES){
    const y=groundHeight({x,z});
    box('concrete',x,y+.17,z,.88,.34,2.45,gateAxis);
    box('trim',x,y+h*.5+.28,z,.54,h,2.23,gateAxis);
    box('buff',x+.271,y+h*.65+.28,z+.098,.035,h*.39,1.73,gateAxis);
  }
  box('trim',1081,1.43,150.3,.54,2.86,7.5,gateAxis);
  box('concrete',1081,.22,150.3,.98,.44,8.3,gateAxis);

  const {x:px,z:pz}=PAVILION;
  const py=groundHeight(PAVILION);
  for(const [scale,dy,color] of [[12,.11,'paving'],[10.8,.3,'trim'],[9.75,.46,'paving']] as const){
    part('penta',color,[px,py+dy,pz],[scale,.23,scale],yaw(Math.PI/5));
  }
  for(let i=0;i<5;i++){
    const a=i*TORSION/5;
    part('pavilion-arch','trim',[px+3.63*Math.sin(a),py+3.65,pz+3.63*Math.cos(a)],[5.43,6.24,1.05],yaw(a));
  }
  part('penta','trim',[px,py+6.72,pz],[8.92,.45,8.92],yaw(Math.PI/5));
  part('smooth','trim',[px,py+6.96,pz],[7.34,4.26,7.34]);
  part('bevel','concrete',[px,py+.90,pz],[2.12,.67,1.82]);
  part('bevel','bronze',[px,py+1.63,pz-.19],[1.25,.80,.82]);
  part('bevel','bronze',[px,py+2.35,pz-.30],[.94,1.02,.53],aroundX(-.14));
  part('ball','bronze',[px,py+3.07,pz-.26],[.51,.58,.50]);
  for(const sign of [-1,1]){
    part('capsule','bronze',[px+sign*.34,py+1.68,pz+.19],[.66,.60,.62],aroundX(-Math.PI/2));
    part('bevel','bronze',[px+sign*.31,py+1.18,pz+.58],[.29,.82,.31]);
    part('capsule','bronze',[px+sign*.49,py+2.18,pz+.24],[.47,.54,.49],aroundX(.63));
  }
  const courtY=groundHeight(PLAZA);
  part('court-ring','paving',[PLAZA.x,courtY+.048,PLAZA.z],[1,1,1]);
  part('court-bands','trim',[PLAZA.x,courtY+.062,PLAZA.z],[1,1,1]);
  for(let i=0;i<5;i++){
    const a=i*TORSION/5+.28;
    box('trim',PLAZA.x+10*Math.sin(a),courtY+.051,PLAZA.z+10*Math.cos(a),.66,.039,23,a);
  }
  for(const [x,z] of [[797,71],[801,74],[805,77],[808,78],[815,77],[818,72],[814,67],[825,73],[831,75],[836,76],[842,72],[845,67]]){
    cyl('gold',x,groundHeight({x,z})+.041,z,.235,.06);
  }
  const {x:H,z:Z}=HALL_SIGN;
  const hh=groundHeight(HALL_SIGN);
  box('buff',H,hh+2.54,Z,7.0,1.53,.29);
  for(const dx of [-3.2,3.2])box('concrete',H+dx,hh+1.0,Z,.32,2,.36);
  const pass=MAIN_PASSAGE;
  for(const z of [pass.z0-.1,pass.z1+.1]){
    box('buff',751,2.29,z,36,4.58,.32);
    box('trim',751,1.14,z,36,.24,.41);
  }
  box('trim',751,pass.ceiling+.065,56,36,.13,16.35);
  for(const x of [739,747,755,763])box('headlight',x,pass.ceiling-.027,56,.73,.09,.22);

  // The near-lake family and the northern bank spring planting are anchored to the map.
  for(const bird of BIRDS){
    const pose=birdPose(bird,0),k=bird.id,f=bird.swan;
    entities[k]={components:{Name:{value:k},Transform:{pos:[pose.x,pose.y,pose.z],quat:yaw(pose.yaw)}}};
    const draw=(shape:Shape,color:Color,p:Triple,s:Triple,r?:Rotation)=>part(shape,color,p,s,r,undefined,k);
    const body:Color=f?'swanWhite':'feather';
    draw('ball',body,[0,f?.17:.105,-.06],f?[.57,.32,1.14]:[.33,.223,.64]);
    for(const side of [-1,1])draw('ball',f?'white':'jacketSeam',[side*(f?.21:.119),f?.22:.14,-.113],f?[.29,.28,.77]:[.14,.173,.45],yaw(side*.16));
    draw('lowpoly',body,[0,f?.20:.143,f?-.57:-.36],f?[.36,.17,.41]:[.19,.10,.22],aroundX(.26));
    if(f){
      draw('capsule','swanWhite',[0,.37,.278],[.39,.51,.40],aroundX(.61));
      draw('capsule','swanWhite',[0,.58,.394],[.32,.45,.34],aroundX(-.19));
      draw('capsule','swanWhite',[0,.75,.357],[.29,.26,.28],aroundX(.42));
    }else draw('capsule','mallard',[0,.226,.155],[.35,.23,.36],aroundX(.4));
    draw('ball',f?'swanWhite':'mallard',[0,f?.805:.304,f?.426:.208],f?[.171,.142,.245]:[.154,.157,.18]);
    draw('bevel','bill',[0,f?.773:.273,f?.572:.318],f?[.10,.044,.177]:[.113,.042,.134],aroundX(.1));
    for(const sign of [-1,1])draw('ball','hair',[sign*(f?.072:.068),f?.825:.319,f?.475:.24],[.026,.026,.026]);
    draw('torus','ripple',[0,-.052,-.24],f?[1.5,1.20,.075]:[.83,.75,.064],aroundX(Math.PI/2));
  }
  const orchard=[
    ...Array.from({length:29},(_,i)=>({x:104+4.28*i,z:-100+(i%2)*3.6})),
    ...Array.from({length:12},(_,i)=>({x:1015+2.18*i,z:102+(i%3)*4.45})),
    ...Array.from({length:11},(_,i)=>({x:COURTYARD.x+Math.sin(i*2.4)*22,z:COURTYARD.z+Math.cos(i*2.4)*16})),
  ];
  for(const [i,p] of orchard.entries()){
    if(!diggable(p))continue;
    const y=groundHeight(p),size=.81+(i%6)*.071;
    cyl('wood',p.x,y+1.45*size,p.z,.16*size,2.9*size);
    for(let j=0;j<6;j++){
      const a=j*2.4+i,d=(.48+j%3*.20)*size;
      const x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d;
      const h=y+(2.36+j%4*.37)*size;
      part('cyl','wood',[(x+p.x)/2,h-.42*size,(z+p.z)/2],[.085,1.28*size,.085],roll((j%2?.46:-.46)));
      part('lowpoly',j%3===0?'rose':j%3===1?'blossom':'flowerPale',[x,h,z],[1.31*size,1.20*size,1.26*size]);
      part('lowpoly',j%2?'flowerPale':'blossom',[x+.26,h+.23,z-.28],[.76*size,.59*size,.79*size]);
    }
  }

  // Rows of young trees frame the 55 teaching building's south court.
  for(const x of [135,153,180,194])for(const z of [-230,-223,-210,-205]){
    const p={x,z};
    if(!diggable(p))continue;
    const base=groundHeight(p), height=3.1+Math.sin(x+z)*.48;
    cyl('wood',x,base+height*.46,z,.13,height*.92);
    for(let j=0;j<5;j++){
      const angle=x+z+j*2.4, offset=.43+(j%2)*.29;
      const tx=x+Math.cos(angle)*offset,tz=z+Math.sin(angle)*offset;
      const y=base+height*(.66+j*.10);
      part('cyl','wood',[(x+tx)/2,y-.46,(z+tz)/2],[.056,1.07,.056],roll(j%2?.41:-.41));
      part('lowpoly',j%3===0?'leafDark':j%3===1?'leaf':'leafLight',[tx,y,tz],[1.06,1.38,1.19],yaw(angle));
    }
  }

  function batch(key:string,shape:Shape,color:Color){
    part(shape,color,[0,0,0],[1,1,1],undefined,key);
    entities[key]={components:{...entities[key].components,Instances:{transforms:[1,0,0,0,0,1,0,0,0,0,1,0,0,-70,0,1]}}};
  }
  for(const [key,[shape,color]] of Object.entries(CROWD_PARTS))batch('crowd-'+key,shape,color);
  for(const [key,color] of Object.entries(GRASS_PARTS))batch('grass-'+key,'tuft',color);

  for(const s of PARCELS){
    const {x,z}=s.building,h=groundHeight(s.building),front=z+s.sign*2.09;
    box('trim',x,h+1.54,z,6.6,3.08,4.1);
    box('teal',x,h+3.12,z,6.8,.25,4.35);
    box('teal',x,h+2.54,front,5.8,.46,.14);
    box('autoGlass',x+.8,h+1.2,front,2.85,1.60,.13);
    box('dark',x-1.7,h+1.02,front,1.4,2.04,.14);
  }
  entities.visitor={components:{Name:{value:'访客'},Transform:{pos:[SPAWN.x,groundHeight(SPAWN),SPAWN.z],quat:yaw(SPAWN.yaw)}}};
  node('held-shovel',[-.30,-12,.16],'visitor');
  part('cyl','wood',[0,.045,0],[.045,.85,.045],aroundX(.40),undefined,'held-shovel');
  part('bevel','stainless',[0,-.40,-.16],[.22,.26,.052],aroundX(.40),undefined,'held-shovel');
  part('torus','dark',[0,.47,.18],[.13,.15,.12],undefined,undefined,'held-shovel');
  node('held-blaster',[-.30,-12,.21],'visitor');
  part('bevel','dark',[0,.05,.19],[.14,.16,.51],undefined,undefined,'held-blaster');
  part('cyl','chrome',[0,.08,.44],[.09,.35,.09],aroundX(Math.PI/2),undefined,'held-blaster');
  part('box','teal',[0,.14,.12],[.12,.055,.26],undefined,undefined,'held-blaster');
  part('bevel','dark',[0,-.07,.10],[.10,.20,.13],aroundX(.20),undefined,'held-blaster');
  node('impact-pulse',[0,-40,0]);
  part('cyl','gold',[-.31,0,3.10],[.035,5.5,.035],aroundX(Math.PI/2),undefined,'impact-pulse');
  node('npc-walk',[0,-30,0]);node('npc-bike',[0,-30,0]);node('npc-bike-frame',[0,.045,0],'npc-bike');
  vehicle('npc-bike-frame','bikeYellow',false);
  node('bike',[0,-12,0],'visitor');vehicle('bike','bikeYellow',false);
  node('ebike',[0,-12,0],'visitor');vehicle('ebike','bikeBlue',true);
  // Easter egg props, tied to the atlas trigger points.
  const lion=SECRETS[0];
  for(const z of [lion.z,lion.z-6.6]){
    box('trim',lion.x,.34,z,1.73,.68,1.21);
    part('lowpoly','trim',[lion.x-.06,.99,z],[1.33,.85,.92]);
    part('lowpoly','buff',[lion.x+.41,1.51,z],[.82,.88,.78]);
    part('ball','trim',[lion.x+.62,1.59,z],[.62,.59,.55]);
    for(const side of [-1,1])part('ball','buff',[lion.x+.4,1.89,z+side*.23],[.20,.28,.20]);
  }
  const star = SECRETS[1];
  cyl('trim',star.x,.25,star.z,2.8,.49);
  cyl('dark',star.x,1.15,star.z,.24,1.84);
  for (let j=0;j<5;j++) {
    const a = j*TORSION/5;
    part('box','gold',[star.x,2.45+Math.cos(a)*.36,star.z+Math.sin(a)*.36],[.27,1.19,.32],[Math.sin(a/2),0,0,Math.cos(a/2)]);
  }
  const wall=SECRETS[3];
  box('trim',wall.x,.13,wall.z+.4,6.2,.32,1.38);
  box('terracotta',wall.x,1.22,wall.z-.35,5.9,2.21,.44);
  box('buff',wall.x,2.34,wall.z-.35,6.1,.16,.54);
  for(let i=-3;i<=3;i++)for(let j=0;j<3;j++)box('trim',wall.x+i*.69,.82+j*.28,wall.z-.11,.46,.075,.05);


  // Campus-meme props: takeaway stand, a society screening sign, and a lakeside frame.
  const [fragrant,pickles,city] = SECRETS.slice(4);
  box('wood',fragrant.x,.64,fragrant.z,2.52,1.26,1.35);
  box('trim',fragrant.x,1.35,fragrant.z,2.65,.19,1.53);
  for (const sign of [-1,1]) box('wood',fragrant.x+sign*1.16,2.05,fragrant.z,.12,1.7,.12);
  for (let i=-3;i<=3;i++) box(i%2?'white':'coral',fragrant.x+i*.40,2.92,fragrant.z,.40,.16,1.85);
  cyl('white',fragrant.x,1.55,fragrant.z,.62,.21);
  cyl('gold',fragrant.x,1.67,fragrant.z,.54,.044);
  box('dark',pickles.x,1.05,pickles.z,.24,2.12,.27);
  box('dark',pickles.x,2.05,pickles.z,2.95,1.73,.24);
  box('glass',pickles.x,2.05,pickles.z+.13,2.69,1.48,.025);
  box('coral',pickles.x,1.98,pickles.z+.151,1.25,.23,.024);
  for (const off of [-1.57,1.57]) box('coral',city.x,1.52,city.z+off,.22,2.97,.24);
  for (const y of [1.04,2.95]) box('coral',city.x,y,city.z,.22,.23,3.38);

  for(const d of DOCKS){
    const h=groundHeight(d);
    box('paving',d.x,h+.06,d.z,4.8,.12,2.8);
    for(const [j,m] of ['bike','ebike'].entries()){
      const key='dock-'+d.id+'-'+m;
      node(key,[d.x+(j===0?-1:1),h+.165,d.z]);
      vehicle(key,m==='bike'?'bikeYellow':'bikeBlue',m==='ebike');
    }
    box('dark',d.x,h+1.15,d.z-.87,.16,2.22,.14);
    box('teal',d.x,h+2.2,d.z-.87,1.04,.69,.15);
    box('trim',d.x,h+2.2,d.z-.78,.36,.34,.025);
  }
  for(const t of TRAFFIC){
    const p=trafficPose(t.route,t.start);
    entities[t.id]={components:{Name:{value:t.id},Transform:{pos:[p.x,groundHeight(p)+.04,p.z],quat:yaw(p.yaw)}}};
    buildCar(t.id,t.color,part);
  }
  const paints=['carBlue','carWhite','carGreen','carGray','carRed'] as const;
  for(const [i,p] of PARKED.entries()){
    entities[p.id]={components:{Name:{value:'停车位 '+p.id},Transform:{pos:[p.x,groundHeight(p)+.04,p.z],quat:yaw(p.yaw)}}};
    buildCar(p.id,paints[i%paints.length],part);
  }
  node('drive-car',[0,-40,0]);buildCar('drive-car','carBlue',part);
  for(const t of TARGETS.slice(1)){
    node(t.id,[t.x,groundHeight(t),t.z]);
    part('bevel','buff',[0,.46,0],[1.12,.92,.82],undefined,undefined,t.id);
    part('box','wood',[0,.83,0],[1.14,.075,.85],undefined,undefined,t.id);
    for(const side of [-1,1])part('box','dark',[side*.36,.46,.426],[.13,.89,.039],undefined,undefined,t.id);
    node(t.id+'-rubble',[t.x,-30,t.z]);
    for(let j=0;j<5;j++)part('bevel',j%2?'wood':'buff',[(j-2)*.28,.13,j%2*.24],[.40,.26,.32],yaw(j*.78),undefined,t.id+'-rubble');
  }
  node('kiosk-rubble',[0,-30,0]);
  for(let i=0;i<14;i++)part('bevel',i%2?'brick':'trim',[Math.sin(i*6.45)*4,.22,Math.cos(i*5.82)*3],[.6,.44,.9],yaw(i),undefined,'kiosk-rubble');
  for(let i=0;i<8;i++){
    const key='dig-'+i;
    node(key,[0,-30,0]);
    part('torus','dirt',[0,.05,0],[1.45,.27,1.24],aroundX(Math.PI/2),undefined,key);
    part('cyl','pit',[0,.024,0],[1.19,.06,.94],undefined,undefined,key);
    for(let j=0;j<5;j++)part('lowpoly','dirt',[-.37+j*.19,.11,.48+Math.sin(j)*.09],[.40,.20,.28],yaw(j),undefined,key);
  }
  // Compact props on the two mapped soccer pitches.
  for(const [x,z0,z1] of [[781,-554,-450],[677,563,670]])for(const z of [z0,z1]){
    for(const dx of [-3.66,3.66])box('white',x+dx,1.32,z,.13,2.44,.13);
    box('white',x,2.55,z,7.44,.13,.13);
    for(let j=-7;j<=7;j++)box('trim',x+j*.50,1.25,z+.8,.018,2.32,.018);
  }
  const lamps=[{x:1076,z:122.8},{x:1048,z:142},{x:164,z:-219},{x:829,z:-480},{x:32,z:523},{x:237,z:54}];
  for(const [i,p] of lamps.entries()){
    const y=groundHeight(p);
    cyl('dark',p.x,y+2.6,p.z,.14,5.2);
    box('headlight',p.x,y+5.25,p.z,.39,.13,.39);
    entities['lamp-'+i]={components:{Name:{value:'校园路灯'},Transform:{pos:[p.x,y+5.10,p.z]},PointLight:{color:[1,.73,.43],intensity:0,range:16}}};
  }
  const c=cameraPose(START);
  entities.camera={components:{Name:{value:'Campus follow camera'},Transform:{pos:[c.x,c.y,c.z],quat:Array.from(quat.fromLookAt(quat.create(),[c.x,c.y,c.z],[SPAWN.x,cameraTargetY(START),SPAWN.z],[0,1,0]))},
    Camera:{...perspective({fov:FOV,aspect:16/9,near:.12,far:760}),tonemap:TONEMAP_ACES_FILMIC,exposure:1.16,antialias:ANTIALIAS_FXAA,clearColor:[.3,.51,.59,1]}}};
  entities.sun={components:{DirectionalLight:{direction:[-.69,-.67,.26],color:[1,.91,.77],intensity:3.4,castShadow:true,cascadeCount:3,shadowDistance:90,mapSize:2048,depthBias:.002,normalBias:.022,contactShadowLength:.9}}};
  const sky=guid(DAYLIGHT,'environment/campus-sky');
  entities.sky={components:{SkyboxBackground:{equirect:sky,mode:SKYBOX_MODE_CUBEMAP}}};
  entities.ambient={components:{Skylight:{equirect:sky,color:[1,.985,.95],intensity:1.12}}};
  const matrix = mat4.create();
  for (const [key, { shape, color, parent, parts }] of partBatches) {
    if (parts.length === 1) {
      addMesh(key, shape, color, parts[0]!, parent);
      continue;
    }
    const transforms: number[] = [];
    for (const { pos, scale, quat } of parts) transforms.push(...mat4.compose(matrix, pos, quat, scale));
    addMesh(key, shape, color, {}, parent, transforms);
  }
  return {kind:'scene',entities};
}
export default definePack({schemaVersion:'2.0.0',packageId:SCENE,name:'Beiyang / Campus Interactions',
  sceneComponents:[Camera,ChildOf,DirectionalLight,Instances,PointLight,MeshFilter,MeshRenderer,Name,SkyboxBackground,Skylight,Transform],
  build:()=>ok({[SCENE_KEY]:makeCampus()})});
