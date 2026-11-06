import { describe, expect, it } from 'vitest';
import { ATLAS_REVISION, DOCKS, EAST_GATE, FOOT_GATE, GATE_VEHICLES, gateRoadZ, onEastWalk, PARCELS, SECRETS, SPOTS, scanCode } from '../campus/atlas.ts';
import { approveGate, canTravel, collectSecret, dismount, IDLE, pickupParcel, START, stepTravel, toggleCar, unlockRide, warp } from '../campus/explore.ts';
import { clockLabel, daylightAt, LAB, maxStamina, observe, restoreLife, START_LIFE, submitProject, toolAction } from '../campus/life.ts';
import { advanceTraffic, nearbyPatrol, TRAFFIC, trafficPose } from '../campus/traffic.ts';
import { characterMotion, motionSpeed } from '../characters/motion.ts';
import { diggable, inParking, PARKED, pavingLevel, roadLevel, roofLevel, SPORTS, waterLevel } from '../osm-campus/layout.ts';
import { BUILDINGS as buildings, destinationFor } from '../campus/directory.ts';
import { BIRDS, birdPose } from '../campus/ambient.ts';
import { campusPopulation, VENUES, venuePopulation } from '../campus/population.ts';
import { routeAcrossCampus } from '../campus/navigation.ts';
import { connectsToTju, DEMO, findHiddenPost, issueToPost, newIssueUrl } from '../hud/community.ts';

const runner={...IDLE,forward:1,sprint:true};
const step=(state:typeof START,controls=runner,frames=100)=>{
  for(let i=0;i<frames;i++)state=stepTravel(state,controls,.05);
  return state;
};

