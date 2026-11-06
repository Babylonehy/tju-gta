import { GATE_SIGNS, OSM_SOURCE, distance, dockAt, nearestSpot, parcelAt, PARCELS, RIDES, scanCode, SECRETS, SPOTS, type Point, type Ride, type SecretId, type SpotId } from '../campus/atlas.ts';
import { AVATARS, CHANNEL, type Avatar, type InputMessage, type Snapshot } from '../campus/channel.ts';
import { atEastGate, cameraPose, IDLE, nearbySecret, START, worldToView } from '../campus/explore.ts';
import { clockLabel, daylightAt, LAB, maxStamina, nearbyCar, OBSERVATIONS, PROJECTS, START_MINUTE, TARGETS, TOOLS, type Tool } from '../campus/life.ts';
import { BUILDINGS as buildingLabels, destinationFor } from '../campus/directory.ts';
import { campusPopulation, VENUES, venuePopulation } from '../campus/population.ts';
import { CAMPUS_DECOR_SIGNS, GATES, LANDMARK_SOURCES } from '../campus/landmarks.ts';
import { baseMap, percent, routeMap } from './atlas-map.ts';
import { connectsToTju, DEMO, findHiddenPost, getRepository, loadPosts, newIssueUrl, POST_LIMIT, type Post, type PostKind } from './community.ts';
import { QR_CODES } from './qr-codes.ts';
import stylesheet from './hud-style.ts';

const paths = {
  time:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  research:'<path d="M9 3h6m-5 0v6l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 14h8"/>',
  compass:'<path d="m12 2 7 17-7-4-7 4 7-17Z"/><path d="M12 15V2"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/>',
  notes:'<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',
  stamp:'<path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/><circle cx="12" cy="12" r="7"/>',
  pin:'<path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', cross:'<path d="m6 6 12 12M18 6 6 18"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>', bike:'<circle cx="5" cy="16" r="4"/><circle cx="19" cy="16" r="4"/><path d="m5 16 4-8 4 8H5m8 0 4-11h3m-9 3H7"/>',
} as const;
const icon=(key:keyof typeof paths)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const template=() => `<main class="by" tabindex="-1" aria-label="北洋漫梗">
  <header class="mast">
    <div class="brand"><span class="emblem">${icon('compass')}</span><div><div class="brand-kicker">TIANJIN UNIVERSITY <i></i> FIELD NOTES</div><h1>北洋漫梗</h1></div></div>
    <nav aria-label="游戏菜单" class="nav">
      <button data-open="map">${icon('map')}<span>地图</span><kbd>M</kbd></button>
      <button data-open="time">${icon('time')}<span class="clock">09:10</span><kbd>T</kbd></button>
      <button data-open="research">${icon('research')}<span>科研</span><kbd>K</kbd></button>
      <button data-open="board">${icon('notes')}<span>校园留言</span><kbd>G</kbd></button>
      <button data-open="journal">${icon('stamp')}<span>漫游手记</span><kbd>J</kbd></button>
    </nav>
  </header>
  <div class="loading" role="status">正在抵达北洋园<span> · </span> ARRIVING AT BEIYANG</div>
  <div class="world-labels" aria-label="附近的地标和留言"></div>
  <div class="route-banner" hidden><span class="route-message" role="status"></span><button type="button" data-action="cancel-route">取消</button></div>
  <div class="visit-notice" role="status" hidden></div>
  <div class="interact-stack">
    <button class="interact" data-action="interact" hidden></button>
    <div class="pass-message" role="status" hidden></div>
    <button class="interact secondary" data-action="bike" hidden></button>
    <button class="interact secondary" data-action="car" hidden></button>
  </div>
  <section class="district" aria-label="当前位置">
    <div class="district-top"><span class="location-index">01</span><span class="current-district">校前区</span><span class="separator"></span><span class="mode">步行</span></div>
    <div class="current-name">北洋园东门</div>
    <div class="current-english">EAST GATE</div>
    <div class="campus-population" aria-label="校园模拟人数"></div>
    <button class="avatar-switch" data-open="avatar"><kbd>C</kbd><span>角色</span><b>男学生</b></button>
    <div class="stamina"><label for="stamina">体力</label><progress id="stamina" max="100" value="100"></progress><span class="stamina-value">100 / 100</span></div>
    <div class="toolbelt" aria-label="工具栏">${(Object.entries(TOOLS) as [Tool,string][]).map(([tool,label],i)=>`<button data-tool="${tool}" aria-pressed="${i===0}"><kbd>${i+1}</kbd> ${label}</button>`).join('')}<button data-action="tool"><kbd>Q</kbd> 使用</button></div>
    <div class="controls"><span><kbd>WASD</kbd> 移动</span><span>拖动视角</span><span><kbd>SHIFT</kbd> 加速</span><button class="help" data-open="help" aria-label="操作指南">?</button></div>
  </section>
  <div class="minimap card">
    <button class="map-top" data-open="map" aria-label="展开校园地图"><span><span class="north">↑ N</span> <span class="mini-title">校园地图</span></span><b class="visited">01 / 08</b></button>
    <div class="map-face mini-face">${baseMap()}<div class="mini-overlay"></div><i class="you" aria-label="你的位置"></i></div>
    <button class="map-bottom" data-open="board">${icon('notes')}<span class="feed-label">校园留言</span><span class="mini-cta">查看 ${icon('arrow')}</span></button>
    <a class="osm-attribution" href="${OSM_SOURCE}" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
  </div>
  <div class="touch-controls" aria-label="移动操作">
    <button data-touch="w" aria-label="前进">▲</button><button data-touch="a" aria-label="左移">◀</button>
    <button data-touch="s" aria-label="后退">▼</button><button data-touch="d" aria-label="右移">▶</button>
  </div>
  <div class="shade" hidden></div>
  <aside class="panel card" role="dialog" aria-modal="true" aria-label="漫游菜单" hidden>
    <div class="panel-head"><div><div class="panel-kicker"></div><h2></h2></div><button class="close" aria-label="关闭菜单">${icon('cross')}</button></div>
    <div class="panel-content"></div>
  </aside>
</main>`;

