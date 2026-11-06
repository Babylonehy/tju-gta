import { ground, inMainPassage, inParking, MAIN_PASSAGE, roadLevel, roofLevel, walkable } from '../osm-campus/layout.ts';
import { EAST_GATE, FOOT_GATE, GATE_COLUMNS, GATE_LANES, GATE_VEHICLES, gateRoadZ, onEastWalk, PARCELS, SECRETS, SPAWN, SPOTS, distance, dockAt, scanCode, parcelAt, type ParcelId, type Ride, type TravelMode, type Point, type SecretId, type SpotId } from './atlas.ts';
import { type Life, START_LIFE, maxStamina, nearbyCar, observe, TARGETS } from './life.ts';

export type GatePass = 'in' | 'out';
export interface Travel {inside:boolean;pass:GatePass|null;gateLane:number|null;parcels:readonly ParcelId[];x:number;z:number;yaw:number;pitch:number;facing:number;pace:number;lift:number;recovering?:boolean;mode:TravelMode;car?:string;visited:readonly SpotId[];found:readonly SecretId[];life:Life}
export interface Controls {forward:number;strafe:number;look:number;tilt:number;sprint:boolean}
export const IDLE:Controls={forward:0,strafe:0,look:0,tilt:0,sprint:false};
export const START:Travel={...SPAWN,inside:false,pass:null,gateLane:null,parcels:[],facing:SPAWN.yaw,pitch:.24,pace:0,lift:0,mode:'foot',visited:['gate'],found:[],life:START_LIFE};
export const FOV=Math.PI/3.12;
export const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const gateSolid=(p:Point,y:number,pad=0)=>GATE_COLUMNS.some(b=>y<b.height+pad&&Math.abs(p.x-b.x)<b.width/2+pad&&Math.abs(p.z-b.z)<b.depth/2+pad);
const sampleLocations = [['bridge','bridge'],['parking','parking'],['track','sport']].map(([sample,id])=>({
  sample:sample as 'bridge'|'parking'|'track',spot:SPOTS.find(s=>s.id===id)!,
}));
const kioskBroken=(state:Travel)=>(state.life.damage.kiosk??0)>=TARGETS[0].hp;
export function canTravel(x:number,z:number,state:Travel=START){
  const p={x,z};
  if(!walkable(x,z,kioskBroken(state),state.mode==='car'?.80:.27)||gateSolid(p,0))return false;
  if(PARCELS.some(station=>Math.abs(x-station.building.x)<3.3&&Math.abs(z-station.building.z)<2.05))return false;
  return state.mode!=='car'||roadLevel(p)!==undefined||inParking(p);
}
export function groundHeight(p:Point){
  if(onEastWalk(p))return Math.max(.115,ground(p));
  return ground(p);
}
function turn(current:number,target:number,dt:number){
  const angle=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+clamp(angle,-dt*15,dt*15);
}
export function stepTravel(state:Travel,input:Controls,seconds:number):Travel {
  const dt=clamp(seconds,0,.05),yaw=state.yaw+input.look,pitch=clamp(state.pitch+input.tilt,.055,.70);
  const length=Math.max(1,Math.hypot(input.forward,input.strafe));
  const forward=input.forward/length,strafe=input.strafe/length;
  const moving=forward!==0||strafe!==0;
  const recovering=Boolean(state.recovering&&state.life.stamina<18);
  const sprint=moving&&input.sprint&&state.mode==='foot'&&!recovering&&state.life.stamina>.8;
  const target=moving ? state.mode==='car'?input.sprint?21:13 : state.mode==='ebike'?input.sprint?12:8 : state.mode==='bike'?input.sprint?8:5.6 : sprint?4.9:1.48 : 0;
  const pace=target?state.pace+(target-state.pace)*Math.min(1,dt*7):0;
  const dx=Math.sin(yaw)*forward-Math.cos(yaw)*strafe,dz=Math.cos(yaw)*forward+Math.sin(yaw)*strafe;
  const x=state.x+dx*pace*dt,z=state.z+dz*pace*dt;
  const nearGate=state.z>FOOT_GATE.z-12&&state.z<EAST_GATE.z+24&&Math.abs(state.x-EAST_GATE.x)<24;
  const crossing=nearGate&&(state.x<EAST_GATE.x)!==(x<EAST_GATE.x);
  const cleared=state.mode==='car'
    ? Math.abs(state.z-gateRoadZ(EAST_GATE.x,GATE_VEHICLES[state.inside?1:0].way))<2.4
    : state.mode==='foot'&&state.pass===(state.inside?'out':'in')&&state.gateLane!==null&&Math.abs(state.z-FOOT_GATE.z-state.gateLane)<.58;
  const nextX=canTravel(x,state.z,state)&&(!crossing||cleared)&&(state.inside||x<EAST_GATE.x+34)?x:state.x;
  const crossed=crossing&&nextX!==state.x;
  const inside=crossed?!state.inside:state.inside;
  const nextZ=canTravel(nextX,z,state)&&(inside||z>FOOT_GATE.z-10&&z<EAST_GATE.z+23)?z:state.z;
  const next={x:nextX,z:nextZ},moved=nextX!==state.x||nextZ!==state.z;
  const visited=SPOTS.filter(spot=>!state.visited.includes(spot.id)&&distance(spot,next)<25).map(spot=>spot.id);
  let life=state.life;
  const stamina=clamp(life.stamina+dt*(sprint&&moved?-15:moved?12:21),0,maxStamina(life));
  if(stamina!==life.stamina)life={...life,stamina};
  if(inside){
    for(const {sample,spot} of sampleLocations){
      if(!life.data.includes(sample)&&Math.min(distance(spot,next),distance(spot.arrival,next))<18)life=observe(life,sample);
    }
  }
  return {...state,...next,inside,pass:crossed?null:state.pass,gateLane:crossed?null:state.gateLane,yaw,pitch,life,recovering:recovering||sprint&&stamina<=.8,
    facing:moved?turn(state.facing,Math.atan2(dx,dz),dt):state.facing,pace:moved?pace:0,
    visited:visited.length?[...state.visited,...visited]:state.visited};
}
export function warp(state:Travel,id:SpotId):Travel{
  const spot=SPOTS.find(item=>item.id===id);
  if(!state.inside||!spot||state.mode!=='foot')return state;
  const p=spot.arrival;
  for(let radius=0;radius<=12;radius+=1){
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,x=p.x+radius*Math.sin(a),z=p.z+radius*Math.cos(a);
      if(canTravel(x,z,state)){
        const yaw=id==='parking'?.46:id==='gate'?Math.PI/2:id==='lake'?-1.82:Math.atan2(spot.x-x,spot.z-z);
        return {...state,x,z,yaw,facing:yaw,pace:0,lift:0,pass:null,gateLane:null,visited:state.visited.includes(id)?state.visited:[...state.visited,id]};
      }
    }
  }
  return state;
}
export function nearbySecret(state:Pick<Travel,'x'|'z'|'found'>){return SECRETS.find(s=>!state.found.includes(s.id)&&distance(s,state)<=4.3);}
export function collectSecret(state:Travel):Travel {
  const secret=nearbySecret(state);
  return secret?{...state,found:[...state.found,secret.id]}:state;
}
export interface CameraPose {x:number;y:number;z:number;yaw:number;pitch:number}
export function cameraTargetY(state:Travel){return (state.mode==='car'?1.35:1.46)+groundHeight(state)+state.lift*.48;}
export function cameraPose(state:Travel):CameraPose {
  const targetY=cameraTargetY(state),desired=state.mode==='foot'?5.6:state.mode==='car'?10.5:7.4;
  let distance=desired;
  for(let d=1;d<desired;d+=.42){
    const x=state.x-Math.sin(state.yaw)*d*Math.cos(state.pitch),z=state.z-Math.cos(state.yaw)*d*Math.cos(state.pitch),y=targetY+d*Math.sin(state.pitch);
    if(gateSolid({x,z},y,.24)||(!inMainPassage({x,z})||y>=MAIN_PASSAGE.ceiling)&&y<(roofLevel({x,z},kioskBroken(state))??-Infinity)+.25){distance=d-.32;break;}
  }
  return {x:state.x-Math.sin(state.yaw)*distance*Math.cos(state.pitch),y:targetY+distance*Math.sin(state.pitch),z:state.z-Math.cos(state.yaw)*distance*Math.cos(state.pitch),yaw:state.yaw,pitch:state.pitch};
}
export function worldToView(p:Point&{y:number},camera:CameraPose,width:number,height:number){
  const x=p.x-camera.x,y=p.y-camera.y,z=p.z-camera.z;
  const forward=Math.sin(camera.yaw)*x+Math.cos(camera.yaw)*z;
  const depth=Math.cos(camera.pitch)*forward-Math.sin(camera.pitch)*y;
  if(depth<.6)return null;
  const up=Math.sin(camera.pitch)*forward+Math.cos(camera.pitch)*y,right=-Math.cos(camera.yaw)*x+Math.sin(camera.yaw)*z;
  const focal=height/(2*Math.tan(FOV/2));
  return {left:width/2+right*focal/depth,top:height/2-up*focal/depth,depth};
}
export function unlockRide(state:Travel,mode:Ride,code:string):Travel{
  const dock=dockAt(state);
  return state.mode==='foot'&&dock&&scanCode(dock.id,mode)===code?{...state,mode,pace:0,lift:0}:state;
}
export function dismount(state:Travel):Travel {return state.mode==='foot'?state:{...state,mode:'foot',car:undefined,pace:0,lift:0};}
export function toggleCar(state:Travel):Travel{
  if(state.mode==='car')return dismount(state);
  const car=nearbyCar(state);
  return state.inside&&state.mode==='foot'&&car?{...state,x:car.x,z:car.z,facing:car.yaw,yaw:car.yaw,mode:'car',car:car.id,pace:0,lift:0}:state;
}
export function atEastGate(p:Point){return Math.abs(p.x-FOOT_GATE.x)<(p.x<FOOT_GATE.x?6:13.4)&&Math.abs(p.z-FOOT_GATE.z)<3.18;}
export function approveGate(state:Travel,direction:GatePass):Travel{
  if(!atEastGate(state)||state.mode!=='foot'||direction!==(state.inside?'out':'in'))return state;
  const gateLane=GATE_LANES.reduce((best,lane)=>Math.abs(FOOT_GATE.z+lane-state.z)<Math.abs(FOOT_GATE.z+best-state.z)?lane:best);
  return {...state,pass:direction,gateLane};
}
export function pickupParcel(state:Travel,id:ParcelId,code:string):Travel{
  const station=parcelAt(state);
  return !state.inside||!station||id!==station.id||station.code!==code||state.parcels.includes(id)?state:{...state,parcels:[...state.parcels,id]};
}
export function restoreParcels(data:unknown){return PARCELS.filter(p=>Array.isArray(data)&&data.includes(p.id)).map(p=>p.id);}
