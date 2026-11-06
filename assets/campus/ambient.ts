import { Instances } from '@forgeax/engine/render';
import { Transform } from '@forgeax/engine/scene';
import type { EntityHandle, World } from '@forgeax/engine/ecs';
import { FEATURES, diggable, inMainPassage, pavingLevel, roadLevel, walkable, waterLevel } from '../osm-campus/layout.ts';
import { aroundY } from './actors.ts';
import { FOOT_GATE, distance, onEastWalk, type Point } from './atlas.ts';
import { groundHeight } from './explore.ts';
import type { Color, Shape } from './geometry.pack.ts';
import { LAKE_BIRDS, PLAZA } from './landmarks.ts';
import { campusPopulation } from './population.ts';

export const CROWD_PARTS={
  hair:['ball','hair'],heads:['ball','skin'],pants:['capsule','denim'],shoes:['ball','softRubber'],bags:['bevel','bag'],
  jacket:['bevel','jacket'],teal:['bevel','teal'],brick:['bevel','brick'],denim:['bevel','carBlue'],
  staff:['bevel','ink'],
} as const satisfies Record<string,readonly [Shape,Color]>;
export const GRASS_PARTS={blades:'greenBlade',dryBlades:'greenBladeDry'} as const;
const TAU=Math.PI*2;
const fract=(n:number)=>n-Math.floor(n);
const rand=(x:number,z:number)=>fract(Math.sin(x*12.9898+z*78.233)*43758.5453);
type Path={a:Point;b:Point;length:number;yaw:number;staff:boolean;style:number;phase:number;height:number};
const streets=FEATURES.filter(f=>f.kind==='road'&&f.name&&!/雅观|雅正|同砚/.test(f.name)).flatMap(f=>
  f.points.slice(1).map((b,i)=>({a:f.points[i]!,b})));
