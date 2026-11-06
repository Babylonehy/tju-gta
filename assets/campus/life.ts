import { distance, type Point } from './survey.ts';
import { diggable, PARKED } from '../osm-campus/layout.ts';

export const TOOLS = {none:'空手',shovel:'铲子',blaster:'冲击枪'} as const;
export type Tool = keyof typeof TOOLS;
export const TARGETS = [
  {id:'kiosk',name:'东门治安岗亭外壳',x:1090.3,z:139,hp:3},
  {id:'gate-crate',name:'东门器材箱',x:1080,z:142,hp:2},
  {id:'lab-crate',name:'55 教测试箱',x:173,z:-222,hp:2},
  {id:'track-crate',name:'田径场器材箱',x:783,z:-427,hp:2},
  {id:'parking-crate',name:'停车场隔离桶',x:35,z:522,hp:2},
] as const;
export type TargetId = typeof TARGETS[number]['id'];
export const LAB = {x:169,z:-221};
export const PROJECTS = [
  {id:'path',name:'路径规划',field:'算法',description:'沿桥、停车场、田径场各采集一个导航样本。',needs:['bridge','parking','track'],reward:'体力上限 +20'},
  {id:'light',name:'实时光照',field:'计算机图形学',description:'记录白天和夜间两个时段的光照。',needs:['day','night'],reward:'获得图形学实验徽章'},
  {id:'physics',name:'交互与碰撞模拟',field:'游戏引擎',description:'在草地挖一个测试坑，并对目标做一次冲击测试。',needs:['dig','impact'],reward:'冲击枪伤害 +1'},
] as const;
export type ProjectId = typeof PROJECTS[number]['id'];
export const OBSERVATIONS = {bridge:'三问桥',parking:'南门停车场',track:'田径场',day:'白天光照',night:'夜间光照',dig:'地表交互',impact:'冲击碰撞'} as const;
export type Observation = keyof typeof OBSERVATIONS;
export interface Life {stamina:number;tool:Tool;holes:readonly Point[];damage:Partial<Record<TargetId,number>>;data:readonly Observation[];completed:readonly ProjectId[]}
export const START_LIFE:Life={stamina:100,tool:'none',holes:[],damage:{},data:[],completed:[]};
export const maxStamina=(life:Life)=>life.completed.includes('path')?120:100;
export function observe(life:Life, sample:Observation):Life {
  return life.data.includes(sample)?life:{...life,data:[...life.data,sample]};
}
export function submitProject(life:Life,id:ProjectId,p:Point):Life {
  const project=PROJECTS.find(item=>item.id===id);
  if(!project||distance(p,LAB)>13||life.completed.includes(id)||!project.needs.every(n=>life.data.includes(n)))return life;
  const next={...life,completed:[...life.completed,id]};
  return {...next,stamina:maxStamina(next)};
}
export function restoreLife(value:unknown):Life {
  if(!value||typeof value!=='object')return START_LIFE;
  const input=value as Partial<Life>;
  const holes=(Array.isArray(input.holes)?input.holes:[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&diggable(p)).slice(-8);
  const completed=PROJECTS.map(p=>p.id).filter(id=>Array.isArray(input.completed)&&input.completed.includes(id));
  const data=(Object.keys(OBSERVATIONS) as Observation[]).filter(id=>Array.isArray(input.data)&&input.data.includes(id));
  const damage=Object.fromEntries(TARGETS.map(t=>[t.id,Math.min(t.hp,Math.max(0,Number(input.damage?.[t.id])||0))]));
  return {...START_LIFE,holes,completed,data,damage,stamina:completed.includes('path')?120:100};
}
export const toolAction=(life:Life,p:Point,facing:number):{life:Life;message:string}=>{
  const dx=Math.sin(facing),dz=Math.cos(facing);
  if(life.tool==='shovel'){
    const point={x:Math.round((p.x+dx*1.15)*10)/10,z:Math.round((p.z+dz*1.15)*10)/10};
    if(!diggable(point))return {life,message:'这里不能挖土。试试草地。'};
    if(life.holes.some(h=>distance(h,point)<1.5))return {life,message:'这里已有土坑，可以按 G 藏梗。'};
    if(life.stamina<16)return {life,message:'体力不足，休息后再挖。'};
    return {life:observe({...life,stamina:life.stamina-16,holes:[...life.holes.slice(-7),point]},'dig'),message:'挖好了。靠近土坑，按 G 藏一个天大梗。'};
  }
  if(life.tool==='blaster'){
    if(life.stamina<7)return {life,message:'体力不足。'};
    const target=TARGETS.filter(t=>{
      const r=distance(t,p);
      return r<20&&(life.damage[t.id]??0)<t.hp&&(r<2.4||((t.x-p.x)*dx+(t.z-p.z)*dz)>r*.78);
    }).sort((a,b)=>distance(a,p)-distance(b,p))[0];
    if(!target)return {life,message:'瞄向附近的岗亭外壳或器材箱。'};
    const hit=Math.min(target.hp,(life.damage[target.id]??0)+(life.completed.includes('physics')?2:1));
    return {life:observe({...life,stamina:life.stamina-7,damage:{...life.damage,[target.id]:hit}},'impact'),message:target.name+(hit===target.hp?' · 已破坏':` · 耐久 ${target.hp-hit}/${target.hp}`)};
  }
  return {life,message:'按 2 装备铲子，按 3 装备冲击枪。'};
};
export const nearbyCar=(p:Point)=>PARKED.find(car=>distance(p,car)<4.6);

export const MINUTES_PER_SECOND=1;
export const START_MINUTE=9*60+10;
export function clockMinute(minute:number){return ((minute%1440)+1440)%1440;}
export function clockLabel(minute:number){
  const m=Math.floor(clockMinute(minute));
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
export function daylightAt(minute:number){
  const h=clockMinute(minute)/60;
  const sun=Math.sin((h-6)*Math.PI/12);
  const warm=1-Math.min(1,Math.max(0,sun)*3.3);
  const brightness=Math.max(0,sun);
  const stage: 'day'|'night'|'dawn'|'dusk'=h<5||h>=20?'night':h<7.5?'dawn':h<17.25?'day':'dusk';
  const night=stage==='night';
  return {stage,direction:[-Math.cos((h-6)*Math.PI/12),night?-.56:-Math.max(.15,brightness),.31] as const,
    sunColor:night?[.67,.79,1] as const:[1,.94-warm*.30,.85-warm*.50] as const,
    intensity:night?.62:.12+brightness*3.75,
    ambient:[.62+brightness*.36,.76+brightness*.22,1] as const,ambientPower:night?2.25:.75+brightness*.53};
}
