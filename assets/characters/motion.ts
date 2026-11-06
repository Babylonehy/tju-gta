import type { TravelMode } from '../campus/atlas.ts';

export const MOTIONS = ['idle','walk','run','jump','fall','ride','assist'] as const;
export type Motion = typeof MOTIONS[number];

export function characterMotion(mode: TravelMode, pace: number, lift: number, vertical: number): Motion {
  if (mode === 'ebike') return 'assist';
  if (mode === 'bike') return pace > .25 ? 'ride' : 'assist';
  if (lift > 0) return vertical > 0 ? 'jump' : 'fall';
  return pace > 3.65 ? 'run' : pace > .05 ? 'walk' : 'idle';
}

export function motionSpeed(motion: Motion, pace: number): number {
  if (motion === 'walk') return Math.max(.3, Math.min(2.35, pace / 1.3138));
  if (motion === 'run') return Math.min(2.2, pace / 2.9377);
  if (motion === 'ride') return Math.max(.35, Math.min(2, pace / 12));
  return 1;
}
