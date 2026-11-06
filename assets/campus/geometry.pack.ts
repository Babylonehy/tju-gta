import { createBoxGeometry, createCapsuleGeometry, createCylinderGeometry, createExtrusionGeometry, createMeshBuilder, createSphereGeometry, createTorusGeometry } from '@forgeax/engine/geometry';
import { AssetGuid } from '@forgeax/engine/pack/guid';
import { definePack } from '@forgeax/engine/pack/source';
import { Materials } from '@forgeax/engine/render';
import { ok, type MaterialAsset, type MeshAsset } from '@forgeax/engine/types';
import { GEOMETRY } from './ids.ts';

export const palette = {
  lawn: '#668257', grass: '#7c9560', moss: '#4b6947', field: '#476d55', dirt: '#99714b', pit: '#39271e',
  road: '#4b5656', curb: '#afac91', path: '#c3b298', paving: '#a69479', stripe: '#e7d4a2',
  brick: '#ad674c', clay: '#854734', buff: '#c48d66', red: '#a75343', terracotta: '#945740',
  trim: '#d8c6a5', roof: '#475653', dark: '#283f3c', glass: '#5f9f9a', glassDeep: '#315e65',
  water: '#488987', ripple: '#86b9a6', waterDeep: '#316d70', track: '#a95e4f', white: '#f7ebd2',
  leaf: '#527647', leafLight: '#869b55', leafDark: '#3d694e', goldLeaf: '#b8a05e',
  blossom: '#e69c9f', rose: '#bd6f82', wood: '#6d4e38', shadow: '#506850',
  jacket: '#c8b99e', jacketSeam: '#938371', denim: '#353f48', denimSeam: '#59626a', hair: '#26201f',
  bag: '#65403b', bagTrim: '#372a29', skinShade: '#ad7452', softRubber: '#242729', silver: '#a3adb0',
  stainless: '#b5bab6', gateGlass: '#7da9a9', signal: '#8be5bc', tarmac: '#41464a', concrete: '#b6b2a7',
  carBlue: '#40566e', carRed: '#7f3533', carGreen: '#37584e', carGray: '#66767b', carWhite: '#c7c7c2',
  autoGlass: '#30444c', chrome: '#b0b9ba', headlight: '#e6e5d4', tail: '#c03831',
  greenBlade: '#628447', greenBladeDry: '#84985c', flowerPale: '#efb4b7', flowerBud: '#a94768',
  swanWhite: '#f5f2e9', mallard: '#27594a', feather: '#79664f', bill: '#dc7e36', bronze: '#5a4d39',
  bikeYellow: '#e6ab22', bikeBlue: '#377cad', reflective: '#e9e5d8',
  gold: '#e2a047', coral: '#e6764c', teal: '#227776', skin: '#cc946c', ink: '#25393b',
} as const;
export const materialPath = (name:string) => 'material/' + name.toLowerCase();
export type Color = keyof typeof palette;
export type Shape = 'box' | 'cyl' | 'ball' | 'torus' | 'cone' | 'lowpoly' | 'smooth' | 'capsule' | 'bevel' | 'autobody' | 'autocab' | 'autoside' | 'tuft' | 'penta' | 'pavilion-arch' | 'court-ring' | 'court-bands';
function rgb(hex: string): [number, number, number] {
  const v = (n: number) => {
    const s = parseInt(hex.slice(n, n + 2), 16) / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  };
  return [v(1), v(3), v(5)];
}
const extrude = (points:readonly (readonly [number,number])[],depth:number,options:{bevelSize:number;bevelSegments:number}) =>
  createExtrusionGeometry(points.map(([x,y])=>({x,y})),depth,options);
