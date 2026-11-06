import { distance, type Point } from './survey.ts';
import { COURTYARD, LIMITS, osmFeature } from '../osm-campus/layout.ts';
export type { Point } from './survey.ts';
export { OSM_SOURCE, LIMITS } from '../osm-campus/layout.ts';
export { distance } from './survey.ts';
export const ATLAS_REVISION = 'OSM1';
export const EAST_GATE={x:1071,z:146};
export const SOUTH_GATE={...osmFeature('5140668914').points[0]!};
export const SANWEN={x:624,z:54};
export const FOOT_GATE={x:EAST_GATE.x,z:126.5};
export const GATE_LANES=[-1.65,0,1.65] as const;
export const GATE_PEDESTALS=[-2.475,-.825,.825,2.475];
export const GATE_COLUMNS=[
  ...[-3.4,3.4].map(offset=>({x:FOOT_GATE.x,z:FOOT_GATE.z+offset,width:1.15,depth:.38,height:3.85})),
  ...GATE_PEDESTALS.map(offset=>({x:FOOT_GATE.x,z:FOOT_GATE.z+offset,width:1.8,depth:.26,height:1.28})),
];
export const GATE_VEHICLES=[
  {id:'entry',label:'机动车入口',way:'918137130',yaw:-1.98},
  {id:'exit',label:'机动车出口',way:'918137132',yaw:1.21},
] as const;
export function gateRoadZ(x:number,way:string){
  const line=osmFeature(way).points;
  for(let i=1;i<line.length;i++){
    const [a,b]=[line[i-1],line[i]];
    if(x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x))return a.z+(b.z-a.z)*(x-a.x)/(b.x-a.x);
  }
  return Infinity;
}
export function onEastWalk(p:Point){
  return Math.abs(p.x-FOOT_GATE.x)<19&&Math.abs(p.z-FOOT_GATE.z)<3.65;
}
export const GATE_SIGNS=[
  {id:'pedestrian',label:'人行闸机 · 模拟人脸核验',x:FOOT_GATE.x,z:FOOT_GATE.z,y:4.28},
  ...GATE_VEHICLES.map(g=>({id:g.id,label:g.label,x:EAST_GATE.x,z:gateRoadZ(EAST_GATE.x,g.way),y:4.3})),
];
export const PARCELS=[
  {id:'parcel-n',x:163,z:-373,name:'北区菜鸟驿站',code:'2107',item:'北洋园手绘明信片',building:{x:157,z:-378},sign:1},
  {id:'parcel-s',x:8.5,z:589.5,name:'南区菜鸟驿站',code:'4721',item:'北洋漫梗纪念贴纸',building:osmFeature('11230506035').points[0]!,sign:-1},
] as const;
export type ParcelId=(typeof PARCELS)[number]['id'];
export const parcelAt=(p:Point)=>PARCELS.find(s=>distance(p,s)<4.5);
export type Spot = Point & { id:string; number:string; name:string; english:string; district:string; note:string; y:number; arrival:Point };
const spot=<T extends string>(id:T,number:string,name:string,english:string,district:string,x:number,z:number,y:number,arrival:Point,note:string)=>
  ({id,number,name,english,district,x,z,y,arrival,note});
