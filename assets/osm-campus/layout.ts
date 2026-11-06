import model from './layout.json';
import passages from './passages.json';
import type { Point } from '../campus/survey.ts';

import survey from './survey.json';
import { contains } from '../campus/survey.ts';

export const OSM_SCENE = '01a1aba4-dc99-72a6-87a8-5a12650f8da8';
export const OSM_SCENE_KEY = 'scene:Beiyang-OSM-Campus';
export const OSM_SOURCE = 'https://www.openstreetmap.org/copyright';
export const [minX,minZ,maxX,maxZ] = model.bounds as [number,number,number,number];
export const LIMITS = {minX,minZ,maxX,maxZ};
export const FEATURES = survey.map(f => ({...f,points:f.points.map(([x,z])=>({x,z}))}));
export function osmFeature(id:string) {
  const feature=FEATURES.find(f=>f.id===id);
  if(!feature)throw new Error(`Missing OSM feature ${id}`);
  return feature;
}
export const PARKING = FEATURES.filter(f=>f.kind==='parking');
export const SPORTS = FEATURES.filter(f=>['running','soccer','tennis','basketball','badminton','volleyball'].includes(f.kind));
export const PARKED = model.parkingCars;
export const COURTYARD = {x:163,z:146};

type Triangle = readonly number[];
const CELL = 16;
const cellKey = (x: number, z: number) => x + z * 1024;

function index(triangles: readonly Triangle[]) {
  const cells = new Map<number, Triangle[]>();
  for (const t of triangles) {
    const [ax, , az, bx, , bz, cx, , cz] = t as [number, number, number, number, number, number, number, number, number];
    for (let x = Math.floor(Math.min(ax, bx, cx) / CELL); x <= Math.floor(Math.max(ax, bx, cx) / CELL); x++) {
      for (let z = Math.floor(Math.min(az, bz, cz) / CELL); z <= Math.floor(Math.max(az, bz, cz) / CELL); z++) {
        const key = cellKey(x, z);
        let bucket = cells.get(key);
        if (!bucket) cells.set(key, bucket = []);
        bucket.push(t);
      }
    }
  }
  return cells;
}

const buildings = index(model.buildings);
const roads = index(model.roads);
const water = index(model.water);
const terrain = index(model.terrain);

function surfaceAt(cells: Map<number, Triangle[]>, x: number, z: number): number | undefined {
  const nearby = cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!nearby) return;
  let height: number | undefined;
  for (const t of nearby) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t as [number, number, number, number, number, number, number, number, number];
    const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az;
    const determinant = ux * vz - uz * vx;
    if (Math.abs(determinant) < 1e-7) continue;
    const u = ((x - ax) * vz - (z - az) * vx) / determinant;
    const v = (ux * (z - az) - uz * (x - ax)) / determinant;
    if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
    const y = ay + u * (by - ay) + v * (cy - ay);
    if (height === undefined || y > height) height = y;
  }
  return height;
}

const breakable = index(model.breakable);
const paving = index(model.paving);
export function roadLevel({x,z}:Point) { return surfaceAt(roads,x,z); }
export function pavingLevel({x,z}:Point) { return surfaceAt(paving,x,z); }
export function waterLevel({x,z}:Point) { return surfaceAt(water,x,z); }
export const inParking = (p:Point) => PARKING.some(f=>contains(p,f.points));
export const onSport = (p:Point) => SPORTS.some(f=>contains(p,f.points));
export function ground({x,z}:Point) {
  const p={x,z};
  const base=Math.max(surfaceAt(roads,x,z)??-.5,surfaceAt(terrain,x,z)??-.5,pavingLevel(p)??-.5);
  if(onSport(p))return Math.max(base,.2);
  if(inParking(p))return Math.max(base,.14);
  return base;
}
export function roofLevel({x,z}:Point,kioskBroken=false) {
  return surfaceAt(buildings,x,z)??(kioskBroken?undefined:surfaceAt(breakable,x,z));
}
export const MAIN_PASSAGE=passages.mainWest;
export function inMainPassage(p:Point){
  const {x0,x1,z0,z1}=MAIN_PASSAGE;
  return p.x>x0&&p.x<x1&&p.z>z0&&p.z<z1;
}
export function walkable(x:number,z:number,kioskBroken=false,radius=.27) {
  for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]) {
    const p={x:x+dx,z:z+dz};
    if(p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ||!inMainPassage(p)&&roofLevel(p,kioskBroken)!==undefined)return false;
    const level=waterLevel(p);
    if(level!==undefined&&(roadLevel(p)??-Infinity)<level-.025)return false;
  }
  return true;
}
export function diggable(p:Point) {
  return !inMainPassage(p)&&walkable(p.x,p.z)&&roadLevel(p)===undefined&&pavingLevel(p)===undefined&&waterLevel(p)===undefined&&!inParking(p)&&!onSport(p);
}
export const MAP_MESH = { buildings:[...model.buildings,...model.breakable], roads:[...model.roads,...model.paving],water:model.water };
