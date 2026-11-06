import type { Color, Shape } from './geometry.pack.ts';

export type Triple = readonly [number, number, number];
export type Rotation = readonly [number, number, number, number];
export const aroundX = (r:number):Rotation => [Math.sin(r/2),0,0,Math.cos(r/2)];
export const aroundY = (r:number):Rotation => [0,Math.sin(r/2),0,Math.cos(r/2)];
export const aroundZ = (r:number):Rotation => [0,0,Math.sin(r/2),Math.cos(r/2)];
type AddPart = (shape:Shape,color:Color,pos:Triple,scale:Triple,rotation?:Rotation,key?:string,parent?:string)=>void;

export function buildCar(root:string,paint:Color,part:AddPart) {
  const place=(s:Shape,c:Color,p:Triple,size:Triple,rotation?:Rotation)=>part(s,c,p,size,rotation,undefined,root);
  const profile=aroundY(-Math.PI/2);
  place('autobody',paint,[0,0,0],[1,1,1],profile);
  place('autocab',paint,[0,0,0],[1,1,1],profile);
  for(const side of [-1,1]){
    place('autoside','autoGlass',[side*.702,0,0],[1,1,1],profile);
    place('bevel',paint,[side*.718,1.172,-.115],[.023,.428,.078]);
    place('bevel','chrome',[side*.726,.967,-.132],[.025,.024,1.94]);
    place('bevel','softRubber',[side*.797,.51,-.06],[.048,.095,1.82]);
    place('bevel','chrome',[side*.817,.879,.33],[.026,.039,.156]);
    place('bevel','chrome',[side*.817,.879,-.57],[.026,.039,.143]);
    place('bevel',paint,[side*.868,.97,.73],[.221,.14,.231]);
    place('bevel','autoGlass',[side*.899,.974,.615],[.146,.106,.027]);
    for(const z of [-1.39,1.44]){
      place('cyl','softRubber',[side*.775,.341,z],[.684,.219,.684],aroundZ(Math.PI/2));
      place('cyl','softRubber',[side*.897,.341,z],[.596,.029,.596],aroundZ(Math.PI/2));
      place('cyl','silver',[side*.914,.341,z],[.435,.038,.435],aroundZ(Math.PI/2));
      place('cyl','ink',[side*.936,.341,z],[.321,.015,.321],aroundZ(Math.PI/2));
      for(let n=0;n<5;n++){
        const a=n*2*Math.PI/5;
        place('bevel','chrome',[side*.948,.341+Math.cos(a)*.111,z+Math.sin(a)*.111],[.018,.166,.036],aroundX(a));
      }
      place('cyl','silver',[side*.951,.341,z],[.128,.024,.128],aroundZ(Math.PI/2));
    }
    place('bevel','headlight',[side*.536,.700,2.079],[.38,.136,.128],aroundY(side*.17));
    place('bevel','tail',[side*.568,.701,-2.088],[.35,.154,.087],aroundY(-side*.21));
    place('bevel','softRubber',[side*.555,.486,2.092],[.33,.091,.097]);
  }
  place('bevel','autoGlass',[0,1.197,.825],[1.244,.031,.632],aroundX(.815));
  place('bevel','autoGlass',[0,1.169,-1.017],[1.237,.034,.685],aroundX(-.76));
  place('bevel','softRubber',[0,.576,2.118],[.648,.191,.077]);
  place('box','chrome',[0,.631,2.159],[.60,.021,.015]);
  place('bevel','ink',[0,.45,-2.104],[1.481,.147,.095]);
  place('box','white',[0,.592,-2.165],[.319,.116,.016]);
  place('box','chrome',[0,1.508,-.49],[.051,.096,.079],aroundX(-.3));
}