export const SPOTS = [
  spot('gate','01','北洋园东门','EAST GATE','校前区',1071,146,6.7,{x:1055,z:126.5},'东门又称世纪之门。纪年石柱呼应校史，人行闸机位于车道北侧。沿求是大道向西可到宣怀广场。'),
  spot('main','02','主楼 · 宣怀广场','XUANHUAI PLAZA','校前区',819,54,15,{x:854,z:68},'32 教「斗兽场」环抱宣怀广场。中轴步道穿过西侧门洞，广场北侧有五边北洋纪念亭。'),
  spot('bridge','03','三问桥','SANWEN BRIDGE','求是大道',624,54,4,{x:645,z:54},'横跨中心岛东侧水道。'),
  spot('library','04','郑东图书馆','ZHENGDONG LIBRARY','中心岛',158,39,15,{x:238,z:55},'图书馆位于 44 教北侧。'),
  spot('union','05','大通学生中心','DATONG STUDENT CENTER','中心岛',-137,23,13,{x:-39,z:56},'在新元中路西侧，面向青年湖。'),
  spot('lake','06','青年湖 · 太雷广场','YOUTH LAKE','湖岸公园',-116,186,4,{x:-226,z:156},'青年湖畔可以观赏天鹅和鸭群，也可到太雷广场采集地表数据。'),
  spot('sport','07','北区田径场','NORTH ATHLETICS TRACK','北区',780,-501,3,{x:825,z:-501},'综合体育馆东侧的跑道、足球场和球场群。'),
  spot('dorm','08','诚园生活区','CHENGYUAN RESIDENCE','北区',342,-251,11,{x:254,z:-265},'位于亲民北道南侧。'),
  spot('parcel-n','09',PARCELS[0].name,'NORTH PARCEL STATION','北区',157,-378,4,PARCELS[0],'北区驿站在 55 教北侧。'),
  spot('parcel-s','10',PARCELS[1].name,'SOUTH PARCEL STATION','南门',8.5,594.33,4,PARCELS[1],'沿南门内侧停车场可到。'),
  spot('teach44','11','第 44 教学楼','TEACHING BUILDING 44','中心岛',161,196,8,COURTYARD,'书田南道南侧。可沿东侧桥到达南岸。'),
  spot('lab','55','55 教 · 计算机科研','TEACHING BUILDING 55','北区',172.6,-254.42,20.8,{x:169,z:-221},'U 形红砖楼朝南围合前庭，中央是玻璃门厅。智能与计算学部设在这里，计算机科研项目在前庭提交。'),
  spot('parking','13','南门停车场','SOUTH GATE PARKING','南门',32,534,3,{x:-16,z:512},'按 V 借用停车位上的可驾驶车辆。'),
  spot('southsport','14','南区体育公园','SOUTH SPORTS PARK','南区',680,618,3,{x:682,z:567},'南区足球场、篮球场与网球场。'),
] as const satisfies readonly Spot[];
export type SpotId=(typeof SPOTS)[number]['id'];
export const SPAWN={x:1083,z:FOOT_GATE.z,yaw:-Math.PI/2};
export type Ride='bike'|'ebike';
export type TravelMode='foot'|Ride|'car';
export const RIDES={bike:{label:'普通单车',code:'BY-BIKE',color:'teal'},ebike:{label:'电动助力车',code:'BY-EBIKE',color:'coral'}} as const;
export const DOCKS=[
  {id:'E01',x:1053,z:132,name:'东门单车点'},
  {id:'L02',x:235,z:61,name:'郑东图书馆单车点'},
  {id:'S03',x:-111,z:180,name:'太雷广场单车点'},
  {id:'N04',x:254,z:-265,name:'诚园单车点'},
] as const;
export const dockAt=(p:Point)=>DOCKS.find(d=>distance(p,d)<6.5);
export const scanCode=(id:string,mode:Ride)=>RIDES[mode].code+'-'+id;
export const SECRETS = [
  { id: 'lions', stamp: '狮', title: '北北与洋洋', hint: '进东门后，留意中轴两侧的石狮。', x:1046,z:146, note: '福建校友在建校 120 周年时捐赠了这对北洋狮。两尊石狮背后的图案分别讲述了毕业文凭和创办学堂的故事。', source: 'https://www.tju.edu.cn/info/1103/1409.htm' },
  { id: 'star', stamp: '星', title: '天津大学星 · 8917', hint: '三问桥畔，有一颗落在水边的星星。', x:650,z:84, note: '编号 8917 的小行星于 2018 年获名“天津大学星”。三问桥畔的纪念雕塑是校友给母校的礼物。', source: 'https://news.tju.edu.cn/info/1003/162919.htm' },
  { id: 'begonia', stamp: '棠', title: '海棠堤', hint: '到中心岛北岸，找一找粉色的树。', x:164,z:-101, note: '中心岛北岸的海棠堤，是北洋园欣赏海棠的地方。游戏里把花期留在了每一次漫游中。', source: 'https://fw.tju.edu.cn/Beiyang.html' },
  { id: 'wall', stamp: '忆', title: '恢复高考纪念墙', hint: '青年湖南岸，广场边有一面值得驻足的墙。', x:-116,z:187, note: '太雷广场的恢复高考纪念墙由 1977、1978 级校友捐建，纪念改变一代人求学经历的历史。', source: 'https://news.tju.edu.cn/info/1003/130469.htm' },
  { id: 'fragrant', stamp: '香', title: '诚园真香实验', hint: '诚园生活区，找一找亮着灯的外卖摊。', x:326,z:-289, meme: '真香', note: '《变形计》里，王境泽先拒绝吃饭，后来端起碗说“真香”。这个梗调侃先拒绝、体验后又喜欢上的反转。', example: '“我绕那么远才不来诚园吃饭。”五分钟后：“下次还从图书馆骑车来，真香。”（游戏原创）', source: 'https://media.people.com.cn/n1/2019/0902/c429532-31331998.html' },
  { id: 'pickles', stamp: '饭', title: '大通的电子榨菜', hint: '在大通学生中心外，找一块亮着的放映牌。', x:-68,z:76, meme: '电子榨菜', note: '网友把吃饭时用来“下饭”的视频、老剧或节目叫作电子榨菜。榨菜是比喻，指的是跟饭一起享用的内容。', example: '“在大通看完社团演出，回宿舍吃饭又点开天大社团的回放。今天的电子榨菜是自己学校产的。”（游戏原创）', source: 'https://news.cnr.cn/rebang/20221123/t20221123_526070577.shtml' },
  { id: 'city', stamp: '城', title: '青年湖 City 不 City', hint: '青年湖西岸有个小小的取景框。', x:-265,z:36, meme: 'City 不 City', note: '保保熊在中国旅行短视频里用“City 不 City”发问，后来网友用它开玩笑地问一个地方够不够洋气、好玩或有都市感。', example: '“从北洋园东门骑到青年湖，圆楼和湖景都入镜了。这一镜 City 不 City？”（游戏原创）', source: 'https://finance.people.com.cn/n1/2024/1202/c1004-40373589.html' },
] as const;
export type SecretId=(typeof SECRETS)[number]['id'];
export function nearestSpot(p: Point) {
  return SPOTS.reduce((best, spot) => distance(spot, p) < distance(best, p) ? spot : best);
}
export function onCampus(p: Point) {
  return Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= LIMITS.minX && p.x <= LIMITS.maxX && p.z >= LIMITS.minZ && p.z <= LIMITS.maxZ;
}
// Registration of legacy screenshot-based markers against the new OSM frame.
export const fromLegacy=(p:Point):Point=>({x:136+9.75*p.x,z:146+10.12*p.z});