const paved=(p:Point)=>walkable(p.x,p.z)&&!inMainPassage(p)&&(roadLevel(p)!==undefined||pavingLevel(p)!==undefined||onEastWalk(p));
function crowdPaths(p:Point,inside:boolean){
  const paths:Path[]=[];
  const seen=new Set<string>();
  function add(a:Point,b:Point,seed:number){
    const length=distance(a,b);
    const midpoint={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
    if(length<4||distance(midpoint,p)>63)return;
    const key=Math.floor(midpoint.x/3)+','+Math.floor(midpoint.z/3);
    if(seen.has(key))return;
    for(let d=0;d<=1.01;d+=.1){
      const q={x:a.x+(b.x-a.x)*d,z:a.z+(b.z-a.z)*d};
      if(!paved(q)||Math.abs(q.z-FOOT_GATE.z)<6&&Math.abs(q.x-FOOT_GATE.x)<2.8)return;
    }
    seen.add(key);
    paths.push({a,b,length,yaw:Math.atan2(b.x-a.x,b.z-a.z),staff:seed%7===0,style:seed%4,
      phase:rand(seed,2),height:.92+rand(seed,1)*.13});
  }
  for(const [i,{a,b}] of streets.entries()){
    if(!inside)break;
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    if(!len||p.x<Math.min(a.x,b.x)-69||p.x>Math.max(a.x,b.x)+69||p.z<Math.min(a.z,b.z)-69||p.z>Math.max(a.z,b.z)+69)continue;
    for(let d=0;d+5<len;d+=8){
      const end=Math.min(len,d+18);
      for(const side of [-1,1]){
        const edge=side*(2.1+rand(i,d)*1.35);
        const at=(t:number)=>({x:a.x+(dx*t+dz*edge)/len,z:a.z+(dz*t-dx*edge)/len});
        add(at(d),at(end),i*197+d+side);
      }
    }
  }
  // The east pedestrian plaza and the near side of small courtyards have shorter walks.
  const ox=Math.round(p.x/12)*12,oz=Math.round(p.z/12)*12;
  for(let i=0;i<145;i++){
    const x=ox+(rand(i,ox)-.5)*112,z=oz+(rand(i,oz+1)-.5)*112;
    if(Math.abs(z-FOOT_GATE.z)<28&&(inside?x>FOOT_GATE.x-3:x<FOOT_GATE.x+3))continue;
    const a=rand(i,3)*TAU,dx=Math.sin(a)*4.5,dz=Math.cos(a)*4.5;
    add({x:x-dx,z:z-dz},{x:x+dx,z:z+dz},i);
  }
  return paths.sort((a,b)=>distance(a.a,p)-distance(b.a,p)).slice(0,62);
}
export const BIRDS=Array.from({length:9},(_,i)=>({
  id:'lake-bird-'+i,swan:i<2,phase:i*TAU/9,offset:(i%3)*1.45,
}));
export function birdPose(bird:typeof BIRDS[number],seconds:number){
  const phase=bird.phase+seconds*(bird.swan?.045:.075);
  const x=LAKE_BIRDS.x+Math.cos(phase)*(11+bird.offset);
  const z=LAKE_BIRDS.z+Math.sin(phase)*(8+bird.offset);
  return {x,z,y:(waterLevel({x,z})??0)+.088+Math.sin(phase*8)*.024,yaw:Math.atan2(-Math.sin(phase)*(11+bird.offset),Math.cos(phase)*(8+bird.offset))};
}
type Frame=Record<keyof typeof CROWD_PARTS,number[]>;
const newFrame=():Frame=>({hair:[],heads:[],pants:[],shoes:[],bags:[],jacket:[],teal:[],brick:[],denim:[],staff:[]});
function matrix(out:number[],x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw:number,pitch=0){
  const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.cos(pitch),q=Math.sin(pitch);
  out.push(c*sx,0,-s*sx,0,s*q*sy,p*sy,c*q*sy,0,s*p*sz,-q*sz,c*p*sz,0,x,y,z,1);
}
function fillCrowd(frame:Frame,paths:readonly Path[],visitor:Point,seconds:number,minute:number){
  for(const output of Object.values(frame))output.length=0;
  const hour=minute/60;
  const occupancy=campusPopulation(minute).total;
  const limit=hour>=6&&hour<22?Math.round(occupancy/300):17;
  let count=0;
  for(const [i,path] of paths.entries()){
    if(count>=limit)break;
    const progress=seconds*(.95+path.phase*.48)/path.length+path.phase*2;
    const round=progress%2,ratio=round<1?round:2-round;
    const x=path.a.x+(path.b.x-path.a.x)*ratio,z=path.a.z+(path.b.z-path.a.z)*ratio;
    if(distance({x,z},visitor)<2.25)continue;
    count++;
    const yaw=path.yaw+(round<1?0:Math.PI),y=groundHeight({x,z}),h=path.height;
    const gait=(seconds*(.98+path.phase*.22)+path.phase*4)*TAU, bob=Math.cos(2*gait)*.021;
    const c=Math.cos(yaw),s=Math.sin(yaw);
    const draw=(key:keyof Frame,px:number,py:number,pz:number,sx:number,sy:number,sz:number,pitch=0)=>
      matrix(frame[key],x+c*px+s*pz,y+py*h,z-s*px+c*pz,sx*h,sy*h,sz*h,yaw,pitch);
    const top=path.staff?'staff':(['jacket','teal','brick','denim'] as const)[Math.abs(path.style)]!;
    draw(top,0,1.19+bob,0,.36,.47,.24);
    draw('heads',0,1.59+bob,.012,.22,.275,.218);
    draw('hair',0,1.684+bob,-.016,.232,.15,.226);
    if(!path.staff&&i%3!==0)draw('bags',0,1.21+bob,-.166,.279,.34,.141);
    for(const side of [-1,1]){
      const swing=Math.sin(gait)*side;
      draw('pants',side*.104,.47+bob,.132*swing,.304,.71,.30,.34*swing);
      draw('shoes',side*.105,.081+Math.max(0,swing)*.115,.25*swing+.057,.146,.13,.27);
      draw(top,side*.22,1.15+bob,-.084*swing,.113,.38,.139,-.49*swing);
      draw('heads',side*.23,.933+bob,-.174*swing,.096,.14,.102);
    }
  }
}
const grassGap=.78;
function grassFrame(center:Point,holes:readonly Point[]){
  const blades:number[]=[],dryBlades:number[]=[];
  const x0=Math.floor(center.x/grassGap),z0=Math.floor(center.z/grassGap);
  for(let iz=z0-35;iz<=z0+35;iz++)for(let ix=x0-35;ix<=x0+35;ix++){
    const seed=rand(ix,iz),p={x:(ix+seed*.84)*grassGap,z:(iz+rand(iz,ix)*.84)*grassGap};
    const ring=distance(p,PLAZA);
    if(ring>=24&&ring<=56||distance(p,center)>26||onEastWalk(p)||!diggable(p)||holes.some(h=>distance(h,p)<.84))continue;
    const width=.78+seed*.84;
    matrix(seed>.84?dryBlades:blades,p.x,groundHeight(p)+.012,p.z,width,.48+seed*.53,width,seed*TAU);
  }
  return {blades,dryBlades};
}
export function mountAmbient(world:World,entity:(key:string)=>EntityHandle){
  const frame=newFrame();
  const crowd=Object.keys(frame).map(key=>({key:key as keyof Frame,id:entity('crowd-'+key)}));
  const grass=(Object.keys(GRASS_PARTS) as (keyof typeof GRASS_PARTS)[]).map(key=>({key,id:entity('grass-'+key)}));
  const birds=BIRDS.map(bird=>({bird,id:entity(bird.id)}));
  const hidden=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,-70,0,1]);
  const write=(id:EntityHandle,values:number[])=>world.set(id,Instances,{transforms:values.length?Float32Array.from(values):hidden}).unwrap();
  let crowdAnchor:Point|undefined,grassAnchor:Point|undefined,paths:Path[]=[],seconds=0,next=0,lastHoles:readonly Point[]|undefined,wasInside=false;
  return (p:Point,inside:boolean,minute:number,holes:readonly Point[],dt:number)=>{
    seconds+=dt;
    if(!grassAnchor||distance(p,grassAnchor)>8||holes!==lastHoles){
      const plants=grassFrame(p,holes);
      for(const {id,key} of grass)write(id,plants[key]);
      grassAnchor=p;lastHoles=holes;
    }
    if(!crowdAnchor||distance(p,crowdAnchor)>21||inside!==wasInside){
      paths=crowdPaths(p,inside);
      crowdAnchor=p;wasInside=inside;next=seconds;
    }
    if(seconds<next)return;
    next=seconds+.061;
    fillCrowd(frame,paths,p,seconds,minute);
    for(const {id,key} of crowd)write(id,frame[key]);
    if(distance(p,LAKE_BIRDS)<200)for(const {bird,id} of birds){
      const a=birdPose(bird,seconds);
      world.set(id,Transform,{pos:[a.x,a.y,a.z],quat:aroundY(a.yaw)}).unwrap();
    }
  };
}
