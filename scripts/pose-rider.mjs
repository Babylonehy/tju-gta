// Bake two in-place seated clips into the CC0 CharacterCreator student export.
// Coordinates are glTF metres, Y up, +Z forward. The joint targets are the
// existing campus bicycle's grips and pedals, relative to the actor root.
import {readFileSync,writeFileSync} from 'node:fs';
const input=readFileSync(process.argv[2]);
const doc=JSON.parse(input.subarray(20,20+input.readUInt32LE(12)));
const bytes=input.subarray(28+input.readUInt32LE(12));
// ForgeAX names derived assets by meaning; preserve a stable name per
// texture even when an exporter leaves the glTF texture entries anonymous.
const named=new Set();
for(const m of doc.materials){
  for(const [slot,t] of [['albedo',m.pbrMetallicRoughness?.baseColorTexture],['orm',m.pbrMetallicRoughness?.metallicRoughnessTexture],['normal',m.normalTexture],['emissive',m.emissiveTexture],['ao',m.occlusionTexture]]){
    if(!t||named.has(t.index))continue;
    named.add(t.index);doc.textures[t.index].name=m.name+'-'+slot;
    doc.images[doc.textures[t.index].source].name??=m.name+'-'+slot;
  }
}
const sharedSamplers=[],samplerIndex=new Map();
const remap=doc.samplers.map(s=>{
  const key=[s.magFilter??9729,s.minFilter??9987,s.wrapS??10497,s.wrapT??10497].join('-');
  if(!samplerIndex.has(key))samplerIndex.set(key,sharedSamplers.push({...s,name:'filter-'+key})-1);
  return samplerIndex.get(key);
});
for(const t of doc.textures)if(t.sampler!==undefined)t.sampler=remap[t.sampler];
doc.samplers=sharedSamplers;
const nodes=doc.nodes,names=new Map(nodes.map((n,i)=>[n.name,i]));
const parents=Array(nodes.length).fill(-1);
nodes.forEach((n,i)=>n.children?.forEach(c=>{parents[c]=i;}));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,t)=>a.map(v=>v*t);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const len=(a)=>Math.hypot(...a);
const unit=(a)=>mul(a,1/len(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const id=[0,0,0,1],zero=[0,0,0];
const inv=([x,y,z,w])=>[-x,-y,-z,w];
const qmul=([x,y,z,w],[a,b,c,d])=>[w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];
const rotate=(q,v)=>qmul(qmul(q,[...v,0]),inv(q)).slice(0,3);
const axisAngle=(a,r)=>[...mul(a,Math.sin(r/2)),Math.cos(r/2)];
const aim=(a,b)=>{
  const u=unit(a),v=unit(b),c=dot(u,v);
  if(c<-.999999)return axisAngle(unit(cross(u,Math.abs(u[0])>.9?[0,1,0]:[1,0,0])),Math.PI);
  return unit([...cross(u,v),1+c]);
};
const model=(phase,assisted)=>{
  const qs=new Map(),ts=new Map();
  const global=(index)=>{
    if(index<0)return {q:id,t:zero};
    const n=nodes[index],p=global(parents[index]);
    return {q:qmul(p.q,qs.get(index)??n.rotation??id),t:add(p.t,rotate(p.q,ts.get(index)??n.translation??zero))};
  };
  const setGlobalQ=(i,q)=>qs.set(i,unit(qmul(inv(global(parents[i]).q),q)));
  const tilt=(name,a)=>{const i=names.get(name);setGlobalQ(i,qmul(axisAngle([1,0,0],a),global(i).q));};
  const pelvis=names.get('pelvis'),root=names.get('Root'),parent=global(parents[root]);
  const seated=add(global(root).t,sub([0,.947,-.23],global(pelvis).t));
  ts.set(root,rotate(inv(parent.q),sub(seated,parent.t)));
  tilt('spine_01',.54);
  tilt('neck_01',-.37);
  const aimBone=(i,child,target)=>{
    const p=global(i),actual=sub(global(child).t,p.t);
    setGlobalQ(i,qmul(aim(actual,sub(target,p.t)),p.q));
  };
  const solve=(upper,middle,lower,goal,bend)=>{
    const a=names.get(upper),b=names.get(middle),c=names.get(lower);
    const A=global(a).t,l1=len(sub(global(b).t,A)),l2=len(sub(global(c).t,global(b).t));
    const delta=sub(goal,A),u=unit(delta),d=Math.min(l1+l2-.006,Math.max(Math.abs(l1-l2)+.006,len(delta)));
    const k=(l1*l1+d*d-l2*l2)/(2*d);
    const perp=unit(sub(bend,mul(u,dot(u,bend))));
    const elbow=add(A,add(mul(u,k),mul(perp,Math.sqrt(Math.max(0,l1*l1-k*k)))));
    aimBone(a,b,elbow);aimBone(b,c,add(A,mul(u,d)));
  };
  for(const [suffix,side] of [['l',1],['r',-1]]){
    const t=phase+(side<0?Math.PI:0);
    const foot=names.get('foot_'+suffix),footQ=global(foot).q;
    solve('thigh_'+suffix,'calf_'+suffix,'foot_'+suffix,
      [side*.135,assisted?.475:.435+.14*Math.sin(t),assisted?.10:.025+.16*Math.cos(t)],[side*.13,0,1]);
    setGlobalQ(foot,qmul(axisAngle([1,0,0],assisted?0:-.11*Math.cos(t)),footQ));
    solve('upperarm_'+suffix,'lowerarm_'+suffix,'hand_'+suffix,
      [side*.276,1.018,.517],[side*.28,-1,0]);
  }
  for(const i of doc.skins[0].joints)if(!qs.has(i))qs.set(i,nodes[i].rotation??id);
  return {qs,ts};
};
const raw=Buffer.from(bytes);
const chunks=[raw];let offset=raw.length;
function accessor(values,type){
  const buf=Buffer.alloc(values.length*4);
  for(let i=0;i<values.length;i++)buf.writeFloatLE(values[i],i*4);
  const count=values.length/({SCALAR:1,VEC3:3,VEC4:4}[type]);
  const view=doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buf.length})-1;
  chunks.push(buf);offset+=buf.length;
  return doc.accessors.push({bufferView:view,componentType:5126,count,type,...(type==='SCALAR'?{min:[values[0]],max:[values.at(-1)]}:{})})-1;
}
for(const [name,assisted] of process.argv.includes('--name-only')?[]:[['ride',false],['assist',true]]){
  const count=assisted?2:19,frames=Array.from({length:count},(_,i)=>model(i/(count-1)*Math.PI*2,assisted));
  const keys=accessor(frames.map((_,i)=>i/(count-1)),'SCALAR');
  const channels=[],samplers=[];
  for(const [prop,data,type] of [['rotation','qs','VEC4'],['translation','ts','VEC3']]){
    for(const node of frames[0][data].keys()){
      const values=[];
      let prev;
      for(const pose of frames){
        let v=pose[data].get(node);
        if(prop==='rotation'&&prev&&dot(prev,v)<0)v=mul(v,-1);
        values.push(...v);prev=v;
      }
      const output=accessor(values,type);
      channels.push({sampler:samplers.length,target:{node,path:prop}});
      samplers.push({input:keys,output,interpolation:'LINEAR'});
    }
  }
  doc.animations.push({name,samplers,channels,extras:{loop:true,rootMotion:{mode:'in-place'}}});
}
doc.buffers[0].byteLength=offset;
// These exports put each piece of clothing in its own mesh node, with the
// same identity transform and skin. Publish one mesh with material slots so
// each character consumes a single bone palette instead of one per garment.
const scene=doc.scenes[doc.scene??0];
const meshNodes=scene.nodes.filter(i=>nodes[i].mesh!==undefined);
const rootMesh=nodes[meshNodes[0]];
if (!rootMesh || meshNodes.some(i=>{
  const n=nodes[i];
  return n.skin!==rootMesh.skin||n.matrix||n.translation||n.rotation||n.scale||n.children?.length;
})) throw new Error('Expected all garments to share a single skin in the same rest space');
const primitives=meshNodes.flatMap(i=>doc.meshes[nodes[i].mesh].primitives);
doc.meshes=[{...doc.meshes[rootMesh.mesh],primitives}];
rootMesh.mesh=0;
for(const i of meshNodes.slice(1)) { delete nodes[i].mesh; delete nodes[i].skin; }
const retired=new Set(meshNodes.slice(1));
scene.nodes=scene.nodes.filter(i=>!retired.has(i));
const json=Buffer.from(JSON.stringify(doc));
const pad=(4-json.length%4)%4;
const glb=Buffer.alloc(28+json.length+pad+offset,0);
glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
glb.writeUInt32LE(json.length+pad,12);glb.writeUInt32LE(0x4e4f534a,16);
json.copy(glb,20);glb.fill(32,20+json.length,20+json.length+pad);
const bin=20+json.length+pad;
glb.writeUInt32LE(offset,bin);glb.writeUInt32LE(0x004e4942,bin+4);
Buffer.concat(chunks).copy(glb,bin+8);
writeFileSync(process.argv[3],glb);
