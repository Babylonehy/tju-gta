import records from '../osm-campus/buildings.json';
import { SPOTS, type Point } from './atlas.ts';

const numerals='零一二三四五六七八九';
const numberText=(name:string)=>name.replace(/([三四五六])十([一二三四五六七八九]?)/g,
  (_,ten:string,one:string)=>String(10*numerals.indexOf(ten)+(one?numerals.indexOf(one):0)));
const ordered=[...records].sort((a,b)=>a.id.localeCompare(b.id));
const mapCodes=new Map(ordered.map((record,index)=>[record.id,'B'+String(index+1).padStart(3,'0')]));
export const BUILDINGS=records.map(record=>{
  const mapCode=mapCodes.get(record.id)!;
  const name=record.name??'名称待核';
  const digits=numberText(name);
  const teaching=/(\d+)\s*(?:公共)?(?:教学|实验)楼/.exec(digits)?.[1];
  const dorm=/(\d+)\s*斋/.exec(digits)?.[1];
  const official=teaching?teaching+'教':dorm?dorm+'斋':undefined;
  return {...record,key:'building:'+record.id,name,mapCode,official,
    label:(official??mapCode)+' · '+name,searchable:(name+' '+digits+' '+mapCode+' '+(official??'')+' '+record.id).toLowerCase()};
});
export const destinationFor=(id:string):{id:string;name:string;point:Point;building:boolean}|undefined=>{
  const spot=SPOTS.find(s=>s.id===id);
  if(spot)return {id,name:spot.name,point:spot.arrival,building:false};
  const b=BUILDINGS.find(b=>b.key===id);
  if(b)return {id,name:b.name,point:b,building:true};
};
