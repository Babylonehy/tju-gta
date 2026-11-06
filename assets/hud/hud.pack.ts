import type {} from '@forgeax/engine/app';
import { definePack } from '@forgeax/engine/pack/source';
import type { Plugin } from '@forgeax/engine/plugin';
import { ok } from '@forgeax/engine/types';
import { FRONTEND } from '../campus/ids.ts';
import { mountCampusHud } from './hud.ts';

export const hud: Plugin = {
  name:'beiyang/hud', inject:['gameHost'],
  apply(ctx) {
    const host=ctx.gameHost;
    const port=host?.presentationPort ?? host?.port;
    const root=host?.uiRoot;
    if(!host || !root || !port) throw new Error('Campus interface requires GameHost.uiRoot and presentation port');
    ctx.effect(function* () {
      host.setPointerLockAllowed?.(false);
      yield mountCampusHud(root,port);
    },'beiyang/hud');
  },
};
export default definePack({
  schemaVersion:'2.0.0', packageId:FRONTEND,name:'Beiyang / Visitor Interface',
  build: () => ok({'plugin/hud':{kind:'plugin',module:{specifier:'./hud.pack.ts',export:'hud'}}}),
});