describe('walkable OSM campus',()=>{
  it('uses mapped footprints, real bridge decks, marked lots and both athletic areas',()=>{
    expect(roofLevel({x:160,z:199})).toBeGreaterThan(4);
    expect(canTravel(160,199)).toBe(false);
    const bridge={x:621,z:54};
    expect(roadLevel(bridge)).toBeGreaterThan(waterLevel(bridge)!);
    expect(canTravel(bridge.x,bridge.z)).toBe(true);
    expect(canTravel(642,83)).toBe(false);
    expect(inParking({x:32,z:523})).toBe(true);
    expect(SPORTS.map(p=>p.id)).toEqual(expect.arrayContaining(['528929259','528929993','529020685']));
    expect(SPOTS.every(s=>canTravel(warp({...START,inside:true},s.id).x,warp({...START,inside:true},s.id).z))).toBe(true);
  });
  it('indexes each mapped roof and places building labels on their actual model geometry',()=>{
    expect(new Set(buildings.map(b=>b.id)).size).toBe(buildings.length);
    expect(buildings.find(b=>b.id==='w528911747')?.name).toContain('静算楼');
    expect(buildings.every(b=>roofLevel(b)! >= b.y-.02)).toBe(true);
    expect(new Set(buildings.map(b=>b.mapCode)).size).toBe(buildings.length);
    expect(buildings.find(b=>b.official==='55教')?.name).toBe('55教学楼');
    expect(destinationFor('lab')?.point).toEqual(LAB);
  });
  it('keeps the 55 teaching building wings and open pedestrian courtyard on the original footprint',()=>{
    const facade={x:163,z:-248},court={x:163,z:-221};
    const wings=[{x:109,z:-214},{x:222,z:-214}];
    expect(wings.every(p=>roofLevel(p)===12.5)).toBe(true);
    expect(roofLevel(facade)).toBeGreaterThan(roofLevel(wings[0])!+7);
    expect(roofLevel(court)).toBeUndefined();
    expect(pavingLevel(court)).toBeGreaterThan(0);
    expect(canTravel(court.x,court.z)).toBe(true);
    expect(roadLevel(court)).toBeUndefined();
    expect(diggable(court)).toBe(false);
  });
  it('finds a walkable route across the campus and leaves the 32 teaching building opening passable',()=>{
    expect(roofLevel({x:751,z:56})).toBeGreaterThan(4.55);
    expect(canTravel(751,56)).toBe(true);
    expect(canTravel(751,70)).toBe(false);
    expect(routeAcrossCampus({x:743,z:56},{x:775,z:56})).toEqual([{x:775,z:56}]);
    const westPass={...START,x:733,z:56,yaw:Math.PI/2,inside:true};
    expect(step(westPass,runner,200).x).toBeGreaterThan(773);
    const route=routeAcrossCampus({x:645,z:54},LAB)!;
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toEqual(LAB);
    expect(route.every(p=>canTravel(p.x,p.z))).toBe(true);
  });
  it('simulates campus occupancy and keeps the lake birds on mapped water',()=>{
    const night=campusPopulation(0),noon=campusPopulation(12*60);
    expect(night.total).toBeGreaterThan(10_000);
    expect(noon.total).toBeLessThan(20_000);
    expect(noon.total).toBeGreaterThan(night.total);
    const canteen=VENUES.find(v=>v.kind==='canteen')!;
    expect(venuePopulation(canteen,12*60).students).toBeGreaterThan(venuePopulation(canteen,15*60).students*4);
    expect(BIRDS.every(b=>[0,15,30,45,60,75,90,105,120].every(t=>waterLevel(birdPose(b,t))!==undefined))).toBe(true);
  });
  it('gates foot traffic in both directions',()=>{
    expect(step(START).x).toBeGreaterThanOrEqual(EAST_GATE.x);
    expect(approveGate(START,'out')).toBe(START);
    const entered=step(approveGate(START,'in'),runner,60);
    expect(entered.inside).toBe(true);
    expect(entered.pass).toBeNull();
    const exit={...entered,x:EAST_GATE.x-2,yaw:Math.PI/2};
    expect(step(exit,runner,55).inside).toBe(true);
    expect(step(approveGate(exit,'out'),runner,55).inside).toBe(false);
    expect(warp(START,'lab')).toBe(START);
    const inbound=GATE_VEHICLES[0],fromX=EAST_GATE.x+1;
    const z=gateRoadZ(fromX,inbound.way);
    const pedestrian={...START,x:fromX,z,yaw:inbound.yaw};
    expect(approveGate(pedestrian,'in')).toBe(pedestrian);
    expect(step(pedestrian,runner,12).inside).toBe(false);
    expect(step({...pedestrian,mode:'car'},runner,12).inside).toBe(true);
    expect(Math.abs(z-FOOT_GATE.z)).toBeGreaterThan(8);
  });
  it('checks each bike QR and keeps car driving inside mapped roads and lots',()=>{
    const dock={...START,...DOCKS[0],inside:true};
    expect(unlockRide(dock,'bike','wrong')).toBe(dock);
    expect(unlockRide(dock,'bike',scanCode(DOCKS[0].id,'bike')).mode).toBe('bike');
    expect(unlockRide(dock,'ebike',scanCode(DOCKS[0].id,'ebike')).mode).toBe('ebike');
    const car=toggleCar({...START,inside:true,x:PARKED[1].x+1,z:PARKED[1].z});
    expect(car.mode).toBe('car');
    expect(canTravel(car.x,car.z,car)).toBe(true);
    expect(canTravel(438,149,car)).toBe(false);
    expect(dismount(car).mode).toBe('foot');
  });
  it('collects the parcel and a physical TJU story only once',()=>{
    for(const station of PARCELS){
      const t=warp({...START,inside:true},station.id);
      expect(pickupParcel(t,station.id,'0000')).toBe(t);
      const picked=pickupParcel(t,station.id,station.code);
      expect(picked.parcels).toEqual([station.id]);
      expect(pickupParcel(picked,station.id,station.code)).toBe(picked);
    }
    expect(SECRETS.every(s=>canTravel(s.x,s.z))).toBe(true);
    const t={...START,...SECRETS[0]};
    expect(collectSecret(t).found).toEqual(['lions']);
    expect(collectSecret(collectSecret(t)).found).toEqual(['lions']);
  });
  it('uses road patrols and slows automatic traffic for the visitor',()=>{
    const car=TRAFFIC[0],p=trafficPose(car.route,car.start+3.4);
    expect(advanceTraffic(car.route,car.start,car.speed,.05,p)).toBe(car.start);
    expect(advanceTraffic(car.route,car.start,car.speed,.05,START)).toBeGreaterThan(car.start);
    for(const riding of [false,true]){
      const patrol=nearbyPatrol(START,riding)!;
      expect(patrol.distance).toBeLessThan(25);
      const p=trafficPose(patrol.route,patrol.at);
      expect(roadLevel(p)!==undefined||!riding&&onEastWalk(p)).toBe(true);
    }
    expect(characterMotion('foot',1.48,0,0)).toBe('walk');
    expect(motionSpeed('walk',1.48)).toBeCloseTo(1.13,1);
  });
});

