import type {} from '@forgeax/engine/app';
import type {} from '@forgeax/engine/assets-runtime';
import { ADVANCE_ANIMATION_PLAYER_SYSTEM, AnimationPlayer, AnimationTargetId, bindAnimationTargets } from '@forgeax/engine/animation';
import { ENTITY_NULL_RAW, Time, Update, type EntityHandle } from '@forgeax/engine/ecs';
import { quat } from '@forgeax/engine/math';
import { definePack } from '@forgeax/engine/pack/source';
import type { Plugin } from '@forgeax/engine/plugin';
import { DirectionalLight, PointLight, SceneInstance, SkyboxBackground, Skylight } from '@forgeax/engine/render';
import { ChildOf, Name, PROPAGATE_TRANSFORMS_SYSTEM, sceneEntity, Transform, worldDespawnScene, worldResolveSceneEntity } from '@forgeax/engine/scene';
import { Skin } from '@forgeax/engine/skinning';
import { ok, type AnimationClip, type EquirectAsset, type SceneAsset } from '@forgeax/engine/types';
import { characterMotion, MOTIONS, motionSpeed } from '../characters/motion.ts';
import { GUARD, STUDENT, STUDENT_FEMALE } from '../characters/rig-refs.ts';
import { OSM_SCENE, PARKED } from '../osm-campus/layout.ts';
import { distance, FOOT_GATE, GATE_LANES, SECRETS, SPOTS, type Point, type SecretId } from './atlas.ts';
import { AVATARS, CHANNEL, type Avatar, type InputMessage, type NavigationGuide, type Snapshot } from './channel.ts';
import { approveGate, cameraPose, cameraTargetY, clamp, collectSecret, dismount, groundHeight, IDLE, pickupParcel, restoreParcels, START, stepTravel, toggleCar, unlockRide, warp, type Travel } from './explore.ts';
import { destinationFor } from './directory.ts';
import { routeAcrossCampus } from './navigation.ts';
import { advanceTraffic, nearbyPatrol, TRAFFIC, trafficPose } from './traffic.ts';
import { CAMPUS, DAYLIGHT, SCENE, SCENE_KEY, guid } from './ids.ts';

import { aroundY } from './actors.ts';
import { mountAmbient } from './ambient.ts';
import { clockMinute, daylightAt, MINUTES_PER_SECOND, observe, restoreLife, START_MINUTE, submitProject, TARGETS, TOOLS, toolAction } from './life.ts';

const stages=['day','dawn','dusk','night'] as const;
const hideY=-40;
type RigRefs = { scene: string; clips: readonly string[] };
const rigConfig = ({ scene, clips }: RigRefs) => ({ scene: {$asset:scene}, clips: clips.map($asset=>({$asset})) });

