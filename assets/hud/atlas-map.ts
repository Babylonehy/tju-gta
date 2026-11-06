import { DOCKS, SPOTS, type Point } from '../campus/atlas.ts';
import { FEATURES, LIMITS, MAP_MESH, PARKING, SPORTS } from '../osm-campus/layout.ts';

const {minX,minZ,maxX,maxZ}=LIMITS;
const spanX=maxX-minX,spanZ=maxZ-minZ;
export const percent=(p:Point)=>({left:100*(p.x-minX)/spanX,top:100*(p.z-minZ)/spanZ});
const polygon=(points:readonly Point[],cls:string)=>`<polygon class="${cls}" points="${points.map(p=>p.x+','+p.z).join(' ')}"/>`;
const terrainLayers=Object.entries(MAP_MESH).map(([name,mesh])=>{
  const path=mesh.map(t=>`M${Math.round(t[0])},${Math.round(t[2])} ${Math.round(t[3])},${Math.round(t[5])} ${Math.round(t[6])},${Math.round(t[8])}Z`).join('');
  return [name,`<path class="map-${name}" fill-rule="nonzero" d="${path}"/>`] as const;
});
const layers=Object.fromEntries(terrainLayers);
const land=FEATURES.find(f=>f.kind==='boundary');
export function baseMap(expanded=false) {
  return `<svg class="atlas-svg" viewBox="${minX} ${minZ} ${spanX} ${spanZ}" aria-hidden="true">
    ${land?polygon(land.points,'map-land'):''}
    ${layers.water}${layers.roads}
    ${PARKING.map(f=>polygon(f.points,'map-parking')).join('')}
    ${SPORTS.map(f=>polygon(f.points,f.kind==='running'?'map-track':'map-field')).join('')}
    ${layers.buildings}
    ${DOCKS.map(p=>`<circle cx="${p.x}" cy="${p.z}" r="12" fill="#ffe195"/>`).join('')}
    ${expanded?'<path class="map-scale" d="M-1165 895v12h100v-12"/><text x="-1165" y="882">100 m</text>':SPOTS.map(s=>`<circle cx="${s.x}" cy="${s.z}" r="12" fill="#f1ccb3"/>`).join('')}
  </svg>`;
}

export function routeMap(start:Point,points:readonly Point[]|undefined){
  if(!points?.length)return '';
  const line=[start,...points].map(p=>p.x+','+p.z).join(' ');
  return '<svg class="atlas-svg route-overlay" viewBox="'+[minX,minZ,spanX,spanZ].join(' ')+'" aria-hidden="true"><polyline class="route-line" points="'+line+'"/></svg>';
}