describe('stamina, tools and computing projects',()=>{
  it('uses stamina when sprinting and recovers at rest',()=>{
    const t=step({...START,inside:true,x:440,z:153,yaw:Math.PI/2},runner,25);
    expect(t.life.stamina).toBeLessThan(START_LIFE.stamina);
    expect(step(t,IDLE,100).life.stamina).toBe(100);
  });
  it('allows pits on grass and records an impact only after a hit',()=>{
    const aim=LAB;
    expect(diggable(aim)).toBe(true);
    const dug=toolAction({...START_LIFE,tool:'shovel'},aim,0).life;
    expect(dug.holes).toEqual([{x:169,z:-219.8}]);
    expect(dug.stamina).toBe(84);
    expect(toolAction(dug,aim,0).life).toBe(dug);
    const gun={...dug,tool:'blaster'} as const;
    const yaw=Math.atan2(4,-1);
    const hit=toolAction(gun,aim,yaw).life;
    expect(hit.damage['lab-crate']).toBe(1);
    const broken=toolAction(hit,aim,yaw).life;
    expect(broken.damage['lab-crate']).toBe(2);
    expect(broken.data).toEqual(['dig','impact']);
    expect(submitProject(broken,'physics',LAB).completed).toEqual(['physics']);
    expect(restoreLife(broken).holes).toEqual(dug.holes);
  });
  it('collects navigation samples on site and requires submission at the computing lab',()=>{
    let t={...START,inside:true};
    for(const id of ['bridge','parking','sport'] as const)t=step(warp(t,id),IDLE,1);
    expect(t.life.data).toEqual(['bridge','parking','track']);
    expect(submitProject(t.life,'path',t)).toBe(t.life);
    const finished=submitProject(t.life,'path',LAB);
    expect(maxStamina(finished)).toBe(120);
    const light=observe(observe(finished,'day'),'night');
    expect(submitProject(light,'light',LAB).completed).toEqual(['path','light']);
  });
  it('wraps time and changes the color and intensity by phase',()=>{
    expect(clockLabel(1440+5)).toBe('00:05');
    expect(daylightAt(6*60).stage).toBe('dawn');
    expect(daylightAt(18*60).stage).toBe('dusk');
    expect(daylightAt(23*60).stage).toBe('night');
    expect(daylightAt(12*60).intensity).toBeGreaterThan(daylightAt(23*60).intensity);
  });
});

describe('shared campus footprints',()=>{
  const repo='campus/beiyang';
  it('publishes new meter coordinates and migrates screenshot pins',()=>{
    const p={x:1081,z:149},issue={number:1,state:'open',body:'东门见！',user:{login:'visitor'}};
    const url=new URL(newIssueUrl(repo,p,issue.body));
    expect(url.searchParams.get('title')).toContain(ATLAS_REVISION+' 1081.0,149.0');
    expect(issueToPost({...issue,title:url.searchParams.get('title')},repo)).toMatchObject(p);
    expect(issueToPost({...issue,title:'[北洋留言 AMAP1 93,2] 东门'},repo)).toMatchObject({x:1042.75,z:166.24});
    expect(issueToPost({...issue,title:'[北洋留言 OSM1 9000,2] 东门'},repo)).toBeNull();
  });
  it('accepts only TJU memes and reveals them when the player gets close',()=>{
    expect(connectsToTju('真香','今天吃饭')).toBe(false);
    expect(connectsToTju('寻路','在静算楼做路径规划实验')).toBe(true);
    expect(()=>newIssueUrl(repo,START,'无关','meme','真香')).toThrow();
    const meme=DEMO.find(p=>p.kind==='meme')!;
    expect(findHiddenPost(DEMO,meme,new Set())).toBe(meme);
    expect(findHiddenPost(DEMO,meme,new Set([meme.id]))).toBeUndefined();
  });
});