export const campus: Plugin.Object<{ scene: string; map: string; skies: string[]; student: RigRefs; female: RigRefs; guard: RigRefs }> = {
  name: 'beiyang/campus',
  inject: ['assets','world','gameHost'],
  async apply(ctx, config) {
    const assets = ctx.assets;
    const port = ctx.gameHost?.port;
    if (!assets || !port) throw new Error('Beiyang requires Engine assets and the GameHost source port');
    const loadScene = async (id:string) => (await assets.loadByGuid<SceneAsset>(assets.parseGuid(id))).unwrap();
    const loadRig = async (refs:RigRefs) => ({
      scene: await loadScene(refs.scene),
      clips: await Promise.all(refs.clips.map(async id=>(await assets.loadByGuid<AnimationClip>(assets.parseGuid(id))).unwrap())),
    });
    const [loaded,map,student,female,guard,skies] = await Promise.all([
      loadScene(config.scene),loadScene(config.map),loadRig(config.student),loadRig(config.female),loadRig(config.guard),
      Promise.all(config.skies.map(async id=>(await assets.loadByGuid<EquirectAsset>(assets.parseGuid(id))).unwrap())),
    ]);
    ctx.effect(function* () {
      const handle = ctx.world.allocSharedRef('SceneAsset', loaded);
      yield () => ctx.world.sharedRefs.release(handle).unwrap();
      const root = assets.instantiate<SceneAsset>(handle, ctx.world).unwrap();
      yield () => worldDespawnScene(ctx.world, root).unwrap();
      const entity = (key: string) => worldResolveSceneEntity(ctx.world, root, sceneEntity(SCENE_KEY,key)).unwrap();
      const mapHandle=ctx.world.allocSharedRef('SceneAsset',map);
      yield () => ctx.world.sharedRefs.release(mapHandle).unwrap();
      const mapRoot=assets.instantiate<SceneAsset>(mapHandle,ctx.world).unwrap();
      yield () => worldDespawnScene(ctx.world,mapRoot).unwrap();
      const mapMembers=Array.from(ctx.world.get(mapRoot,SceneInstance).unwrap().mapping).filter(e=>e!==ENTITY_NULL_RAW) as EntityHandle[];
      const kiosk=mapMembers.find(e=>ctx.world.get(e,Name).ok&&ctx.world.get(e,Name).unwrap().value==='OSM-East-Kiosk-528929232');
      if(kiosk===undefined)throw new Error('Beiyang map is missing the east gate kiosk');
      const kioskTransform=ctx.world.get(kiosk,Transform).unwrap();
      const updateAmbient=mountAmbient(ctx.world,entity);
      const sun=entity('sun'),ambient=entity('ambient'),background=entity('sky');
      const alternateSkies=skies.map(sky=>ctx.world.allocSharedRef('EquirectAsset',sky));
      yield () => {for(const sky of alternateSkies)ctx.world.sharedRefs.release(sky).unwrap();};
      const skyHandles=[ctx.world.get(background,SkyboxBackground).unwrap().equirect,...alternateSkies];
      const lamps=Array.from({length:6},(_,i)=>entity('lamp-'+i));
      const pits=Array.from({length:8},(_,i)=>entity('dig-'+i));
      const props=TARGETS.map(t=>({target:t,whole:t.id==='kiosk'?kiosk:entity(t.id),rubble:entity(t.id+'-rubble')}));
      const parked=PARKED.map(car=>({...car,entity:entity(car.id)}));
      const driving=entity('drive-car');
      const shovel=entity('held-shovel'),blaster=entity('held-blaster'),pulse=entity('impact-pulse');
      let pulseTimer=0;
      const visitor = entity('visitor'), camera = entity('camera'), bike = entity('bike'), ebike = entity('ebike');
      const crank = entity('bike-crank');
      function mountRig(model:typeof student,parent:EntityHandle) {
        const scene=ctx.world.allocSharedRef('SceneAsset',model.scene);
        const clips=model.clips.map(clip=>ctx.world.allocSharedRef('AnimationClip',clip));
        let rig:EntityHandle|undefined;
        const dispose=()=>{
          if(rig!==undefined)worldDespawnScene(ctx.world,rig).unwrap();
          for(const clip of clips)ctx.world.sharedRefs.release(clip).unwrap();
          ctx.world.sharedRefs.release(scene).unwrap();
        };
        try{
          rig=assets!.instantiate<SceneAsset>(scene,ctx.world,parent).unwrap();
          const members=Array.from(ctx.world.get(rig,SceneInstance).unwrap().mapping).filter(e=>e!==ENTITY_NULL_RAW) as EntityHandle[];
          const targets=members.filter(e=>ctx.world.get(e,AnimationTargetId).ok);
          if(!targets.length||!members.some(e=>ctx.world.get(e,Skin).ok))throw new Error('Beiyang character scene is missing its skin or skeleton');
          ctx.world.addComponent(rig,{component:AnimationPlayer,data:{clips,times:clips.map(()=>0),weights:clips.map((_,i)=>i===0?1:0),speeds:clips.map(()=>1)}}).unwrap();
          bindAnimationTargets(ctx.world,rig,targets).unwrap();
          return {entity:rig,dispose};
        }catch(error){
          dispose();
          throw error;
        }
      }
      let avatar:Avatar='male';
      const walker=entity('npc-walk'),cyclist=entity('npc-bike'),bikeCrank=entity('npc-bike-frame-crank');
      const maleStudent=mountRig(student,visitor);
      yield maleStudent.dispose;
      const femaleStudent=mountRig(female,walker);
      yield femaleStudent.dispose;
      yield mountRig(guard,entity('guard')).dispose;
      const cycling=mountRig(student,cyclist);
      yield cycling.dispose;
      const rigs={male:maleStudent.entity,female:femaleStudent.entity};
      let studentRig=rigs.male;
      const cycleRig=cycling.entity;
      const patrols=[{entity:walker,riding:false,speed:1.42,rig:rigs.female,path:nearbyPatrol(START,false),yaw:0},
        {entity:cyclist,riding:true,speed:5.6,rig:cycleRig,path:nearbyPatrol(START,true),yaw:0}];
      for(const npc of patrols){
        const motion=npc.riding?'ride':'walk';
        ctx.world.set(npc.rig,AnimationPlayer,{weights:MOTIONS.map(m=>m===motion?1:0),speeds:MOTIONS.map(m=>motionSpeed(m,npc.speed))}).unwrap();
      }
      const gates=GATE_LANES.flatMap(lane=>[-1,1].map(side=>({lane,side,angle:0,entity:entity('gate-wing-'+lane+'-'+side)})));
      const cars=TRAFFIC.map(t=>({ ...t,entity:entity(t.id),at:t.start as number }));
      const weights = MOTIONS.map((_,i)=>i===0?1:0) as number[];
      const speeds = MOTIONS.map(()=>1);
      let motionIndex = 0;
      let state: Travel = START;
      let guide:NavigationGuide|undefined;
      let guideStep=0,guideStall=0;
      const approach={x:FOOT_GATE.x+2.7,z:FOOT_GATE.z};
      let gateStage:'approach'|'crossing'|undefined;
      let minute=START_MINUTE,timeLeft=0,lightingTimer=.15,lastStage=-1;
      let held = IDLE, look = 0, tilt = 0, vertical = 0, broadcast = 0;
      let dirty = true, relocated = true, worldDirty = true;
      let newSecret: SecretId | undefined, notice:string|undefined;
      const sync = () => {
        const message: Snapshot = {kind:'snapshot',travel:state,camera:cameraPose(state),minute,avatar,guide:guide&&{...guide,points:guide.points.slice(guideStep)},secret:newSecret,notice};
        port.postMessage({channel:CHANNEL,...message});
        newSecret=notice=undefined; dirty=false; broadcast=0;
      };
      const stopMovement = () => { held=IDLE; vertical=0; look=tilt=0; dirty=true; relocated=true; };
      const setState=(next:Travel)=>{
        if(next!==state){state=next;dirty=true;relocated=true;}
      };
      const switchAvatar=(next:Avatar)=>{
        if(next===avatar||!Object.hasOwn(AVATARS,next))return;
        const replacement=rigs[next];
        const times=Array.from(ctx.world.get(studentRig,AnimationPlayer).unwrap().times);
        const walk=ctx.world.get(replacement,AnimationPlayer).unwrap();
        const walkPlayback={times:Array.from(walk.times),weights:Array.from(walk.weights),speeds:Array.from(walk.speeds)};
        // Exchange the visitor and pedestrian roles. Keeping both skin entity
        // identities avoids reallocating a GPU palette beyond the scene window.
        ctx.world.reparent(studentRig,walker,ChildOf,{parent:walker}).unwrap();
        ctx.world.reparent(replacement,visitor,ChildOf,{parent:visitor}).unwrap();
        ctx.world.set(studentRig,AnimationPlayer,walkPlayback).unwrap();
        ctx.world.set(replacement,AnimationPlayer,{times,weights,speeds}).unwrap();
        patrols[0].rig=studentRig;
        studentRig=replacement;
        avatar=next;dirty=true;relocated=true;
      };
      const endGuide=(message?:string)=>{
        guide=gateStage=undefined;guideStep=guideStall=0;notice=message;dirty=true;
      };
      const assignGuide=(id:string)=>{
        const target=destinationFor(id);
        if(!target)return;
        if(state.mode!=='foot'){endGuide('请先下车，再开启步行寻路。');return;}
        const points=state.inside?routeAcrossCampus(state,target.point,target.building):[approach];
        if(!points){endGuide('没找到安全的步行路线，请换一个起点。');return;}
        gateStage=state.inside?undefined:'approach';
        guide={id,name:target.name,phase:'walking',points};
        guideStep=guideStall=0;dirty=true;
      };
      function guideControls(dt:number){
        if(!guide)return {...held,look,tilt};
        const waypoint=guide.points[guideStep];
        if(!waypoint||distance(waypoint,state)<.47){
          if(waypoint&&++guideStep<guide.points.length){dirty=true;return IDLE;}
          if(gateStage==='approach'&&guide.id!=='gate'){
            if(state.pass==='in'&&state.gateLane!==null){
              const lane=FOOT_GATE.z+state.gateLane;
              const points:Point[]=[{x:approach.x,z:lane},{x:FOOT_GATE.x-2.8,z:lane}];
              guide={...guide,points,phase:'walking'};guideStep=0;gateStage='crossing';dirty=true;
            }else if(guide.phase!=='gate'){guide={...guide,phase:'gate'};dirty=true;}
            return IDLE;
          }
          if(gateStage==='crossing'&&state.inside){assignGuide(guide.id);return IDLE;}
          endGuide('已抵达 · '+guide.name);return IDLE;
        }
        const angle=Math.atan2(waypoint.x-state.x,waypoint.z-state.z)-state.yaw;
        const turn=Math.atan2(Math.sin(angle),Math.cos(angle));
        return {...IDLE,tilt,forward:Math.abs(turn)<.29?1:0,look:clamp(turn,-dt*4,dt*4),
          sprint:!gateStage&&distance(waypoint,state)>6&&state.life.stamina>26};
      }
      const updateScene=()=>{
        for(const {target,whole,rubble} of props){
          const broken=(state.life.damage[target.id]??0)>=target.hp,h=groundHeight(target);
          const pos=target.id==='kiosk'?Array.from(kioskTransform.pos):[target.x,h,target.z];
          if(broken)pos[1]=hideY;
          ctx.world.set(whole,Transform,{pos}).unwrap();
          ctx.world.set(rubble,Transform,{pos:[target.x,broken?h:hideY,target.z]}).unwrap();
        }
        for(const [i,pit] of pits.entries()){
          const p=state.life.holes[i];
          ctx.world.set(pit,Transform,{pos:p?[p.x,groundHeight(p)+.024,p.z]:[0,hideY,0]}).unwrap();
        }
        worldDirty=false;
      };
      const receive = ({data}: MessageEvent<InputMessage & {channel?: string}>) => {
        if (data?.channel !== CHANNEL) return;
        switch(data.kind){
          case 'input': {
            const c=data.controls;
            if(guide&&(c.forward||c.strafe||c.sprint))endGuide('已切回手动操作');
            held={...IDLE,forward:clamp(c.forward,-1,1),strafe:clamp(c.strafe,-1,1),sprint:c.sprint};
            look+=clamp(c.look,-.8,.8);tilt+=clamp(c.tilt,-.5,.5);
            break;
          }
          case 'scan': if(guide)endGuide();setState(unlockRide(state,data.mode,data.code));break;
          case 'destination': if(data.id)assignGuide(data.id);else endGuide();break;
          case 'avatar': switchAvatar(data.avatar);break;
          case 'dismount': setState(dismount(state));break;
          case 'car': if(guide)endGuide();setState(toggleCar(state));break;
          case 'gate': setState(approveGate(state,data.direction));break;
          case 'parcel': setState(pickupParcel(state,data.id,data.code));break;
          case 'jump': if(state.mode==='foot'&&state.lift===0)vertical=4.1;break;
          case 'reset':
            if(guide)endGuide();
            state={...START,visited:state.visited,found:state.found,parcels:state.parcels,life:state.life};
            stopMovement();break;
          case 'warp': {
            if(guide)endGuide();
            const next=warp(state,data.id);
            if(next===state){notice='步行入校后才能快速前往此处。';dirty=true;}
            else{state=next;stopMovement();}
            break;
          }
          case 'collect': {
            const next=collectSecret(state);
            if(next!==state){state=next;newSecret=next.found.at(-1);dirty=true;}
            break;
          }
          case 'equip':
            if(Object.hasOwn(TOOLS,data.tool))setState({...state,life:{...state.life,tool:data.tool}});
            break;
          case 'tool-action':
            if(state.mode==='foot'){
              const action=toolAction(state.life,state,state.yaw);
              if(action.life!==state.life){
                if(state.life.tool==='blaster'){
                  pulseTimer=.16;
                  ctx.world.set(pulse,Transform,{pos:[state.x,groundHeight(state)+1.05,state.z],quat:aroundY(state.yaw)}).unwrap();
                }
                state={...state,life:action.life};worldDirty=true;
              }
              notice=action.message;
            }else notice='请先下车，再使用工具。';
            dirty=true;
            break;
          case 'clock':
            if(Number.isFinite(data.minute))timeLeft=clockMinute(data.minute-minute);
            break;
          case 'observe-light': {
            const {stage}=daylightAt(minute);
            if(stage==='day'||stage==='night'){
              setState({...state,life:observe(state.life,stage)});
              notice=stage==='day'?'已记录白天光照。':'已记录夜间光照。';
            }else notice='请在白天或夜间记录。';
            dirty=true;
            break;
          }
          case 'project': {
            const life=state.inside?submitProject(state.life,data.id,state):state.life;
            notice=life===state.life?'请带齐样本，前往 55 教提交。':'科研项目已结项，奖励已解锁。';
            setState({...state,life});break;
          }
          case 'restore':
            state={...state,parcels:restoreParcels([...state.parcels,...restoreParcels(data.parcels)]),
              visited:SPOTS.filter(s=>state.visited.includes(s.id)||data.visited?.includes(s.id)).map(s=>s.id),
              found:SECRETS.filter(s=>state.found.includes(s.id)||data.found?.includes(s.id)).map(s=>s.id),
              life:restoreLife(data.life)};
            if(Number.isFinite(data.minute))minute=clockMinute(data.minute!);
            if(data.avatar)switchAvatar(data.avatar);
            dirty=worldDirty=true;break;
          case 'inspect': sync();break;
        }
      };
      port.addEventListener('message', receive);
      port.start();
      yield () => port.removeEventListener('message',receive);
      ctx.world.addSystem(Update, {
        name:'beiyang/explore', queries:[], before:[ADVANCE_ANIMATION_PLAYER_SYSTEM,PROPAGATE_TRANSFORMS_SYSTEM],
        fn: () => {
          const dt = clamp(ctx.world.getResource(Time).delta,0,.05);
          const skip=Math.min(timeLeft,dt*570);
          timeLeft-=skip;
          minute=clockMinute(minute+(skip||dt*MINUTES_PER_SECOND));
          lightingTimer+=dt;
          if(lightingTimer>.13){
            const light=daylightAt(minute),stage=stages.indexOf(light.stage);
            ctx.world.set(sun,DirectionalLight,{direction:light.direction,color:light.sunColor,intensity:light.intensity}).unwrap();
            ctx.world.set(ambient,Skylight,{color:light.ambient,intensity:light.ambientPower}).unwrap();
            if(lastStage!==stage){
              const equirect=skyHandles[stage];
              ctx.world.set(ambient,Skylight,{equirect}).unwrap();
              ctx.world.set(background,SkyboxBackground,{equirect}).unwrap();
              for(const lamp of lamps)ctx.world.set(lamp,PointLight,{intensity:stage===3?82:stage===2?36:0}).unwrap();
              lastStage=stage;
            }
            lightingTimer=0;
          }
          if(worldDirty)updateScene();
          if(pulseTimer>0){
            pulseTimer-=dt;
            if(pulseTimer<=0)ctx.world.set(pulse,Transform,{pos:[0,hideY,0]}).unwrap();
          }
          const prev = state;
          const controls=guideControls(dt);
          state=stepTravel(state,controls,dt);
          updateAmbient(state,state.inside,minute,state.life.holes,dt);
          if(guide&&controls.forward){
            guideStall=distance(prev,state)<.003?guideStall+dt:0;
            if(guideStall>1.3)endGuide('路线受阻，已停止自动寻路。');
          }
          look=tilt=0;
          if (vertical || state.lift) {
            const lift = Math.max(0, state.lift + vertical*dt);
            vertical = lift ? vertical - dt*12 : 0;
            state = {...state,lift};
          }
          for(const gate of gates) {
            const open=state.pass&&state.gateLane===gate.lane;
            const next=gate.angle+((open?gate.side*Math.PI*.47:0)-gate.angle)*Math.min(1,dt*11);
            if(Math.abs(next-gate.angle)>.0001){
              gate.angle=next;
              ctx.world.set(gate.entity,Transform,{pos:[FOOT_GATE.x,1.06,FOOT_GATE.z+gate.lane+gate.side*.64],
                quat:[0,Math.sin(next/2),0,Math.cos(next/2)]}).unwrap();
            }
          }
          const poseAt=(e:EntityHandle,p:{x:number;z:number;yaw:number},offset=.035)=>{
            ctx.world.set(e,Transform,{pos:[p.x,groundHeight(p)+offset,p.z],quat:aroundY(p.yaw)}).unwrap();
          };
          for(const car of cars){
            car.at=advanceTraffic(car.route,car.at,car.speed,dt,state);
            poseAt(car.entity,trafficPose(car.route,car.at));
          }
          for(const npc of patrols){
            const current=npc.path&&trafficPose(npc.path.route,npc.path.at);
            if(!current||relocated&&distance(current,state)>100){
              const next=nearbyPatrol(state,npc.riding);
              if(next&&next.distance<125){npc.path=next;npc.yaw=trafficPose(next.route,next.at).yaw;}
            }
            if(!npc.path)continue;
            npc.path.at+=npc.speed*dt;
            const p=trafficPose(npc.path.route,npc.path.at);
            npc.yaw+=Math.atan2(Math.sin(p.yaw-npc.yaw),Math.cos(p.yaw-npc.yaw))*Math.min(1,dt*6);
            poseAt(npc.entity,{...p,yaw:npc.yaw},0);
          }
          const cycling=ctx.world.get(cycleRig,AnimationPlayer).unwrap().times[5]!*Math.PI;
          ctx.world.set(bikeCrank,Transform,{quat:[-Math.sin(cycling),0,0,Math.cos(cycling)]}).unwrap();
          if(state.mode==='car')poseAt(driving,{...state,yaw:state.facing});
          else if(prev.mode==='car'||relocated)ctx.world.set(driving,Transform,{pos:[0,hideY,0]}).unwrap();
          if(relocated){
            for(const car of parked)poseAt(car.entity,car,state.car===car.id?hideY:.035);
          }
          const motion=characterMotion(state.mode,state.pace,state.lift,vertical);
          const nextMotion=MOTIONS.indexOf(motion);
          if (nextMotion!==motionIndex) {
            const times=Array.from(ctx.world.get(studentRig,AnimationPlayer).unwrap().times);
            if (motion==='jump'||motion==='fall'||weights[nextMotion]! < .02) times[nextMotion]=0;
            ctx.world.set(studentRig,AnimationPlayer,{times}).unwrap();
            motionIndex=nextMotion;
          }
          const fade=Math.min(1,dt*12);
          let changed=false;
          for(let i=0;i<weights.length;i++) {
            const goal=i===motionIndex?1:0;
            if(weights[i]!==goal) {
              const delta=goal-weights[i]!;
              weights[i]=Math.abs(delta)<.001?goal:weights[i]!+delta*fade;
              changed=true;
            }
          }
          const speed=motionSpeed(motion,state.pace);
          if(changed||Math.abs(speeds[motionIndex]!-speed)>.01) {
            speeds[motionIndex]=speed;
            ctx.world.set(studentRig,AnimationPlayer,{weights,speeds}).unwrap();
          }
          if (motion==='ride') {
            const phase=ctx.world.get(studentRig,AnimationPlayer).unwrap().times[motionIndex]!*Math.PI;
            ctx.world.set(crank,Transform,{quat:[-Math.sin(phase),0,0,Math.cos(phase)]}).unwrap();
          }
          if (relocated || state.pace > 0 || prev.pace > 0 || state.lift || prev.lift || state.mode!==prev.mode || dirty) {
            ctx.world.set(visitor,Transform,{pos:[state.x,state.mode==='car'?hideY:state.lift+groundHeight(state),state.z],quat:[0,Math.sin(state.facing/2),0,Math.cos(state.facing/2)]}).unwrap();
            ctx.world.set(bike,Transform,{pos:[0,state.mode==='bike'?.045:-12,0]}).unwrap();
            ctx.world.set(ebike,Transform,{pos:[0,state.mode==='ebike'?.045:-12,0]}).unwrap();
            ctx.world.set(shovel,Transform,{pos:[-.30,state.mode==='foot'&&state.life.tool==='shovel'?.77:-12,.16]}).unwrap();
            ctx.world.set(blaster,Transform,{pos:[-.30,state.mode==='foot'&&state.life.tool==='blaster'?.90:-12,.21]}).unwrap();
          }
          if (relocated || state.x!==prev.x || state.z!==prev.z || state.yaw!==prev.yaw || state.pitch!==prev.pitch || state.lift!==prev.lift || dirty) {
            const c = cameraPose(state);
            const rotation = quat.fromLookAt(quat.create(),[c.x,c.y,c.z],[state.x,cameraTargetY(state),state.z],[0,1,0]);
            ctx.world.set(camera,Transform,{pos:[c.x,c.y,c.z],quat:[rotation[0]!,rotation[1]!,rotation[2]!,rotation[3]!]}).unwrap();
          }
          relocated=false;
          broadcast+=dt;
          if (dirty || broadcast>=.20 || state.inside!==prev.inside || broadcast >= .055 && (state.pace || prev.pace || state.yaw!==prev.yaw || state.pitch!==prev.pitch || state.lift || prev.lift)) sync();
        },
      }).unwrap();
      yield () => ctx.world.removeSystem(Update,'beiyang/explore').unwrap();
      sync();
    }, 'beiyang/campus');
  },
};
export default definePack({
  schemaVersion:'2.0.0', packageId:CAMPUS, name:'Beiyang / Exploration',
  build: () => ok({'plugin/campus':{
    kind:'plugin',module:{specifier:'./campus.pack.ts',export:'campus'},
    config:{scene:{$asset:guid(SCENE,SCENE_KEY)},map:{$asset:OSM_SCENE},skies:stages.slice(1).map(stage=>({$asset:guid(DAYLIGHT,'environment/'+stage)})),student:rigConfig(STUDENT),female:rigConfig(STUDENT_FEMALE),guard:rigConfig(GUARD)},
  }}),
});