const concreteTexture=(texture:string)=>({texture,sampler:'01a1aba4-dc99-72a6-87a8-5a41fe349fa9'});
const concreteMaps={
  baseColorTexture:concreteTexture('01a1abf7-a3b7-7006-a849-721966a5e441'),
  normalTexture:concreteTexture('01a1abf7-a3b7-7006-a849-721a1931419b'),
  metallicRoughnessTexture:concreteTexture('01a1abf7-a3b7-7006-a849-721b44eaf444'),
  triplanar:{space:'world',scale:.65,sharpness:4} as const,
};
function grassGeometry(){
  const position:number[]=[],normal:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let i=0;i<7;i++){
    const a=i*2.39996,c=Math.cos(a),s=Math.sin(a),w=.013+(i%3)*.003,h=.21+(i%4)*.042;
    const x=c*.057,z=s*.057;
    for(const side of [-1,1]){
      const base=position.length/3;
      position.push(x+s*w,0,z-c*w, x-s*w,0,z+c*w,
        x+c*.04+s*w*.54,h*.56,z+s*.04-c*w*.54, x+c*.04-s*w*.54,h*.56,z+s*.04+c*w*.54,
        x+c*.108,h,z+s*.108);
      for(let j=0;j<5;j++)normal.push(c*side,.25,s*side);
      uv.push(0,0,1,0,0,.56,1,.56,.5,1);
      const face=side>0?[0,2,1,1,2,3,2,4,3]:[0,1,2,1,3,2,2,3,4];
      indices.push(...face.map(j=>base+j));
    }
  }
  return createMeshBuilder({attributes:{position:Float32Array.from(position),normal:Float32Array.from(normal),uv:Float32Array.from(uv)},indices}).build().unwrap();
}
const pavilionArch=()=>{
  const opening=Array.from({length:13},(_,i)=>{
    const a=i*Math.PI/12;
    return [.315*Math.cos(a),.01+.27*Math.sin(a)] as const;
  });
  return extrude([[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5],[.315,-.5],...opening,[-.315,-.5]],
    .82,{bevelSize:.012,bevelSegments:1}).unwrap();
};
function ringGeometry(radii:readonly (readonly [number,number])[]){
  const position:number[]=[],normal:number[]=[],tangent:number[]=[],uv:number[]=[],indices:number[]=[];
  for(const band of radii){
    const base=position.length/3;
    for(let i=0;i<=96;i++){
      const a=i*Math.PI/48;
      for(const radius of band){
        const x=radius*Math.cos(a),z=radius*Math.sin(a);
        position.push(x,0,z);normal.push(0,1,0);tangent.push(1,0,0,-1);uv.push(x*.7,z*.7);
      }
      if(i<96){const j=base+i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
    }
  }
  return createMeshBuilder({attributes:{position:Float32Array.from(position),normal:Float32Array.from(normal),tangent:Float32Array.from(tangent),uv:Float32Array.from(uv)},indices}).build().unwrap();
}
export default definePack({
  schemaVersion: '2.0.0',
  packageId: GEOMETRY,
  name: 'Beiyang / Architectural Kit',
  build: () => {
    const meshes = {
      tuft: grassGeometry(),
      'pavilion-arch': pavilionArch(),
      'court-ring': ringGeometry([[24,56]]),
      'court-bands': ringGeometry([[24.4,24.62],[32,32.22],[43.5,43.72],[55.3,55.52]]),
      penta: createCylinderGeometry(.44,.5,1,5,1).unwrap(),
      box: createBoxGeometry(1, 1, 1).unwrap(),
      cyl: createCylinderGeometry(.5, .5, 1, 32, 1).unwrap(),
      ball: createSphereGeometry(.5, 10, 7).unwrap(),
      lowpoly: createSphereGeometry(.5, 7, 5).unwrap(),
      cone: createCylinderGeometry(.18, .5, 1, 7, 1).unwrap(),
      torus: createTorusGeometry(.43, .07, 8, 18).unwrap(),
      smooth: createSphereGeometry(.5, 22, 16).unwrap(),
      capsule: createCapsuleGeometry(.25,.5,7,16).unwrap(),
      bevel: extrude([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],1,{bevelSize:.075,bevelSegments:3}).unwrap(),
      // Bodywork is authored in the side profile (local X is length); rotation
      // on each car turns the extrusion onto the driving axis.
      autobody: extrude([
        [-2.12,.46],[-2.13,.68],[-2.00,.81],[-1.48,.92],[-.67,.98],[.61,.95],[1.51,.87],[2.00,.77],[2.13,.61],
        [2.10,.40],[1.77,.34],[1.73,.53],[1.61,.68],[1.44,.74],[1.26,.68],[1.13,.54],[1.08,.33],
        [-1.02,.33],[-1.06,.54],[-1.20,.69],[-1.39,.74],[-1.56,.69],[-1.70,.54],[-1.75,.35],[-2.04,.37],
      ],1.65,{bevelSize:.045,bevelSegments:3}).unwrap(),
      autocab: extrude([
        [-1.30,.87],[-.99,1.13],[-.68,1.43],[-.50,1.50],[.44,1.50],[.62,1.39],[1.09,.88],
      ],1.40,{bevelSize:.05,bevelSegments:3}).unwrap(),
      autoside: extrude([
        [-1.05,.967],[-.65,1.336],[-.49,1.394],[.40,1.394],[.56,1.31],[.88,.967],
      ],.024,{bevelSize:.004,bevelSegments:1}).unwrap(),
    };
    const assets: Record<string, MeshAsset | MaterialAsset> = {};
    for (const [name, hex] of Object.entries(palette)) {
      if(name==='concrete'||name==='paving'){
        assets[materialPath(name)]=Materials.standard({
          ...concreteMaps,baseColor:name==='concrete'?[.72,.75,.76,1]:[.56,.52,.46,1],
          normalScale:[.78,.78],metallic:0,roughness:.88,
        });
        continue;
      }
      const color = rgb(hex);
      const paint=name.startsWith('car'), glass=name.toLowerCase().includes('glass');
      const metal=['chrome','silver','stainless','bronze'].includes(name);
      const luminous=['gold','ripple','signal','headlight','tail','reflective'].includes(name);
      assets[materialPath(name)] = Materials.standard({
        baseColor: [...color, 1], roughness: paint?.29:glass?.22:metal?.38:name==='water'?.31:.83,
        metallic: paint?.38:glass?.12:metal?.56:0,
        ...(paint ? {staticSwitches:{clearcoat:true},clearcoat:.56,clearcoatRoughness:.18} : {}),
        ...(luminous ? { emissive: color, emissiveIntensity: ['signal','headlight'].includes(name)?.67:.32 } : {}),
      });
    }
    for (const [shape, mesh] of Object.entries(meshes)) {
      // Material is set by the scene on slot zero.
      assets['mesh/' + shape] = { ...mesh, materialSlots: [{ slotName: 'surface', sourceKey: 'beiyang:surface', defaultMaterial: AssetGuid.derive(GEOMETRY, 'material/trim') }] };
    }
    return ok(assets);
  },
});
