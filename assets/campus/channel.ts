import type { CameraPose, Controls, GatePass, Travel } from './explore.ts';
import type { Point, ParcelId, Ride, SecretId, SpotId } from './atlas.ts';
import type { Life, ProjectId, Tool } from './life.ts';

export const AVATARS = {male:'男学生',female:'女学生'} as const;
export type Avatar = keyof typeof AVATARS;
export const CHANNEL = 'beiyang-campus-v1';
export type InputMessage =
  | { kind: 'input'; controls: Controls }
  | { kind: 'dismount' | 'jump' | 'reset' | 'collect' | 'inspect' | 'car' | 'tool-action' | 'observe-light' }
  | { kind: 'destination'; id: string|null }
  | { kind: 'avatar'; avatar: Avatar }
  | { kind: 'warp'; id: SpotId }
  | { kind: 'scan'; mode: Ride; code: string }
  | { kind: 'gate'; direction: GatePass }
  | { kind: 'parcel'; id: ParcelId; code: string }
  | { kind: 'equip'; tool: Tool }
  | { kind: 'clock'; minute: number }
  | { kind: 'project'; id: ProjectId }
  | { kind: 'restore'; parcels: Travel['parcels']; visited: Travel['visited']; found: Travel['found']; life?: Partial<Life>; minute?: number; avatar?: Avatar };
export type NavigationGuide = { id:string; name:string; phase:'walking'|'gate'; points:readonly Point[] };
export type Snapshot = { kind: 'snapshot'; travel: Travel; camera: CameraPose; minute: number; avatar: Avatar; guide?:NavigationGuide; secret?: SecretId; notice?: string };
