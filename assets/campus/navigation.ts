import { createNavigationGrid } from '@forgeax/engine/navigation';
import { EAST_GATE, FOOT_GATE, LIMITS, distance, type Point } from './atlas.ts';
import { canTravel } from './explore.ts';
import { roadLevel } from '../osm-campus/layout.ts';

const CELL=4;
const width=Math.floor((LIMITS.maxX-LIMITS.minX)/CELL)+1;
const height=Math.floor((LIMITS.maxZ-LIMITS.minZ)/CELL)+1;
const pos=(index:number)=>({x:LIMITS.minX+index%width*CELL,z:LIMITS.minZ+Math.floor(index/width)*CELL});
const insideGate=(p:Point)=>p.x<FOOT_GATE.x||p.z<FOOT_GATE.z-15||p.z>EAST_GATE.z+28;
function clear(a:Point,b:Point){
  const samples=Math.max(1,Math.ceil(distance(a,b)/.72));
  for(let i=0;i<=samples;i++){
    const t=i/samples,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    if(!insideGate({x,z})||!canTravel(x,z))return false;
  }
  return true;
}
let map:ReturnType<typeof build>;
function build(){
  const blocked=new Uint8Array(width*height),weights=new Float32Array(width*height);
  for(let i=0;i<blocked.length;i++){
    const p=pos(i);
    blocked[i]=insideGate(p)&&canTravel(p.x,p.z)?0:1;
    weights[i]=roadLevel(p)===undefined?1.28:1;
  }
  return {blocked,grid:createNavigationGrid({
    width,height,plane:'xz',cellSize:CELL,origin:[LIMITS.minX,0,LIMITS.minZ],diagonal:true,blocked,weights,
  }).unwrap()};
}
function candidates(p:Point,radius:number,connect:boolean){
  const col=Math.round((p.x-LIMITS.minX)/CELL),row=Math.round((p.z-LIMITS.minZ)/CELL),steps=Math.ceil(radius/CELL);
  const found:{index:number;gap:number}[]=[];
  for(let z=Math.max(0,row-steps);z<=Math.min(height-1,row+steps);z++){
    for(let x=Math.max(0,col-steps);x<=Math.min(width-1,col+steps);x++){
      const index=z*width+x;
      if(map.blocked[index])continue;
      const q=pos(index),gap=distance(p,q);
      if(gap<=radius&&(!connect||clear(p,q)))found.push({index,gap});
    }
  }
  return found.sort((a,b)=>a.gap-b.gap);
}
export function routeAcrossCampus(start:Point,goal:Point,building=false):Point[]|undefined{
  if(!building&&clear(start,goal))return [goal];
  map??=build();
  const source=candidates(start,12,true)[0];
  if(!source)return;
  const destinations=candidates(goal,building?68:13,!building);
  for(const {index} of destinations.slice(0,10)){
    const route=map.grid.findPath(source.index,index,{maxVisited:100_000});
    if(!route.ok)continue;
    const points=[start,...Array.from(route.value.nodes,pos),...(building?[]:[goal])];
    const simplified:Point[]=[];
    let anchor=0;
    while(anchor<points.length-1){
      let next=Math.min(anchor+24,points.length-1);
      while(next>anchor+1&&!clear(points[anchor],points[next]))next--;
      if(!clear(points[anchor],points[next]))break;
      simplified.push(points[next]);anchor=next;
    }
    if(anchor===points.length-1)return simplified;
  }
}
