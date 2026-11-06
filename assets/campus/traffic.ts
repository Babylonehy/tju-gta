import { osmFeature, roadLevel, walkable } from '../osm-campus/layout.ts';
import { FOOT_GATE, onEastWalk } from './atlas.ts';
import { distance, type Point } from './survey.ts';

type Route = {points:readonly Point[];lengths:number[];total:number};
function loop(points:readonly Point[]):Route{
  if(points.length<2)throw new Error('A route needs two points');
  const lengths=points.map((p,i)=>distance(p,points[(i+1)%points.length]));
  return {points,lengths,total:lengths.reduce((a,b)=>a+b,0)};
}
function osmLoop(id:string,limit=1100){
  const p=osmFeature(id).points.filter(p=>Math.abs(p.x)<1240&&Math.abs(p.z)<limit);
  return loop([...p,...p.slice(1,-1).reverse()]);
}
const eastGateRoute=loop(
  ['850300977','918137130','-918137133','918137132','850300981','850300979','850300982','528927164'].flatMap(id=>{
    const points=osmFeature(id.replace('-','')).points;
    return (id.startsWith('-')?[...points].reverse():points).slice(0,-1);
  }),
);
export const TRAFFIC=[
  {id:'compact',route:osmLoop('477206923'),start:58,speed:7.2,color:'carGreen'},
  {id:'utility',route:osmLoop('850300985',1010),start:79,speed:10.3,color:'carWhite'},
  {id:'hatch',route:osmLoop('850300966'),start:430,speed:10.3,color:'carRed'},
  {id:'sedan',route:osmLoop('832128126'),start:783,speed:10.2,color:'carBlue'},
  {id:'gate-car',route:eastGateRoute,start:61,speed:5.3,color:'carWhite'},
  {id:'saloon',route:osmLoop('1427753266'),start:690,speed:10.2,color:'carGray'},
] as const;
export function trafficPose(route:Route,progress:number){
  let at=((progress%route.total)+route.total)%route.total;
  for(const [i,len] of route.lengths.entries()){
    if(at<len||i===route.lengths.length-1){
      const a=route.points[i],b=route.points[(i+1)%route.points.length],t=len?at/len:0;
      return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:Math.atan2(b.x-a.x,b.z-a.z)};
    }
    at-=len;
  }
  throw new Error('No campus traffic route');
}
export function advanceTraffic(route:Route,at:number,speed:number,dt:number,visitor:Point){
  const clearance=distance(trafficPose(route,at+3.4),visitor);
  return at+Math.min(1,Math.max(0,(clearance-2.25)/4.4))*speed*dt;
}
function safePatrol(points:readonly Point[]){
  let best:Point[]=[],run:Point[]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],count=Math.max(1,Math.ceil(distance(a,b)/2));
    for(let j=i===1?0:1;j<=count;j++){
      const t=j/count,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
      if(walkable(p.x,p.z)&&(roadLevel(p)!==undefined||onEastWalk(p))){run.push(p);if(run.length>best.length)best=run;}
      else run=[];
    }
  }
  return best.length>4?loop([...best,...best.slice(1,-1).reverse()]):undefined;
}
const gateWalk=[{x:1089,z:FOOT_GATE.z-2.95},{x:1074,z:FOOT_GATE.z-2.95}];
const ids=['918137130','850300976','850300980','528914656','528914652','838893321','477206923','528927153','528927156','528927154','477206927','528927155','528914647'];
const walkRoutes=[gateWalk,...ids.map(id=>osmFeature(id).points)].flatMap(p=>{const route=safePatrol(p);return route?[route]:[];});
const bikeRoutes=ids.map(id=>osmFeature(id).points).flatMap(p=>{const route=safePatrol(p);return route?[route]:[];});
export function nearbyPatrol(p:Point,riding:boolean){
  const list=riding?bikeRoutes:walkRoutes;
  let best:{route:Route;at:number;distance:number}|undefined;
  for(const route of list){
    let at=0;
    for(const [i,point] of route.points.entries()){
      const r=distance(p,point);
      if(!best||Math.abs(r-(riding?15:9))<Math.abs(best.distance-(riding?15:9)))best={route,at,distance:r};
      at+=route.lengths[i];
    }
  }
  return best;
}