type Panel='map'|'board'|'journal'|'help'|'compose'|'detail'|'secret'|'scan'|'gate'|'parcel'|'time'|'research'|'avatar';
const PANELS:Record<Panel,[string,string]>={
  avatar:['PLAYER CHARACTER','选择角色'],
  time:['CAMPUS CLOCK','游戏时间'],research:['COMPUTING LAB','55 教科研'],
  map:['CAMPUS ATLAS','校园地图'],board:['OPEN MESSAGE BOARD','校园留言'],journal:['FIELD NOTES','漫游手记'],
  help:['VISITOR GUIDE','操作指南'],compose:['LEAVE A TRACE','在此留下足迹'],detail:['CAMPUS POST','校园足迹'],secret:['DISCOVERY UNLOCKED','找到了一处彩蛋'],scan:['CAMPUS SHARED RIDES','扫码骑行'],gate:['EAST GATE SECURITY','东门 · 门卫核验'],parcel:['CAINIAO PICKUP','菜鸟驿站'],
};
const PROGRESS='beiyang.field-notes.v1';
function readStorage<T>(key:string, fallback:T):T {
  try { const value=localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function saveStorage(key:string,value:unknown) { try {localStorage.setItem(key,JSON.stringify(value));} catch { /* limited browser storage */ } }

export function mountCampusHud(uiRoot:HTMLElement,port:MessagePort) {
  const doc=uiRoot.ownerDocument;
  const win=doc.defaultView!;
  const wrapper=doc.createElement('div');
  wrapper.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:14';
  const root=wrapper.attachShadow({mode:'open'});
  const style=doc.createElement('style'); style.textContent=stylesheet;
  root.innerHTML=template();
  root.prepend(style);
  uiRoot.append(wrapper);
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const ui=q('.by'), aside=q('.panel'), content=q('.panel-content'), markers=q('.world-labels');
  const ctl=new AbortController(), signal=ctl.signal;
  let snap: Snapshot={kind:'snapshot',travel:START,camera:cameraPose(START),minute:START_MINUTE,avatar:'male'};
  let area=nearestSpot(START), selectedSpot:SpotId=area.id;
  const populationNumber=new Intl.NumberFormat('zh-CN');
  const selectDestination=(id:string)=>{send({kind:'destination',id:snap.guide?.id===id?null:id});close();};
  let mapView:'places'|'buildings'='places', mapZoom=1, selectedBuilding=buildingLabels[0], buildingQuery='';
  let posts:Post[]=[...readStorage<Post[]>(PROGRESS+'.local',[]),...DEMO], repo='', ready=false, refreshing=false, status='正在检查共享留言板…';
  let lastFetch=0, hiddenKey=PROGRESS+'.hidden.demo';
  let unlocked=new Set(readStorage<number[]>(hiddenKey,[]));
  let active:Panel|null=null, tab:'nearby'|'all'='nearby', formKind:PostKind='note', draftText='', draftTitle='', draftPlace:Point=START;
  let currentPost:Post|undefined, currentSecret:SecretId|undefined, focusReturn:HTMLElement|null=null;
  let lastProgress='', toastTimer=0, flash=0, scanTimer=0, gateTimer=0;
  let ride:Ride='bike';
  const keys=new Set<string>(), touches=new Map<number,string>();
  const send=(message:InputMessage)=>port.postMessage({channel:CHANNEL,...message});
  function drive(look=0,tilt=0) {
    const down=(...k:string[])=>k.some(v=>keys.has(v)||Array.from(touches.values()).includes(v));
    send({kind:'input',controls:active?IDLE:{
      forward:Number(down('w','arrowup'))-Number(down('s','arrowdown')),
      strafe:Number(down('d','arrowright'))-Number(down('a','arrowleft')),
      look,tilt,sprint:down('shift'),
    }});
  }
  function release() {keys.clear();touches.clear();drive();}
  const bind=(el:EventTarget,name:string,fn:EventListener,options?:AddEventListenerOptions)=>el.addEventListener(name,fn,{...options,signal});
  const make=(tag:string,cls?:string,label?:string) => {const el=doc.createElement(tag); if(cls) el.className=cls;if(label) el.textContent=label;return el;};
  const button=(label:string,cls:string,fn:()=>void) => {const el=make('button',cls,label) as HTMLButtonElement;el.type='button';el.onclick=fn;return el;};
  const outside=(text:string,url:string,cls='text-link')=>{
    const el=make('a',cls,text) as HTMLAnchorElement;el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el;
  };
  const position=(el:HTMLElement,p:Point)=>{
    const v=percent(p);el.style.left=v.left+'%';el.style.top=v.top+'%';
  };
  function moveMapArrows() {
    for(const arrow of root.querySelectorAll<HTMLElement>('.you')) {
      position(arrow,snap.travel);arrow.style.setProperty('--heading',(180-snap.travel.facing*180/Math.PI)+'deg');
    }
  }
  function mapDots() {
    const overlay=q('.mini-overlay');overlay.replaceChildren();
    overlay.innerHTML=routeMap(snap.travel,snap.guide?.points);
    const destination=snap.guide&&destinationFor(snap.guide.id);
    if(destination){const p=make('i','destination');position(p,destination.point);overlay.append(p);}
    for(const post of posts.filter(p=>p.kind==='note').slice(0,45)) {
      const dot=make('i','post-dot');position(dot,post);overlay.append(dot);
    }
  }
  const visible=()=>posts.filter(p=>p.kind==='note'||unlocked.has(p.id));
  const postMarkers=new Map<number,HTMLButtonElement>();
  const siteMarkers=new Map<SpotId,HTMLButtonElement>();
  for(const spot of SPOTS) {
    const pin=button(spot.name,'pin site-pin',()=>{selectedSpot=spot.id;mapView='places';open('map');});
    pin.innerHTML=`<b>${spot.number}</b><span>${spot.name}</span>`;
    markers.append(pin);siteMarkers.set(spot.id,pin);
  }
  const gateSigns=[...GATE_SIGNS,...CAMPUS_DECOR_SIGNS].map(sign=>{
    const label=make('span','pin gate-sign '+sign.id,sign.label);markers.append(label);return {sign,label};
  });
  const venueSigns=VENUES.map(venue=>{
    const label=make('span','pin venue-pin');label.hidden=true;markers.append(label);return {venue,label};
  });
  const venueText=(v:typeof VENUES[number])=>{
    const {students,staff}=venuePopulation(v,snap.minute);
    return '在楼模拟 · '+populationNumber.format(students)+' 名学生 · '+staff+' 名教职工';
  };
  function placeWorld() {
    const w=ui.clientWidth,h=ui.clientHeight;
    if(!w||!h)return;
    const place=(element:HTMLElement,point:Point&{y:number},max:number) => {
      const p=distance(point,snap.travel)<=max ? worldToView(point,snap.camera,w,h):null;
      element.hidden=!p||p.left<28||p.left>w-28||p.top<92||p.top>h-118;
      if(!element.hidden&&p){element.style.left=p.left+'px';element.style.top=p.top+'px';element.style.zIndex=String(Math.floor(1000-p.depth*5));}
    };
    for(const spot of SPOTS) {
      const el=siteMarkers.get(spot.id)!;
      el.classList.toggle('target',spot.id===snap.guide?.id);
      place(el,spot,spot.id===snap.guide?.id?150:46);
    }
    for(const {sign,label} of gateSigns)place(label,sign,46);
    const nearbyVenues=venueSigns.filter(({venue})=>distance(venue,snap.travel)<52)
      .sort((a,b)=>distance(a.venue,snap.travel)-distance(b.venue,snap.travel)).slice(0,3);
    for(const entry of venueSigns){
      const {venue,label}=entry;
      if(!nearbyVenues.includes(entry)){label.hidden=true;continue;}
      label.textContent=venue.label+' · '+venueText(venue);
      place(label,{...venue,y:venue.y+.85},52);
    }
    const nearest=visible().filter(p=>distance(p,snap.travel)<37).sort((a,b)=>distance(a,snap.travel)-distance(b,snap.travel)).slice(0,10);
    for (const [id,el] of postMarkers) if(!nearest.some(p=>p.id===id)){el.remove();postMarkers.delete(id);}
    for(const post of nearest) {
      let el=postMarkers.get(post.id);
      if(!el){el=button('', 'pin post-pin',()=>{currentPost=posts.find(p=>p.id===post.id);open('detail');});
        el.innerHTML=icon(post.kind==='note'?'notes':'stamp');el.setAttribute('aria-label','查看'+(post.kind==='note'?'留言':'发现的藏梗')+' · '+nearestSpot(post).name);
        markers.append(el);postMarkers.set(post.id,el);}
      place(el,{...post,y:2.4},37);
    }
  }
  function paint() {
    const t=snap.travel;
    area=nearestSpot(t);
    ui.dataset.location=area.id;ui.dataset.x=t.x.toFixed(2);ui.dataset.z=t.z.toFixed(2);
    ui.dataset.avatar=snap.avatar;q('.avatar-switch b').textContent=AVATARS[snap.avatar];
    ui.dataset.mode=t.mode;ui.dataset.inside=String(t.inside);ui.dataset.pass=t.pass??'';ui.dataset.parcels=String(t.parcels.length);ui.dataset.found=String(t.found.length);ui.dataset.visited=String(t.visited.length);
    ui.dataset.stage=daylightAt(snap.minute).stage;ui.dataset.time=clockLabel(snap.minute);
    ui.dataset.tool=t.life.tool;ui.dataset.holes=String(t.life.holes.length);ui.dataset.research=String(t.life.completed.length);
    ui.dataset.damage=String(TARGETS.reduce((sum,target)=>sum+(t.life.damage[target.id]??0),0));
    q('.clock').textContent=ui.dataset.time;
    const {total,students,staff}=campusPopulation(snap.minute);
    q('.campus-population').textContent='校内模拟 '+populationNumber.format(total)+' 人 · 学生 '+populationNumber.format(students)+' · 教职工 '+populationNumber.format(staff);
    q('.route-banner').hidden=!snap.guide;
    ui.dataset.route=snap.guide?.phase??'';
    q('.route-message').textContent=snap.guide?(snap.guide.phase==='gate'?'东门待核验 · 按 E 后继续':'自动步行 · '+snap.guide.name):'';
    const route=root.querySelector('.mini-overlay .route-line');
    if(route&&snap.guide)route.setAttribute('points',[snap.travel,...snap.guide.points].map(p=>p.x+','+p.z).join(' '));
    const stamina=q<HTMLProgressElement>('#stamina');stamina.max=maxStamina(t.life);stamina.value=t.life.stamina;
    q('.stamina-value').textContent=Math.floor(t.life.stamina)+' / '+stamina.max;
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===t.life.tool));
    q('.loading').hidden=ready;
    q('.location-index').textContent=area.number;q('.current-district').textContent=area.district;
    q('.current-name').textContent=area.name;q('.current-english').textContent=area.english;
    q('.mode').textContent=t.mode==='foot'?'步行':t.mode==='car'?'汽车':RIDES[t.mode].label;
    q('.visited').textContent=String(t.visited.length).padStart(2,'0')+' / '+String(SPOTS.length).padStart(2,'0');
    const bike=q<HTMLButtonElement>('[data-action="bike"]');
    bike.hidden=!ready||t.mode==='car'||(t.mode==='foot'&&!dockAt(t));bike.innerHTML=`<kbd>F</kbd> ${t.mode==='foot'?'扫码骑行':'结束骑行'}`;
    const car=q<HTMLButtonElement>('[data-action="car"]');
    car.hidden=!ready||(t.mode!=='car'&&(t.mode!=='foot'||!t.inside||!nearbyCar(t)));
    car.innerHTML=`<kbd>V</kbd> ${t.mode==='car'?'归还车辆':'借用汽车'}`;
    const interaction=q<HTMLButtonElement>('[data-action="interact"]');
    const secret=nearbySecret(t), hidden=findHiddenPost(posts,t,unlocked);
    const gate=atEastGate(t)&&!t.pass, parcel=parcelAt(t);
    interaction.hidden=!ready||(!gate&&!parcel&&!secret&&!hidden);
    interaction.innerHTML=`<kbd>E</kbd> ${gate?(t.mode==='foot'?(t.inside?'出门人脸核验':'入校人脸核验'):'请先结束骑行'):parcel?'菜鸟驿站 · '+(t.parcels.includes(parcel.id)?'查看取件记录':'取快递'):secret?'调查身边的彩蛋':'发现玩家藏梗'}`;
    const passMessage=q('.pass-message');
    passMessage.hidden=!t.pass||!atEastGate(t);
    passMessage.textContent=t.pass==='in'?'核验通过 · 请从打开的闸机入校':'核验通过 · 请从打开的闸机离校';
    const feed=q('.feed-label');const nearby=visible().filter(p=>p.kind==='note'&&distance(p,t)<=38).length;
    feed.textContent=nearby?'附近 · '+nearby+' 条留言':'校园留言';
    moveMapArrows();placeWorld();
  }
  function toast(text:string) {
    const el=q('.visit-notice');el.textContent=text;el.hidden=false;
    win.clearTimeout(toastTimer);toastTimer=win.setTimeout(()=>{el.hidden=true;},3300);
  }
  function close() {
    win.clearTimeout(scanTimer);win.clearTimeout(gateTimer);
    active=null;aside.hidden=true;q('.shade').hidden=true;ui.classList.remove('modal');release();
    (focusReturn??ui).focus({preventScroll:true});focusReturn=null;
  }
  function open(panel:Panel) {
    if(!active) focusReturn=root.activeElement instanceof HTMLElement ? root.activeElement : null;
    active=panel;aside.dataset.view=panel;release();aside.hidden=false;q('.shade').hidden=false;ui.classList.add('modal');
    q('.panel-kicker').textContent=PANELS[panel][0];q('h2').textContent=PANELS[panel][1];aside.setAttribute('aria-label',PANELS[panel][1]);
    renderPanel();q('.close').focus({preventScroll:true});
    if(panel==='board') void refresh();
  }
  function compose(kind:PostKind) {
    const t=snap.travel;
    const hole=[...t.life.holes].reverse().find(p=>distance(p,t)<3.7);
    if(kind==='meme'&&(!hole||t.mode!=='foot')){
      if(active)close();
      toast('在草地按 2 装备铲子，再按 Q 挖土。靠近土坑后可以藏梗。');return;
    }
    formKind=kind;draftPlace=kind==='meme'&&hole?hole:{x:t.x,z:t.z};draftText='';draftTitle='';open('compose');
  }
  function interact() {
    if(active)return;
    if(atEastGate(snap.travel)&&!snap.travel.pass) {
      if(snap.travel.mode!=='foot')toast('请先结束骑行，再到门卫核验');
      else open('gate');
      return;
    }
    if(snap.travel.inside&&parcelAt(snap.travel)){open('parcel');return;}
    if(nearbySecret(snap.travel)){send({kind:'collect'});return;}
    const hidden=findHiddenPost(posts,snap.travel,unlocked);
    if(hidden){unlocked.add(hidden.id);saveStorage(hiddenKey,Array.from(unlocked));currentPost=hidden;paint();open('detail');}
  }
  function renderBuildingMap(){
    const scroll=make('div','building-map-scroll');
    const map=make('div','map-face big-face buildings-face');
    map.style.width=mapZoom*100+'%';
    map.classList.toggle('labeled',mapZoom>=2);map.innerHTML=baseMap(true);scroll.append(map);
    const record=make('p','building-record');
    const start=button('设为目的地','primary',()=>selectDestination(selectedBuilding.key));
    const list=make('div','building-list');list.setAttribute('aria-label','楼栋搜索结果');
    const pins=new Map<string,HTMLButtonElement>();
    function select(b:typeof selectedBuilding,center=false){
      const old=pins.get(selectedBuilding.id);
      old?.classList.remove('selected');old?.setAttribute('aria-pressed','false');
      selectedBuilding=b;
      const pin=pins.get(b.id);
      pin?.classList.add('selected');pin?.setAttribute('aria-pressed','true');
      const venue=VENUES.find(v=>v.id===b.id);
      record.textContent=b.mapCode+' · '+(b.official?b.official+' · ':'')+b.name+(venue?' · '+venueText(venue):'');
      start.textContent=snap.guide?.id===b.key?'取消目的地':'设为目的地';
      if(center){
        const p=percent(b);
        scroll.scrollLeft=map.clientWidth*p.left/100-scroll.clientWidth/2;
        scroll.scrollTop=map.clientHeight*p.top/100-scroll.clientHeight/2;
      }
    }
    for(const b of buildingLabels){
      const pin=button(b.official??b.mapCode,'building-pin',()=>select(b));
      pin.title=b.label;pin.setAttribute('aria-label',b.label);pin.setAttribute('aria-pressed','false');
      pins.set(b.id,pin);position(pin,b);map.append(pin);
    }
    map.append(make('i','you'));
    const filter=doc.createElement('input');filter.type='search';filter.placeholder='例如 55 教、B032、游泳馆';filter.value=buildingQuery;
    filter.setAttribute('aria-label','搜索楼栋');
    const refresh=()=>{
      list.replaceChildren();
      const terms=buildingQuery.toLowerCase().trim().split(/\s+/);
      for(const b of buildingLabels.filter(p=>terms.every(t=>p.searchable.includes(t)))){
        list.append(button(b.label,'building-result',()=>{
          if(mapZoom===1){mapZoom=3;selectedBuilding=b;renderPanel();}
          else select(b,true);
        }));
      }
      if(!list.children.length)list.append(make('p','status','没有匹配的楼栋'));
    };
    filter.oninput=()=>{buildingQuery=filter.value;refresh();};
    const zoom=make('div','building-zoom');
    for(const level of [1,2,3]) {
      const control=button(level+'×','secondary-button',()=>{mapZoom=level;renderPanel();});
      control.setAttribute('aria-pressed',String(level===mapZoom));zoom.append(control);
    }
    const toolbar=make('div','building-toolbar');toolbar.append(filter,zoom);
    content.append(toolbar,scroll,record,start,list,outside('© OpenStreetMap contributors ↗',OSM_SOURCE));
    refresh();select(selectedBuilding,mapZoom>1);moveMapArrows();
  }
  function renderMap() {
    const modes=make('div','tabs map-tabs');
    modes.append(button('地标',mapView==='places'?'active':'',()=>{mapView='places';renderPanel();}),
      button('楼栋 · '+buildingLabels.length,mapView==='buildings'?'active':'',()=>{mapView='buildings';renderPanel();}));
    content.append(modes);
    if(mapView==='buildings'){renderBuildingMap();return;}

    const map=make('div','map-face big-face');map.innerHTML=baseMap(true)+routeMap(snap.travel,snap.guide?.points);content.append(map);
    for (const spot of SPOTS) {
      const b=button(spot.number,'atlas-pin '+(selectedSpot===spot.id?'selected':''),()=>{selectedSpot=spot.id;renderPanel();});
      b.title=spot.name;b.setAttribute('aria-label',spot.name);position(b,spot);map.append(b);
    }
    for(const gate of GATES.filter(g=>g.id!=='east')){
      const pin=make('span','survey-gate',gate.short);pin.title=gate.name;position(pin,gate);map.append(pin);
    }
    for(const post of visible().filter(p=>p.kind==='note').slice(0,80)){
      const dot=make('i','post-dot');position(dot,post);map.append(dot);
    }
    const arrow=make('i','you');map.append(arrow);moveMapArrows();
    const row=make('div','map-caption');row.append(outside('© OpenStreetMap contributors ↗',OSM_SOURCE),make('span','','黄点 · 停车点 / 橙点 · 留言'));content.append(row);
    const spots=make('div','spot-grid');
    for(const spot of SPOTS) {
      const b=button('', 'spot '+(selectedSpot===spot.id?'selected':''),()=>{selectedSpot=spot.id;renderPanel();});
      b.innerHTML=`<b>${spot.number}</b><span>${spot.name}</span>${snap.travel.visited.includes(spot.id)?'<small>✓</small>':''}`;spots.append(b);
    }
    content.append(spots);
    const selected=SPOTS.find(s=>s.id===selectedSpot)!;
    const detail=make('article','paper');
    detail.append(make('span','eyebrow',selected.english),make('h3','',selected.name),make('p','',selected.note),
      button(snap.guide?.id===selected.id?'取消目的地':'设为目的地','primary',()=>selectDestination(selected.id)));
    const travel=button('前往该地','secondary-button travel-button',()=>{close();send({kind:'warp',id:selected.id});});
    travel.disabled=!snap.travel.inside||snap.travel.mode!=='foot';
    detail.append(travel);
    for(const [title,url] of LANDMARK_SOURCES[selected.id]??[])detail.append(outside(title+' ↗',url));
    content.append(detail);
  }
  function renderPost(post:Post,full:boolean) {
    const card=make('article','post-card '+(full?'full':''));
    const meta=make('div','post-meta');
    meta.append(make('span','post-location',nearestSpot(post).name),make('span','',post.id<-10?'本地足迹':post.id<0?'示例':post.kind==='meme'?'玩家藏梗':'公开留言'));
    card.append(meta);
    if(post.kind==='meme')card.append(make('h3','',post.title));
    card.append(make('small','author',post.author+(post.date&&Number.isFinite(Date.parse(post.date))?' · '+post.date.slice(0,10):'')));
    if(post.message)card.append(make('p','',post.message));
    if(post.images.length) {
      const photos=make('div','photos');
      for(const [index,url] of post.images.slice(0,full?4:1).entries()){
        const a=outside('',url,'photo');
        const img=doc.createElement('img');img.src=url;img.alt='用户上传的图片 '+(index+1);img.loading='lazy';img.referrerPolicy='no-referrer';
        img.onerror=()=>{img.replaceWith(make('span','photo-unavailable','图片未加载 · 点击查看'));};
        a.append(img);photos.append(a);
      }
      card.append(photos);
    }
    if(full&&post.url)card.append(outside('在 GitHub 查看或回复 · '+post.replies,post.url));
    if(!full)card.append(button('查看足迹 →','inline-button',()=>{currentPost=post;open('detail');}));
    return card;
  }
  function renderBoard() {
    const actions=make('div','board-actions');
    actions.append(button('＋ 在这里留言','primary',()=>compose('note')),button('✦ 在土坑藏梗','secondary-button',()=>compose('meme')));
    content.append(actions);
    const heading=make('div','feed-head');
    const tabs=make('div','tabs');
    tabs.append(button('附近',tab==='nearby'?'active':'',()=>{tab='nearby';renderPanel();}),
      button('全校',tab==='all'?'active':'',()=>{tab='all';renderPanel();}));
    const refreshButton=button(refreshing?'同步中…':'刷新','inline-button',()=>{void refresh(true);});
    refreshButton.disabled=refreshing||!repo;
    heading.append(tabs,refreshButton);content.append(heading);
    content.append(make('p','status',status));
    const list=visible().filter(p=>tab==='all'||distance(p,snap.travel)<=38);
    if(!list.length)content.append(make('div','empty',tab==='nearby'?'这里还没有发现足迹。换个地方走走，或留下第一条。':'全校还没有公开足迹。'));
    for(const post of list)content.append(renderPost(post,false));
  }
  function renderCompose() {
    content.append(make('p','status',`${nearestSpot(draftPlace).name} · 坐标 ${draftPlace.x.toFixed(1)}, ${draftPlace.z.toFixed(1)}`));
    const actions=make('div','tabs compose-tabs');
    actions.append(button('公开留言',formKind==='note'?'active':'',()=>compose('note')),
      button('藏一个天大梗',formKind==='meme'?'active':'',()=>compose('meme')));
    content.append(actions);
    const form=doc.createElement('form');
    const addLabel=(title:string,el:HTMLElement)=>{const label=make('label','field');label.append(make('span','',title),el);form.append(label);};
    if(formKind==='meme'){
      const title=doc.createElement('input');title.maxLength=36;title.required=true;title.placeholder='例如：诚园真香实验';title.value=draftTitle;
      title.oninput=()=>{draftTitle=title.value;};addLabel('梗名',title);
      form.append(make('p','status','写出这个梗和天大的联系，例如发生在郑东图书馆、诚园或青年湖。其他玩家走近并调查后才会在游戏里看到。'));
    }
    const body=doc.createElement('textarea');
    body.maxLength=POST_LIMIT;body.rows=5;body.placeholder=formKind==='meme'?'这个梗从哪里来？在天大怎么用？':'写下此处见闻；也可以只在 GitHub 编辑器里上传照片。';
    body.value=draftText;body.required=formKind==='meme';body.oninput=()=>{draftText=body.value;};
    addLabel(formKind==='meme'?'梗的来历、意思与天大联系':'留言内容',body);
    form.append(make('p','status',repo?'下一步会打开 GitHub。登录后可把图片拖进编辑器，再点提交。请保留标题里的位置坐标。':'本地足迹保存在本浏览器。部署到开启 Issues 的公开 GitHub 仓库后，可以分享文字和照片。'));
    const err=make('p','error');err.setAttribute('role','alert');form.append(err);
    const submit=make('button','primary',repo?(formKind==='meme'?'去 GitHub 藏梗 ↗':'去 GitHub 上传或发布 ↗'):(formKind==='meme'?'埋下天大梗':'保存本地留言')) as HTMLButtonElement;
    submit.type='submit';form.append(submit);
    form.onsubmit=e=>{
      e.preventDefault();
      try {
        if(!repo){
          const title=draftTitle.trim(),message=draftText.trim();
          if(!message||formKind==='meme'&&(!title||!connectsToTju(title,message)))throw new Error('请填写内容，藏梗还需写清楚与天津大学的联系。');
          const post:Post={...draftPlace,id:-Date.now(),kind:formKind,title,author:'本地访客',date:new Date().toISOString(),message,images:[],replies:0};
          posts=[post,...posts];saveStorage(PROGRESS+'.local',posts.filter(p=>p.id<-10).slice(0,50));mapDots();paint();
          close();toast(formKind==='meme'?'已埋下天大梗，走近土坑后按 E 调查。':'已保存本地留言。');return;
        }
        const url=newIssueUrl(repo,draftPlace,draftText,formKind,draftTitle);
        const a=outside('',url);form.append(a);a.click();a.remove();
        err.textContent='提交后回到游戏，在校园留言里刷新。';
        lastFetch=0;
      } catch(error) {err.textContent=(error as Error).message;}
    };
    content.append(form);
  }
  function renderJournal() {
    const progress=make('div','journal-progress');progress.append(make('span','', '已收集的校园故事'),make('b','',snap.travel.found.length+' / '+SECRETS.length));content.append(progress);
    for(const [name,items] of [['天大校史与景观',SECRETS.filter(s=>!('meme'in s))],['天大版互联网梗',SECRETS.filter(s=>'meme'in s)]] as const) {
      content.append(make('h3','journal-heading',name));
      for(const secret of items) {
        const found=snap.travel.found.includes(secret.id);
        const row=make('div','journal-row');
        row.append(make('span','stamp '+(found?'inked':''),found?secret.stamp:'?'));
        const words=make('div');words.append(make('strong','',found?secret.title:'未发现的彩蛋'),make('small','',found?'打开看故事与出处':secret.hint));row.append(words);
        if(found)row.append(button('阅读 →','inline-button',()=>{currentSecret=secret.id;open('secret');}));
        content.append(row);
      }
    }
    content.append(make('h3','journal-heading','校园快递'));
    for(const station of PARCELS){
      const row=make('div','journal-row');
      row.append(make('span','stamp '+(snap.travel.parcels.includes(station.id)?'inked':''),'件'));
      const words=make('div');words.append(make('strong','',station.name),make('small','',snap.travel.parcels.includes(station.id)?'已取件 · '+station.item:'待取件 · '+station.item));row.append(words);
      row.append(button('地图 →','inline-button',()=>{selectedSpot=station.id;open('map');}));
      content.append(row);
    }
    content.append(make('h3','journal-heading','找到的玩家藏梗'));
    const collected=posts.filter(p=>p.kind==='meme'&&unlocked.has(p.id));
    if(!collected.length)content.append(make('p','status','探索时留意「发现玩家藏梗」提示。找到的梗会保存在这里。'));
    for(const post of collected)content.append(renderPost(post,false));
  }
  function renderSecret() {
    const data=SECRETS.find(s=>s.id===currentSecret);
    if(!data||!snap.travel.found.includes(data.id))return;
    const article=make('article','paper secret-paper');
    article.append(make('span','stamp inked',data.stamp),make('div','eyebrow','meme'in data?'TJU MEME ARCHIVE':'TJU CAMPUS STORY'),make('h3','',data.title));
    if('meme'in data)article.append(make('small','author','原梗 · '+data.meme));
    article.append(make('p','',data.note));
    if('example'in data)article.append(make('blockquote','',data.example));
    article.append(outside('查看出处 ↗',data.source));content.append(article,button('打开漫游手记','secondary-button',()=>open('journal')));
  }
  function vehicleAction() {
    if (snap.travel.mode==='car')return;
    if (snap.travel.mode!=='foot')send({kind:'dismount'});
    else if(dockAt(snap.travel)){ride='bike';open('scan');}
    else toast('请先到单车点 · 地图上的黄色小点');
  }
  function renderScan() {
    const dock=dockAt(snap.travel);
    if(!dock){content.append(make('p','status','请先靠近单车点。'));return;}
    const options=make('div','ride-options');
    for(const mode of ['bike','ebike'] as const){
      const card=button(RIDES[mode].label,'ride-option '+(mode===ride?'selected':''),()=>{win.clearTimeout(scanTimer);ride=mode;renderPanel();});
      card.innerHTML=icon('bike')+'<strong>'+RIDES[mode].label+'</strong><small>'+(mode==='bike'?'脚踏 · 适合慢逛':'助力 · 适合跨区')+'</small>';options.append(card);
    }
    content.append(make('p','status',dock.name+' · '+dock.id),options);
    const code=scanCode(dock.id,ride),matrix=QR_CODES[code];
    const frame=make('div','scan-frame');
    if(matrix){
      const d=matrix.flatMap((row,y)=>[...row].map((pixel,x)=>pixel==='1'?`M${x+4},${y+4}h1v1h-1z`:'')).join('');
      frame.innerHTML=`<svg viewBox="0 0 ${matrix.length+8} ${matrix.length+8}" shape-rendering="crispEdges" role="img" aria-label="车辆二维码"><path d="${d}" fill="#152723"/></svg><i></i>`;
    }
    content.append(frame,make('div','scan-id',code),make('p','status','模拟扫描所选车辆的二维码。游戏内借还，无需相机权限。'));
    const start=button('扫描并解锁','primary',()=>{
      frame.classList.add('scanning');start.textContent='正在识别…';start.disabled=true;
      scanTimer=win.setTimeout(()=>{
        const mode=ride;close();send({kind:'scan',mode,code});
      },680);
    });
    content.append(start);
  }
  function renderGate() {
    const direction=snap.travel.inside?'out':'in';
    const card=make('article','paper gate-card');
    card.append(make('span','eyebrow','EAST GATE · '+(direction==='in'?'ENTRY':'EXIT')),
      make('h3','',direction==='in'?'门卫：你好，请先核验访客身份。':'门卫：离校前，请再核验一次。'));
    const frame=make('div','face-frame');
    frame.innerHTML='<svg viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="44" r="16" fill="#f2b882"/><path d="M24 89c0-16 14-25 32-25s32 9 32 25" fill="#7eaa98"/><path d="M14 34V16h19m46 0h19v18m0 44v18H79m-46 0H14V78" fill="none" stroke="#a2cead" stroke-width="3"/></svg><i></i>';
    card.append(frame,make('p','status','步行通过开闸的通道。模拟核验只识别游戏角色，不打开摄像头。'));
    const verify=button('开始人脸核验','primary',()=>{
      frame.classList.add('scanning');verify.textContent='正在核验访客…';verify.disabled=true;
      gateTimer=win.setTimeout(()=>{close();send({kind:'gate',direction});},750);
    });
    card.append(verify);content.append(card);
  }
  function renderParcel() {
    const station=parcelAt(snap.travel);
    if(!station||!snap.travel.inside)return;
    const card=make('article','paper parcel-card');
    const collected=snap.travel.parcels.includes(station.id);
    card.append(make('span','stamp inked','件'),make('h3','',station.name),make('p','',collected?'已签收 · '+station.item:'待领取 · '+station.item));
    if(collected){content.append(card);return;}
    card.append(make('p','status','模拟取件通知 · 本单取件码 '+station.code));
    const form=doc.createElement('form'),label=make('label','field'),input=doc.createElement('input');
    input.inputMode='numeric';input.autocomplete='off';input.pattern='[0-9]{4}';input.maxLength=4;input.required=true;input.placeholder='输入四位取件码';
    label.append(make('span','','取件码'),input);
    const err=make('p','error');err.setAttribute('role','alert');
    const submit=make('button','primary','确认取件') as HTMLButtonElement;submit.type='submit';
    form.append(label,err,submit);
    form.onsubmit=e=>{
      e.preventDefault();
      if(input.value!==station.code){err.textContent='取件码不匹配，请核对通知。';return;}
      send({kind:'parcel',id:station.id,code:input.value});
    };
    card.append(form);content.append(card);
  }
  function renderClock(){
    const field=make('label','field'),range=doc.createElement('input'),readout=make('output','time-readout',clockLabel(snap.minute));
    range.type='range';range.min='0';range.max='1439';range.value=String(Math.floor(snap.minute));range.setAttribute('aria-label','目标时间');
    const dial=make('div','time-dial');dial.append(readout);
    const refresh=()=>{readout.textContent=clockLabel(Number(range.value));dial.style.setProperty('--time',Number(range.value)/4+'deg');};
    range.oninput=refresh;refresh();
    const set=(minute:number)=>{close();send({kind:'clock',minute});};
    const presets=make('div','time-presets');
    for(const [label,minute] of [['清晨 06:00',360],['正午 12:00',720],['黄昏 18:00',1080],['深夜 23:00',1380]] as const){
      presets.append(button(label,'secondary-button',()=>set(minute)));
    }
    field.append(make('span','','拨动到目标时刻'),range);
    content.append(dial,presets,field,button('调整时间','primary',()=>set(Number(range.value))),
      make('p','status','可快进时间，观察校园天空、光照和路灯变化。'));
  }
  function renderResearch(){
    const t=snap.travel;
    content.append(make('p','status','通过校园里的导航、实时渲染和引擎交互积累样本，再到 55 教提交。'));
    const actions=make('div','board-actions');
    actions.append(button('记录当前光照','secondary-button',()=>send({kind:'observe-light'})),
      button('在地图查看 55 教','secondary-button',()=>{selectedSpot='lab';mapView='places';open('map');}));
    content.append(actions);
    for(const project of PROJECTS){
      const card=make('article','paper research-card'),done=t.life.completed.includes(project.id);
      const ready=project.needs.every(sample=>t.life.data.includes(sample));
      card.append(make('span','eyebrow',project.field),make('h3','',project.name),make('p','',project.description));
      const samples=make('ul','samples');
      for(const sample of project.needs)samples.append(make('li',t.life.data.includes(sample)?'complete':'', (t.life.data.includes(sample)?'✓ ':'○ ')+OBSERVATIONS[sample]));
      const submit=button(done?'已结项':ready?'在 55 教提交':'待采集样本','primary',()=>send({kind:'project',id:project.id}));
      submit.disabled=done||!ready||!t.inside||distance(t,LAB)>13;
      card.append(samples,make('p','research-reward',project.reward),submit);content.append(card);
    }
  }
  function renderPanel() {
    content.replaceChildren();content.scrollTop=0;
    if(active==='map')renderMap();
    if(active==='time')renderClock();
    if(active==='avatar'){
      const choices=make('div','ride-options');
      for(const [id,label] of Object.entries(AVATARS) as [Avatar,string][]){
        const selected=id===snap.avatar;
        const pick=button(label,'ride-option '+(selected?'selected':''),()=>{close();send({kind:'avatar',avatar:id});});
        pick.dataset.avatar=id;pick.setAttribute('aria-pressed',String(selected));
        pick.append(make('small','',selected?'当前角色':'切换角色'));
        choices.append(pick);
      }
      content.append(make('p','status','两位角色共用当前的位置、载具、体力和科研进度。'),choices);
    }
    if(active==='research')renderResearch();
    if(active==='board')renderBoard();
    if(active==='compose')renderCompose();
    if(active==='scan')renderScan();
    if(active==='gate')renderGate();
    if(active==='parcel')renderParcel();
    if(active==='journal')renderJournal();
    if(active==='detail'&&currentPost&&(currentPost.kind==='note'||unlocked.has(currentPost.id)))content.append(renderPost(currentPost,true),button('返回校园留言','secondary-button',()=>open('board')));
    if(active==='secret')renderSecret();
    if(active==='help'){
      const items=[
        ['WASD / 方向键','自由移动；鼠标拖动或触屏滑动调整视角。'],['Shift / Space','加速 / 步行时跳跃。'],
        ['F','在单车点扫码，解锁普通单车或电动助力车；骑行时可随时结束。'],['E','东门核验、驿站取件，或调查附近的彩蛋和玩家藏梗。'],
        ['M / G / J','地图 / 校园留言 / 漫游手记。'],['T / K / C','调整时间 / 55 教科研 / 切换角色。'],['V','靠近可驾驶的停放车辆时借用，再按 V 归还。'],['1 / 2 / 3 / Q','空手 / 铲子 / 冲击枪 / 使用。瞄向草地挖土，或瞄准附近可破坏的目标。'],['Esc / R','关闭菜单 / 返回东门，保留已解锁的发现。'],
      ];
      for(const [key,desc] of items){const row=make('div','guide-row');row.append(make('kbd','',key),make('span','',desc));content.append(row);}
      content.append(button('返回东门','secondary-button',()=>{send({kind:'reset'});close();}),outside('参考：天津大学北洋园校区官方地图 ↗','https://yx.tju.edu.cn/jztd/cx/201806/t20180602_307318.htm'));
    }
  }
  async function refresh(force=false) {
    if(!repo||refreshing||(!force&&Date.now()-lastFetch<160_000))return;
    refreshing=true;lastFetch=Date.now();status='正在同步公开足迹…';if(active==='board')renderPanel();
    try {posts=await loadPosts(repo,signal);status='公开内容来自 GitHub · 无需登录即可浏览';mapDots();paint();}
    catch(error){if(!signal.aborted)status=error instanceof Error&&error.message.includes('GitHub')?error.message:'无法同步公开足迹。请检查网络或稍后刷新。';}
    finally{refreshing=false;if(!signal.aborted&&active==='board')renderPanel();}
  }
  for(const element of root.querySelectorAll<HTMLButtonElement>('[data-open]'))element.onclick=()=>open(element.dataset.open as Panel);
  q<HTMLButtonElement>('.close').onclick=close;
  q<HTMLButtonElement>('[data-action="cancel-route"]').onclick=()=>send({kind:'destination',id:null});
  q('.shade').onclick=close;
  q<HTMLButtonElement>('[data-action="interact"]').onclick=interact;
  q<HTMLButtonElement>('[data-action="bike"]').onclick=vehicleAction;
  q<HTMLButtonElement>('[data-action="car"]').onclick=()=>send({kind:'car'});
  q<HTMLButtonElement>('[data-action="tool"]').onclick=()=>send({kind:'tool-action'});
  for(const el of root.querySelectorAll<HTMLButtonElement>('[data-tool]'))el.onclick=()=>send({kind:'equip',tool:el.dataset.tool as Tool});
  const move=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift']);
  bind(win,'keydown',((e:KeyboardEvent)=>{
    const key=e.key.toLowerCase();
    if(active){
      if(key==='escape'){e.preventDefault();close();}
      if(key==='tab'){
        const enabled=Array.from(aside.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea')).filter(el=>!el.hidden);
        const first=enabled[0],last=enabled.at(-1);
        if(e.shiftKey&&root.activeElement===first&&last){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&root.activeElement===last&&first){e.preventDefault();first.focus();}
      }
      return;
    }
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(move.has(key)){e.preventDefault();if(!keys.has(key)){keys.add(key);drive();}return;}
    if(e.repeat)return;
    if(key==='m'||key==='g'||key==='j'){e.preventDefault();open(key==='m'?'map':key==='g'?'board':'journal');}
    else if(key==='t')open('time');
    else if(key==='c')open('avatar');
    else if(key==='k')open('research');
    else if(key==='1'||key==='2'||key==='3')send({kind:'equip',tool:(['none','shovel','blaster'] as const)[Number(key)-1]});
    else if(key==='q')send({kind:'tool-action'});
    else if(key==='v')send({kind:'car'});
    else if(key==='e')interact();
    else if(key==='f')vehicleAction();
    else if(key==='r')send({kind:'reset'});
    else if(key===' '&&!(root.activeElement instanceof HTMLButtonElement)){e.preventDefault();send({kind:'jump'});}
  }) as EventListener);
  bind(win,'keyup',((e:KeyboardEvent)=>{if(keys.delete(e.key.toLowerCase()))drive();}) as EventListener);
  bind(win,'blur',release);
  let drag:{id:number;x:number;y:number}|null=null;
  bind(win,'pointerdown',((e:PointerEvent)=>{
    if(active||e.button!==0||e.composedPath().some(el=>el instanceof HTMLElement&&el.matches('button,a,input,textarea,.panel')))return;
    const bounds=ui.getBoundingClientRect();
    if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  }) as EventListener);
  bind(win,'pointermove',((e:PointerEvent)=>{
    if(!drag||drag.id!==e.pointerId||active)return;
    drive((e.clientX-drag.x)*.006,(e.clientY-drag.y)*.0045);drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  }) as EventListener);
  const end=((e:PointerEvent)=>{if(drag?.id===e.pointerId)drag=null;if(touches.delete(e.pointerId))drive();}) as EventListener;
  bind(win,'pointerup',end);bind(win,'pointercancel',end);
  for(const element of root.querySelectorAll<HTMLButtonElement>('[data-touch]'))bind(element,'pointerdown',((e:PointerEvent)=>{
    e.preventDefault();element.setPointerCapture(e.pointerId);touches.set(e.pointerId,element.dataset.touch!);drive();
  }) as EventListener);
  bind(win,'resize',paint);
  bind(port,'message',(({data}:MessageEvent<Snapshot & {channel?:string}>)=>{
    if(data?.channel!==CHANNEL||data.kind!=='snapshot')return;
    const previous=snap.travel,previousAvatar=snap.avatar,previousGuide=snap.guide;ready=true;snap=data;
    if(previousGuide?.id!==snap.guide?.id||previousGuide?.phase!==snap.guide?.phase||previousGuide?.points.length!==snap.guide?.points.length)mapDots();
    paint();
    if(previousAvatar!==data.avatar)toast('已切换为'+AVATARS[data.avatar]);
    if(previous.mode!==data.travel.mode){
      const mode=data.travel.mode;
      toast(mode==='foot'?(previous.mode==='car'?'车辆已归还':'已结束骑行'):mode==='car'?'已借用汽车 · WASD 驾驶':'扫码成功 · '+RIDES[mode].label);
    }
    if(previous.inside!==data.travel.inside)toast(data.travel.inside?'欢迎进入北洋园':'已离开北洋园');
    if(active==='research'&&(previous.life.data.length!==data.travel.life.data.length||previous.life.completed.length!==data.travel.life.completed.length))renderPanel();
    if(previous.parcels.length<data.travel.parcels.length&&active==='parcel'){renderPanel();toast('取件成功 · 已签收');}
    const {holes,damage,data:samples,completed}=data.travel.life;
    const encoded=JSON.stringify({visited:data.travel.visited,found:data.travel.found,parcels:data.travel.parcels,life:{holes,damage,data:samples,completed},minute:Math.floor(data.minute),avatar:data.avatar});
    if(encoded!==lastProgress){lastProgress=encoded;saveStorage(PROGRESS,JSON.parse(encoded));}
    if(data.travel.visited.length>previous.visited.length&&previous.visited.length>=1){
      const next=SPOTS.find(s=>s.id===data.travel.visited.at(-1));
      if(next)toast('抵达 · '+next.name);
    }
    if(data.notice)toast(data.notice);
    if(data.secret){
      currentSecret=data.secret;open('secret');
      ui.classList.add('glint');win.clearTimeout(flash);flash=win.setTimeout(()=>ui.classList.remove('glint'),850);
    }
  }) as EventListener);
  const saved=readStorage<Omit<Extract<InputMessage,{kind:'restore'}>,'kind'>>(PROGRESS,{visited:[],found:[],parcels:[]});
  port.start();send({kind:'restore',...saved});send({kind:'inspect'});
  const handshake=win.setInterval(()=>{if(!ready)send({kind:'inspect'});},600);
  const polling=win.setInterval(()=>{if(doc.visibilityState==='visible')void refresh();},180_000);
  bind(doc,'visibilitychange',()=>{if(doc.visibilityState==='visible')void refresh();else release();});
  void getRepository(signal).then(name=>{
    if(signal.aborted)return;
    repo=name;
    if(!name)status='本地预览 · 示例与当前浏览器的足迹';
    else {posts=[];hiddenKey=PROGRESS+'.hidden.'+repo;unlocked=new Set(readStorage<number[]>(hiddenKey,[]));void refresh();}
    mapDots();paint();if(active==='board'||active==='compose')renderPanel();
  });
  mapDots();paint();
  return ()=>{release();ctl.abort();win.clearInterval(handshake);win.clearInterval(polling);win.clearTimeout(toastTimer);win.clearTimeout(flash);win.clearTimeout(scanTimer);win.clearTimeout(gateTimer);wrapper.remove();};
}
