import { BUILDINGS } from './directory.ts';
import { clockMinute } from './life.ts';

type VenueKind='canteen'|'classroom'|'library'|'student-center'|'office';
const kindOf=(name:string):VenueKind|undefined=>
  /食堂|餐厅/.test(name)?'canteen':/教学楼|实验楼|静算楼|水利馆/.test(name)?'classroom':
  /图书馆/.test(name)?'library':/学生中心/.test(name)?'student-center':/行政楼|网络中心/.test(name)?'office':undefined;
export const VENUES=BUILDINGS.flatMap((b,i)=>{
  const kind=kindOf(b.name);
  if(!kind)return [];
  const capacity={canteen:760,classroom:510,library:1880,'student-center':465,office:255}[kind];
  return [{...b,kind,capacity:Math.round(capacity*(.76+i%7*.065))}];
});
const bell=(hour:number,center:number,width:number)=>Math.exp(-(((hour-center)/width)**2));
export function campusPopulation(minute:number){
  const hour=clockMinute(minute)/60;
  const students=Math.round(10_400+6_150*bell(hour,13.2,5.8));
  const staff=Math.round(180+1_160*bell(hour,13.0,4.6));
  return {students,staff,total:students+staff};
}
export function venuePopulation(venue:typeof VENUES[number],minute:number){
  const hour=clockMinute(minute)/60;
  const meal=Math.max(bell(hour,7.7,.83)*.69,bell(hour,12.12,.93),bell(hour,18.17,1.0)*.93);
  const lessons=Math.max(bell(hour,9.6,1.54),bell(hour,15.0,1.95)*.91,bell(hour,19.4,1.35)*.48);
  const work=bell(hour,13,4.4);
  const activity={canteen:.035+meal*.87,classroom:.025+lessons*.82,library:.08+bell(hour,15.3,5.7)*.78,
    'student-center':.06+bell(hour,16,3.7)*.72,office:.02+work*.53}[venue.kind];
  const students=Math.round(venue.capacity*activity);
  const staff=Math.round(venue.capacity*(venue.kind==='office'?.26:venue.kind==='canteen'?.045:.038)*work);
  return {students,staff};
}
