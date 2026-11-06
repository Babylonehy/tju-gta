// Original screenshot bounds are retained for existing GitHub Issues.
export type Point = Readonly<{ x: number; z: number }>;
export const LIMITS = {minX:-132,maxX:125,minZ:-108,maxZ:82};
export const distance = (a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
export function contains(p:Point,polygon:readonly Point[]) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.z>p.z)!==(b.z>p.z) && p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}
