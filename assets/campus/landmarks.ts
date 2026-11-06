import { osmFeature } from '../osm-campus/layout.ts';
import { EAST_GATE, SOUTH_GATE, type Point } from './atlas.ts';

const gatesWiki='https://wiki.tjubot.cn/campus-infrastructure/gates-peiyang';
export const GATES=[
  {id:'east',short:'东门',name:'北洋园东门 · 世纪之门',...EAST_GATE},
  {id:'south',short:'南门',name:'北洋园南门',...SOUTH_GATE},
  {id:'north',short:'北门',name:'北洋园北门',...osmFeature('8478746392').points[0]!},
  // The guide map locates these entrances approximately; OSM has no named gate nodes there.
  {id:'northeast',short:'东北门',name:'北洋园东北门 · 示意位置',x:886,z:-670},
  {id:'southeast',short:'东南门',name:'北洋园东南门 · 示意位置',x:608,z:803},
];
export const PAVILION={x:810,z:33};
export const PLAZA={x:819,z:54};
export const HALL_SIGN={x:808,z:94};
export const LAKE_BIRDS={x:-265,z:140};
export const CENTURY_STONES:readonly (Point & {height:number})[]=Array.from({length:12},(_,i)=>({
  x:1083+(i%6)*3.7,z:151+(i%6)*1.41+(i<6?-2.75:2.75),height:1.18+(i%6)*.23,
}));
export const CAMPUS_DECOR_SIGNS=[
  {id:'century',label:'天津大学 · 世纪之门',x:1071,z:126.5,y:4.75},
  {id:'century-years',label:'1895 — 2015',x:1098,z:155.8,y:3.1},
  {id:'pavilion',label:'北洋纪念亭',...PAVILION,y:8.9},
  {id:'hall',label:'北洋厅',...HALL_SIGN,y:3.6},
];
export const LANDMARK_SOURCES:Readonly<Record<string,readonly [string,string][]>>={
  gate:[['天外天 Wiki · 北洋园校门',gatesWiki]],
  main:[['天津大学 · 宣怀广场','https://news.tju.edu.cn/info/1003/158779.htm'],
    ['天外天 Wiki · 32 教','https://wiki.tjubot.cn/classrooms/32nd-teaching-building-peiyang']],
  bridge:[['天外天 Wiki · 校园风景','https://wiki.tjubot.cn/tag/校园风景/']],
  union:[['天外天 Wiki · 标志性建筑','https://wiki.tjubot.cn/tag/landmark-buildings/']],
  sport:[['天津大学体育部 · 北洋园综合体育馆','https://tyb.tju.edu.cn/info/1014/1091.htm']],
  lake:[['天津大学 · 青年湖的天鹅和鸭子','https://news.tju.edu.cn/info/1533/547559.htm']],
  lab:[['天津大学智能与计算学部','https://cs.tju.edu.cn/'],['北洋园教学楼总图','https://oaa.tju.edu.cn/download/by.pdf']],
};
