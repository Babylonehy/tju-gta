import { definePack } from '@forgeax/engine/pack/source';
import { ok, type EquirectAsset } from '@forgeax/engine/types';
import { DAYLIGHT } from './ids.ts';

const palettes = {
  day: [[.18,.39,.68],[.035,.145,.47],[.20,.25,.21],[1,.81,.63],.085],
  dawn: [[.47,.30,.33],[.072,.19,.44],[.16,.15,.18],[1,.51,.29],.42],
  dusk: [[.32,.16,.30],[.041,.087,.22],[.074,.067,.105],[1,.33,.14],.54],
  night: [[.028,.049,.101],[.006,.015,.046],[.017,.025,.057],[.31,.42,1],.040],
} as const;
const smooth=(lo:number,hi:number,v:number)=>{
  const x=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return x*x*(3-2*x);
};
const blend=(a:number,b:number,t:number)=>a+(b-a)*t;
function noise(x:number,y:number,period:number){
  const hash=(a:number,b:number)=>{
    const n=Math.imul((a+period)%period+71,0x27d4eb2d)^Math.imul(b+89,0x165667b1);
    return ((n^n>>>15)>>>0)/4294967295;
  };
  const i=Math.floor(x),j=Math.floor(y),u=smooth(0,1,x-i),v=smooth(0,1,y-j);
  return blend(blend(hash(i,j),hash(i+1,j),u),blend(hash(i,j+1),hash(i+1,j+1),u),v);
}
function campusSky(stage:keyof typeof palettes): EquirectAsset {
  const [horizon,zenith,bounce,tint,strength]=palettes[stage];
  const width=384,height=192;
  const data=new Float32Array(width*height*4);
  for(let y=0;y<height;y++){
    const elevation=Math.cos(Math.PI*(y+.5)/height);
    const up=Math.max(0,elevation)**.66,ground=Math.min(1,Math.max(0,-elevation)*2.1);
    for(let x=0;x<width;x++){
      const azimuth=(x+.5)/width;
      const direction=azimuth*Math.PI*2;
      const glow=(.5+.5*Math.cos(direction-(stage==='dusk'?4.04:.9)))**7*(1-up)*strength;
      const field=.52*noise(azimuth*13,elevation*17+21,13)+.28*noise(azimuth*26,elevation*34+42,26)
        +.14*noise(azimuth*52,elevation*68+84,52)+.06*noise(azimuth*104,elevation*136+168,104);
      const cloud=smooth(.49,.65,field+.04*Math.sin(elevation*33))*smooth(.018,.13,elevation)*(1-.55*smooth(.64,1,elevation));
      const shade=smooth(.45,.72,field);
      const cloudLight=stage==='night'?[.045,.065,.12]:stage==='day'?[1.24,1.29,1.34]:[1.12,.73,.59];
      const star=stage==='night'&&elevation>.10&&(x*67+y*127+x*y*29)%881===17?.38:0;
      const moon=stage==='night'?.48*smooth(.9990,.9996,Math.sin(direction)*.88*Math.sqrt(Math.max(0,1-elevation*elevation))+.475*elevation):0;
      const color=horizon.map((c,i)=>{
        const sky=(c*(1-up)+zenith[i]*up)*(1-ground)+bounce[i]*ground+glow*(1-ground)*tint[i];
        return blend(sky,cloudLight[i]!*(.63+shade*.37),cloud*(stage==='night'?.5:1))+star+moon;
      });
      data.set([...color,1],(y*width+x)*4);
    }
  }
  return {kind:'equirect',width,height,format:'rgba32float',data:new Uint8Array(data.buffer),colorSpace:'linear'};
}
export default definePack({
  schemaVersion:'2.0.0',packageId:DAYLIGHT,name:'Beiyang / Daylight',
  build:()=>ok({'environment/campus-sky':campusSky('day'),'environment/dawn':campusSky('dawn'),'environment/dusk':campusSky('dusk'),'environment/night':campusSky('night')}),
});
